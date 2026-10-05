import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ArenaEngine,
  RateLimitedError,
  testPrincipal,
  type AuthenticatedPrincipal,
} from "arena-game-engine";
import {
  PostgresStores,
  StoreBackedMatchPersistence,
  inMemoryPersistence,
  InMemoryMatchStore,
  InMemorySubmissionStore,
  InMemoryRevealStore,
  InMemoryCollabPersist,
  type MatchPersistence,
} from "arena-game-engine/persistence";
import {
  Lobby,
  InMemoryLobbyStore,
  type ILobbyStore,
  type LobbySideId,
  type PrivateRoom,
  type PrivateRoomMember,
  type QueueEntry,
  type RoomWithMembers,
} from "arena-game-engine/lobby";
import { FileBank } from "arena-game-engine/judge";
import { InMemoryEvaluationTelemetry } from "arena-game-engine/evaluation-orchestration";
import type { MatchMode } from "arena-model";
import { MatchSocketPresence } from "./match-socket-presence.js";
import { createGameJudge } from "./judge-factory.js";

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
  private lobbyStore!: ILobbyStore;
  private lobby!: Lobby;
  private readonly listeners = new Set<(event: string, matchId: string, payload: unknown) => void>();
  private readonly evaluationTelemetry = new InMemoryEvaluationTelemetry();
  private readonly matchSocketPresence: MatchSocketPresence;
  private graceTimer?: NodeJS.Timeout;
  private deadlineTimer?: NodeJS.Timeout;

  constructor() {
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
    return this.lobby.on(listener as any);
  }

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    let persistence: MatchPersistence;
    if (databaseUrl) {
      this.stores = new PostgresStores(databaseUrl);
      await this.stores.ensureSchema();
      persistence = this.stores.persistence;
      this.lobbyStore = this.stores.lobby;
    } else {
      const matches = new InMemoryMatchStore();
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
    this.lobby = new Lobby({
      store: this.lobbyStore,
      createMatch: (input, save) => this.engine.createMatch(input, save),
      availableProblems: ["even-ledger", "double-it"],
    });
    this.engine.on((event, payload) => {
      const matchId = (payload as { matchId?: string } | null)?.matchId;
      if (typeof matchId === "string" && matchId) {
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
  }

  async onModuleDestroy(): Promise<void> {
    if (this.graceTimer) clearInterval(this.graceTimer);
    if (this.deadlineTimer) clearInterval(this.deadlineTimer);
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

  // ─── Ticket 04: Lobby and Matchmaking ──────────────────────────────────────

  async joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry> {
    return this.lobby.joinQueue(userId, mode);
  }

  async cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    return this.lobby.cancelQueue(userId);
  }

  async queueStatus(userId: string): Promise<QueueEntry | null> {
    return this.lobby.queueStatus(userId);
  }

  async triggerMatchmaking(mode: MatchMode): Promise<{ matchId: string; entries: QueueEntry[] } | null> {
    return this.lobby.triggerMatchmaking(mode);
  }

  async createPrivateRoom(userId: string, mode: MatchMode): Promise<RoomWithMembers> {
    return this.lobby.createPrivateRoom(userId, mode);
  }

  async joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }> {
    return this.lobby.joinPrivateRoom(userId, inviteCode);
  }

  async leavePrivateRoom(userId: string, roomId: string): Promise<{ left: boolean; closed: boolean }> {
    return this.lobby.leavePrivateRoom(userId, roomId);
  }

  async setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    return this.lobby.setRoomMemberSide(userId, roomId, sideId);
  }

  async setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers> {
    return this.lobby.setRoomMemberReady(userId, roomId, ready);
  }

  async startPrivateRoom(userId: string, roomId: string): Promise<{ matchId: string }> {
    return this.lobby.startPrivateRoom(userId, roomId);
  }

  async roomForMember(userId: string, roomId: string): Promise<RoomWithMembers> {
    return this.lobby.roomForMember(userId, roomId);
  }

  async getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null> {
    return this.lobby.getRoomWithMembers(roomId);
  }

  async userActiveRoom(userId: string): Promise<RoomWithMembers | null> {
    return this.lobby.userActiveRoom(userId);
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
}
