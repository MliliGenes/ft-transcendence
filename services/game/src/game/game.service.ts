import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  ArenaEngine,
  InMemoryEvaluationTelemetry,
  FileBank,
  InMemoryCollabPersist,
  PostgresStores,
  InMemoryRevealStore,
  InMemorySubmissionStore,
  StoreBackedMatchPersistence,
  testPrincipal,
  InMemoryLobbyStore,
  InMemoryMatchStore,
  RateLimitedError,
  selectProblems,
  type AuthenticatedPrincipal,
  type MatchStore,
  type MatchPersistence,
  type ILobbyStore,
  type LobbySideId,
  type PrivateRoom,
  type PrivateRoomMember,
  type QueueEntry,
  type RoomWithMembers,
  type ExpiredRoomCursor,
} from "arena-game-engine";
import type { MatchMode } from "arena-model";
import { MatchSocketPresence } from "./match-socket-presence.js";
import { createGameJudge } from "./judge-factory.js";
import { buildLeaderboard, statisticsForUser, summarizeCompletedMatch } from "./match-statistics.js";
import { GameEventsPublisher } from "./game-events.publisher.js";

const LOBBY_PROBLEM_POOL = ["even-ledger", "double-it", "sum-array"];
const DELETED_ACCOUNT_TOKEN_BLOCK_MS = 20 * 60 * 1000;
/** How often an unconfirmed lifecycle event is republished before it is dropped. */
const PUBLISH_ATTEMPTS = 3;
const PUBLISH_RETRY_MS = 2000;

function userTokenHash(userId: string): string {
  return createHash("sha256").update(userId, "utf8").digest("hex");
}

export function selectLobbyProblems(): string[] {
  return selectProblems(LOBBY_PROBLEM_POOL, 3);
}

/**
 * Thin application layer over ArenaEngine: owns NOTHING domain (no scoring,
 * phases, or counting here). Handles engine lifecycle, store selection, the
 * 1v1 auto-reveal condition (all sides counted -> game-owned publish), and
 * event fan-out to the gateway.
 */
@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private engine!: ArenaEngine;
  private stores?: PostgresStores;
  private matchStore!: MatchStore;
  private lobbyStore!: ILobbyStore;
  private readonly listeners = new Set<(event: string, matchId: string, payload: unknown) => void>();
  private readonly lobbyListeners = new Set<(event: string, payload: unknown) => void>();
  private readonly accountDeletionListeners = new Set<(userId: string) => void>();
  private readonly activeSocketEnumerators = new Set<() => string[]>();
  private readonly deletedAccountHashes = new Map<string, number>();
  private readonly userActionTimes = new Map<string, number[]>();
  private readonly evaluationTelemetry = new InMemoryEvaluationTelemetry();
  private readonly matchSocketPresence: MatchSocketPresence;
  private graceTimer?: NodeJS.Timeout;
  private deadlineTimer?: NodeJS.Timeout;
  private accountErasureCleanupTimer?: NodeJS.Timeout;
  private activeSocketSweepTimer?: NodeJS.Timeout;
  private challengeExpiryTimer?: NodeJS.Timeout;
  /** Room codes whose expiry cancellation was already published. */
  private readonly cancelledChallengeCodes = new Set<string>();
  /** Serializes lifecycle events so a start is never published after its end. */
  private publishChain: Promise<void> = Promise.resolve();

  constructor(@Optional() private readonly events?: GameEventsPublisher) {
    this.matchSocketPresence = new MatchSocketPresence({
      participantSide: (userId, matchId) => this.engine.participantSide(userId, matchId),
      modeOf: (matchId) => this.engine.modeOf(matchId),
      setPresence: async (matchId, side, presence) => {
        await this.engine.setPresence(matchId, side, presence);
      },
      setMemberPresence: async (matchId, userId, presence) => {
        await this.engine.setMemberPresence(matchId, userId, presence);
      },
    });
  }

  onEvent(listener: (event: string, matchId: string, payload: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onLobbyEvent(listener: (event: string, payload: unknown) => void): () => void {
    this.lobbyListeners.add(listener);
    return () => {
      this.lobbyListeners.delete(listener);
    };
  }

  onAccountDeleted(listener: (userId: string) => void): () => void {
    this.accountDeletionListeners.add(listener);
    return () => this.accountDeletionListeners.delete(listener);
  }

  registerActiveSocketEnumerator(enumerate: () => string[]): () => void {
    this.activeSocketEnumerators.add(enumerate);
    return () => this.activeSocketEnumerators.delete(enumerate);
  }

  /** Fast local revocation and socket fan-out as soon as a deletion event arrives. */
  blockDeletedAccount(userId: string): void {
    const hash = userTokenHash(userId);
    this.deletedAccountHashes.set(hash, Date.now() + DELETED_ACCOUNT_TOKEN_BLOCK_MS);
    this.engine?.blockAccount(userId);
    for (const listener of this.accountDeletionListeners) {
      try {
        listener(userId);
      } catch {
        console.error("[game] failed to disconnect a deleted account socket");
      }
    }
  }

  /** Reject old access tokens after account deletion; the persistent store keeps only a short-lived hash. */
  async assertAccountActive(userId: string): Promise<void> {
    const hash = userTokenHash(userId);
    const localExpiry = this.deletedAccountHashes.get(hash);
    if (localExpiry !== undefined) {
      if (localExpiry > Date.now()) throw new Error("account is unavailable");
      this.deletedAccountHashes.delete(hash);
    }
    if (await this.stores?.isUserHashBlocked(hash)) throw new Error("account is unavailable");
  }

  private async disconnectDeletedSockets(): Promise<void> {
    const hashToUser = new Map<string, string>();
    for (const enumerate of this.activeSocketEnumerators) {
      for (const userId of enumerate()) hashToUser.set(userTokenHash(userId), userId);
    }
    const localBlocklist = [...hashToUser]
      .filter(([hash]) => (this.deletedAccountHashes.get(hash) ?? 0) > Date.now())
      .map(([hash]) => hash);
    const storedBlocklist = await this.stores?.blockedUserHashes([...hashToUser.keys()]) ?? new Set<string>();
    for (const hash of new Set([...localBlocklist, ...storedBlocklist])) {
      const userId = hashToUser.get(hash);
      if (userId) this.blockDeletedAccount(userId);
    }
  }

  /** Persist deletion revocation, clear lobby state, then anonymize matches and purge source. */
  async eraseDeletedAccount(userId: string): Promise<void> {
    this.blockDeletedAccount(userId);
    const blockUntil = Date.now() + DELETED_ACCOUNT_TOKEN_BLOCK_MS;
    await this.stores?.blockUserHash(userTokenHash(userId), blockUntil);
    await this.lobbyStore.eraseUser(userId);
    await this.engine.eraseAccount(userId);
  }

  private broadcastRoomUpdate(roomId: string, room: PrivateRoom, members: PrivateRoomMember[]): void {
    for (const listener of this.lobbyListeners) {
      listener("lobby.roomUpdated", { roomId, room, members });
    }
  }

  private checkLobbyRateLimit(userId: string): void {
    const now = Date.now();
    const windowMs = 10000;
    const maxActions = 15;
    let list = this.userActionTimes.get(userId);
    if (!list) {
      list = [];
      this.userActionTimes.set(userId, list);
    }
    const recent = list.filter((t) => now - t < windowMs);
    if (recent.length >= maxActions) {
      throw new RateLimitedError("too many lobby requests; please slow down");
    }
    recent.push(now);
    this.userActionTimes.set(userId, recent);
  }

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    let persistence: MatchPersistence;
    if (databaseUrl) {
      this.stores = new PostgresStores(databaseUrl);
      await this.stores.ensureSchema();
      this.accountErasureCleanupTimer = setInterval(() => {
        void this.stores?.purgeExpiredAccountHashes().catch(() => {});
        const now = Date.now();
        for (const [hash, expiry] of this.deletedAccountHashes) {
          if (expiry <= now) this.deletedAccountHashes.delete(hash);
        }
      }, 60_000);
      this.accountErasureCleanupTimer.unref();
      this.activeSocketSweepTimer = setInterval(() => {
        void this.disconnectDeletedSockets().catch(() => {});
      }, 15_000);
      this.activeSocketSweepTimer.unref();
      persistence = this.stores.persistence;
      this.matchStore = this.stores.matches;
      this.lobbyStore = this.stores.lobby;
    } else {
      const matches = new InMemoryMatchStore();
      this.matchStore = matches;
      persistence = new StoreBackedMatchPersistence({
        matches,
        submissions: new InMemorySubmissionStore(),
        reveals: new InMemoryRevealStore(),
        collab: new InMemoryCollabPersist(),
      });
      this.lobbyStore = new InMemoryLobbyStore(undefined, undefined, matches);
    }
    this.engine = new ArenaEngine({
      judge: createGameJudge(process.env),
      bank: new FileBank(),
      persistence,
      telemetry: this.evaluationTelemetry,
      // Configurable within the spec 60–90s window; tests inject short values.
      reconnectGraceMs: Number(process.env.RECONNECT_GRACE_MS ?? 90000),
    });
    this.engine.on((event, payload) => {
      const matchId = (payload as { matchId?: string } | null)?.matchId;
      if (typeof matchId === "string" && matchId) {
        if (event === "match.ended") {
          const result = (payload as { result?: string }).result;
          this.queuePublish(() => this.publishMatchEnded(matchId, result));
        }
        for (const l of this.listeners) l(event, matchId, payload);
      }
    });
    // Boot recovery BEFORE serving (§10): presence reset, transient repair,
    // pending-evaluation re-drive under original ids.
    const recovered = await this.engine.recover();
    console.log(`[game] boot recovery: ${recovered.matches} matches, ${recovered.retried} retried, ${recovered.failed} failed`);
    // Match deadline closure has a short sweep interval so an expired Match
    // reaches its saved terminal result without waiting for a player action.
    this.deadlineTimer = setInterval(() => {
      void this.engine.sweepExpiredMatches().catch(() => {});
    }, 1000);
    this.deadlineTimer.unref();
    // Reconnect grace and retained queue matchmaking use their slower cadence.
    this.graceTimer = setInterval(() => {
      void this.engine.sweepGrace().catch(() => {});
      for (const mode of ["1v1", "2v2"] as const) {
        void this.triggerMatchmaking(mode).catch((error) => console.error("[lobby] matcher retry failed", error));
      }
    }, 10000);
    this.graceTimer.unref();
    // Challenges that nobody accepts expire on their own; announce the
    // cancellation so the linked conversation is not left waiting.
    this.challengeExpiryTimer = setInterval(() => {
      void this.sweepExpiredChallenges().catch((error) =>
        console.error("[lobby] challenge expiry sweep failed", error),
      );
    }, 30000);
    this.challengeExpiryTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.graceTimer) clearInterval(this.graceTimer);
    if (this.deadlineTimer) clearInterval(this.deadlineTimer);
    if (this.accountErasureCleanupTimer) clearInterval(this.accountErasureCleanupTimer);
    if (this.activeSocketSweepTimer) clearInterval(this.activeSocketSweepTimer);
    if (this.challengeExpiryTimer) clearInterval(this.challengeExpiryTimer);
    await this.stores?.close();
  }

  get inner(): ArenaEngine {
    return this.engine;
  }

  principalFor(userId: string): AuthenticatedPrincipal {
    // DEV-ONLY: the real auth middleware supplies this (see principal.ts).
    return testPrincipal(userId);
  }

  async sideOf(userId: string, matchId: string): Promise<string> {
    return this.engine.participantSide(userId, matchId);
  }

  async modeOf(matchId: string) {
    return this.engine.modeOf(matchId);
  }

  /**
   * Socket open for (user, match): first socket flips presence online.
   * Membership is verified via participantSide — strangers throw here and the
   * gateway must refuse the room (unauthorized join stays refused). 2v2 uses
  * per-member presence (two members share one side); 1v1 keeps side presence.
  */
  async noteSocketOpen(userId: string, matchId: string, socketId: string): Promise<string> {
    return this.matchSocketPresence.noteSocketOpen(userId, matchId, socketId);
  }

  /** Socket close: presence goes offline only when its last socket drops. */
  async noteSocketClosed(userId: string, matchId: string, socketId: string): Promise<void> {
    await this.matchSocketPresence.noteSocketClosed(userId, matchId, socketId);
  }

  async leave(userId: string, matchId: string) {
    return this.engine.leaveMatch(this.principalFor(userId), matchId);
  }

  async createMatch(input: { mode: "1v1" | "2v2"; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }): Promise<{ matchId: string }> {
    const matchId = await this.engine.createMatch(input);
    return { matchId };
  }

  async snapshot(userId: string, matchId: string) {
    return this.engine.snapshot(this.principalFor(userId), matchId);
  }

  async startRound(userId: string, matchId: string) {
    await this.engine.startRound(this.principalFor(userId), matchId);
    return { ok: true as const };
  }

  async beginCoding(userId: string, matchId: string) {
    await this.engine.beginCoding(this.principalFor(userId), matchId);
    return { ok: true as const };
  }

  async run(userId: string, matchId: string, input: { code: string; language: string }) {
    return this.engine.run(this.principalFor(userId), matchId, input);
  }

  async submit(userId: string, matchId: string, input: { code: string; language: string; submissionId?: string; evaluationId?: string; documentRevision?: number }) {
    const receipt = await this.engine.submit(this.principalFor(userId), matchId, input);
    // Reveal condition (game-owned): every side counted -> publish.
    // Fire-and-forget: publish errors never fail the accepted submission.
    void this.maybeAutoReveal(userId, matchId).catch(() => {});
    return receipt;
  }

  /**
   * 2v2 readiness (per-player, revision-bound). The engine resolves the team
   * from the principal; a player can only ever mark themselves.
   */
  async setReady(userId: string, matchId: string, input: { ready: boolean; documentRevision?: number }) {
    await this.engine.setReady(this.principalFor(userId), matchId, input);
    return { ok: true as const };
  }

  /**
   * Ticket 15 production ingress: real Yjs update frames. DEV-ONLY
   * notifyDocChanged below stays for ticket-14 tests; production clients use
   * the collab socket, which lands here after namespace authorization.
   */
  async applyCollabUpdate(userId: string, matchId: string, input: { roundId: string; updateB64: string }) {
    return this.engine.applyCollabUpdate(this.principalFor(userId), matchId, input);
  }

  /** Join/sync baseline for the caller's current team document (read-only). */
  async collabSync(userId: string, matchId: string) {
    return this.engine.collabSync(this.principalFor(userId), matchId);
  }

  /** Team-owned language switch (2v2): re-homes the doc + invalidates readiness. */
  async setTeamLanguage(userId: string, matchId: string, language: string) {
    const revision = await this.engine.setTeamLanguage(this.principalFor(userId), matchId, language);
    return { ok: true as const, revision };
  }

  /** Ticket 16: authoritative 2v2 team chat context resolution. */
  async resolveTeamChatContext(userId: string, matchId: string) {
    return this.engine.resolveTeamChatContext(this.principalFor(userId), matchId);
  }

  async advance(userId: string, matchId: string) {
    await this.engine.nextRound(this.principalFor(userId), matchId);
    return { ok: true as const };
  }

  async final(userId: string, matchId: string) {
    return this.engine.finalResult(this.principalFor(userId), matchId);
  }

  async userMatches(userId: string) {
    const records = await this.matchStore.listCompletedForUser(userId);
    const matches = records
      .map((record) => summarizeCompletedMatch(record, userId))
      .filter((summary): summary is NonNullable<typeof summary> => summary !== null)
      .sort((left, right) => right.playedAt.localeCompare(left.playedAt) || left.matchId.localeCompare(right.matchId))
      .slice(0, 25);
    return { matches };
  }

  async userStatistics(userId: string) {
    return statisticsForUser(userId, await this.matchStore.listCompletedForUser(userId));
  }

  async leaderboard() {
    return { players: buildLeaderboard(await this.matchStore.listCompleted()).slice(0, 50) };
  }

  // ─── Ticket 04: Lobby and Matchmaking ──────────────────────────────────────

  async joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry> {
    this.checkLobbyRateLimit(userId);
    const entry = await this.lobbyStore.joinQueue(userId, mode);
    await this.triggerMatchmaking(mode);
    return (await this.lobbyStore.queueStatus(userId)) ?? entry;
  }

  async cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    this.checkLobbyRateLimit(userId);
    return this.lobbyStore.cancelQueue(userId);
  }

  async queueStatus(userId: string): Promise<QueueEntry | null> {
    return this.lobbyStore.queueStatus(userId);
  }

  async triggerMatchmaking(mode: MatchMode): Promise<{ matchId: string; entries: QueueEntry[] } | null> {
    const problems = selectLobbyProblems();
    const result = await this.lobbyStore.tryMatch(mode, problems, (input, save) =>
      this.engine.createMatch(input, save),
    );
    if (result) {
      for (const listener of this.lobbyListeners) {
        listener("lobby.queueMatched", { matchId: result.matchId, userIds: result.entries.map((e: QueueEntry) => e.userId) });
      }
      this.queuePublish(() => this.publishMatchStarted(result.matchId, null));
    }
    return result;
  }

  async createPrivateRoom(userId: string, mode: MatchMode): Promise<RoomWithMembers> {
    this.checkLobbyRateLimit(userId);
    return this.lobbyStore.createPrivateRoom(userId, mode);
  }

  async joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }> {
    this.checkLobbyRateLimit(userId);
    const res = await this.lobbyStore.joinPrivateRoom(userId, inviteCode);
    this.broadcastRoomUpdate(res.room.id, res.room, res.members);
    return res;
  }

  async leavePrivateRoom(userId: string, roomId: string): Promise<{ left: boolean; closed: boolean }> {
    this.checkLobbyRateLimit(userId);
    const before = await this.lobbyStore.getRoomWithMembers(roomId);
    const res = await this.lobbyStore.leavePrivateRoom(userId, roomId);
    const updated = await this.lobbyStore.getRoomWithMembers(roomId);
    if (updated) {
      this.broadcastRoomUpdate(roomId, updated.room, updated.members);
    }
    if (res.closed && before) {
      // The owner withdrew the challenge before any match started.
      this.queuePublish(() =>
        this.publishChallengeCancelled(
          before.room.code,
          "room-closed",
          before.members.map((member) => member.userId),
        ),
      );
    }
    return res;
  }

  async setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    this.checkLobbyRateLimit(userId);
    const res = await this.lobbyStore.setRoomMemberSide(userId, roomId, sideId);
    this.broadcastRoomUpdate(roomId, res.room, res.members);
    return res;
  }

  async setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers> {
    this.checkLobbyRateLimit(userId);
    const res = await this.lobbyStore.setRoomMemberReady(userId, roomId, ready);
    this.broadcastRoomUpdate(roomId, res.room, res.members);
    return res;
  }

  async startPrivateRoom(userId: string, roomId: string): Promise<{ matchId: string }> {
    this.checkLobbyRateLimit(userId);
    const problems = selectLobbyProblems();
    const { matchId } = await this.lobbyStore.startPrivateRoom(
      userId,
      roomId,
      problems,
      (input, save) => this.engine.createMatch(input, save),
    );
    const room = await this.lobbyStore.getRoomWithMembers(roomId);
    for (const listener of this.lobbyListeners) {
      listener("lobby.matchFound", { roomId, matchId, userIds: room!.members.map((member) => member.userId) });
    }
    this.queuePublish(() => this.publishMatchStarted(matchId, room!.room.code));
    return { matchId };
  }

  async roomForMember(userId: string, roomId: string): Promise<RoomWithMembers> {
    const result = await this.lobbyStore.getRoomWithMembers(roomId);
    if (!result) throw new NotFoundException("room not found");
    if (!result.members.some((member) => member.userId === userId)) {
      throw new ForbiddenException("not a member of this room");
    }
    return result;
  }

  async getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null> {
    return this.lobbyStore.getRoomWithMembers(roomId);
  }

  async lookupRoomByCode(code: string): Promise<RoomWithMembers | null> {
    return this.lobbyStore.getRoomByCode(code);
  }

  async userActiveRoom(userId: string): Promise<RoomWithMembers | null> {
    return this.lobbyStore.userActiveRoom(userId);
  }

  private async maybeAutoReveal(userId: string, matchId: string): Promise<void> {
    const principal = this.principalFor(userId);
    const sides = await this.engine.roundSides(principal, matchId);
    const counted = await this.engine.roundCountedSides(principal, matchId);
    if (sides.length > 0 && counted.length >= sides.length) {
      try {
        await this.engine.publishReveal(principal, matchId, { graceMs: 1500 });
      } catch {
        // Already revealed/advanced by a concurrent path; safe to ignore.
      }
    }
  }

  // ─── Lifecycle events for other services ───────────────────────────────────

  /**
   * Publish a lifecycle event without blocking the caller: a broker outage
   * must never delay a match start or a lobby action. Events are chained so
   * they reach the broker in the order the Game service decided them.
   */
  private queuePublish(task: () => Promise<boolean>): void {
    this.publishChain = this.publishChain
      .then(() => this.publishWithRetry(task))
      .catch((error) => console.error("[game] failed to publish a game lifecycle event", error));
  }

  /**
   * Retry an unconfirmed publish a few times. Delivery is best effort: there
   * is no transactional outbox, so an event the broker never confirms is lost
   * after the last attempt.
   */
  private async publishWithRetry(task: () => Promise<boolean>): Promise<void> {
    for (let attempt = 1; attempt <= PUBLISH_ATTEMPTS; attempt++) {
      if (await task()) return;
      if (attempt < PUBLISH_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, PUBLISH_RETRY_MS));
      }
    }
    console.error("[game] the broker did not confirm a game lifecycle event");
  }

  /**
   * Announce a started match. The event carries only public match facts; the
   * Game database stays the single source of truth for anything else.
   */
  private async publishMatchStarted(matchId: string, roomCode: string | null): Promise<boolean> {
    if (!this.events) return false;
    const match = await this.matchStore.load(matchId);
    if (!match) return false;
    return this.events.publishMatchStarted({
      matchId,
      mode: match.mode,
      roomCode,
      participants: match.participants.map((participant) => ({
        userId: participant.userId,
        sideId: participant.sideId,
      })),
    });
  }

  /**
   * Announce a finished match. Runs after the engine committed the terminal
   * state, so the persisted record is the authority for scores and forfeit.
   */
  private async publishMatchEnded(matchId: string, result: string | undefined): Promise<boolean> {
    if (!this.events) return false;
    const match = await this.matchStore.load(matchId);
    if (!match || match.roundPhase !== "MATCH_COMPLETE") return false;

    const totalFor = (sideId: string) =>
      match.rounds.reduce((total, round) => total + (round.counted[sideId]?.score ?? 0), 0);
    const totals = new Map<string, number>();
    for (const participant of match.participants) {
      totals.set(participant.sideId, totalFor(participant.sideId));
    }
    const opponentTotal = (sideId: string) => {
      const other = match.participants.find((participant) => participant.sideId !== sideId);
      return other ? (totals.get(other.sideId) ?? 0) : 0;
    };

    const participants = match.participants.map((participant) => {
      const score = totals.get(participant.sideId) ?? 0;
      const against = opponentTotal(participant.sideId);
      const outcome: "win" | "loss" | "draw" = match.forfeit
        ? match.forfeit.winner === participant.sideId
          ? "win"
          : "loss"
        : score > against
          ? "win"
          : score < against
            ? "loss"
            : "draw";
      return { userId: participant.userId, sideId: participant.sideId, outcome, score };
    });

    return this.events.publishMatchEnded({
      matchId,
      mode: match.mode,
      participants,
      forfeit: match.forfeit
        ? { winnerSideId: match.forfeit.winner, loserSideId: match.forfeit.loser, reason: match.forfeit.reason }
        : null,
      endedBecause: match.forfeit ? "forfeit" : result === "deadline" ? "deadline" : "completed",
    });
  }

  /**
   * Announce that a challenge will not produce a match. Returns whether the
   * broker confirmed the event; an unconfirmed event is not remembered, so it
   * is published again later.
   */
  private async publishChallengeCancelled(
    roomCode: string,
    reason: "room-closed" | "expired",
    participantUserIds: string[],
  ): Promise<boolean> {
    if (!this.events) return false;
    return this.events.publishChallengeCancelled({ roomCode, reason, participantUserIds });
  }

  /**
   * Announce challenges whose invite window closed without a match.
   *
   * The listing is paged, so every expired challenge is reached instead of
   * the first page only. A challenge is only remembered once the broker
   * confirmed its notification; an unconfirmed one is retried by the next
   * sweep.
   */
  async sweepExpiredChallenges(): Promise<void> {
    if (!this.events) return;
    const now = Date.now();
    let cursor: ExpiredRoomCursor | undefined;
    for (;;) {
      const page = await this.lobbyStore.listExpiredOpenRooms(now, cursor);
      for (const room of page.rooms) {
        if (this.cancelledChallengeCodes.has(room.room.code)) continue;
        const published = await this.publishChallengeCancelled(
          room.room.code,
          "expired",
          room.members.map((member) => member.userId),
        );
        if (published) this.rememberCancelledChallenge(room.room.code);
      }
      cursor = page.nextCursor ?? undefined;
      if (!cursor) break;
    }
  }

  /**
   * Remember a confirmed cancellation. The guard is bounded: dropping the
   * oldest code only costs one redundant publish, and the Chat service
   * ignores a repeated notification for the same challenge.
   */
  private rememberCancelledChallenge(roomCode: string): void {
    this.cancelledChallengeCodes.add(roomCode);
    while (this.cancelledChallengeCodes.size > 1000) {
      const oldest = this.cancelledChallengeCodes.values().next();
      if (oldest.done) break;
      this.cancelledChallengeCodes.delete(oldest.value);
    }
  }
}
