import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
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
    private runtimeState: "starting" | "ready" | "stopping" | "lost" | "closed" = "starting";

  private initStarted = false;

  private lossError?: Error;

  private stopPromise?: Promise<void>;

  private readonly shutdown = new AbortController();

  private readonly lossListeners = new Set<(error: Error) => void>();

  private disposeEngineEvents?: () => void;

  private readonly lobbyDisposers = new Set<() => void>();

  get shutdownSignal(): AbortSignal { return this.shutdown.signal; }

  get runtimeReady(): boolean {
    return this.runtimeState === "ready" && !this.shutdown.signal.aborted
      && (!this.stores || this.stores.runtimeActive);
  }

  assertServing(): void {
    if (!this.runtimeReady) throw new ServiceUnavailableException("Game runtime unavailable");
  }

  onRuntimeLoss(listener: (error: Error) => void): () => void {
    this.lossListeners.add(listener);
    if (this.lossError) this.deliverLoss(listener, this.lossError);
    return () => { this.lossListeners.delete(listener); };
  }

  private deliverLoss(listener: (error: Error) => void, error: Error): void {
    try { listener(error); }
    catch { console.error("[game] runtime loss listener failed"); }
  }

  private loseRuntime(error: Error): void {
    if (this.lossError || this.runtimeState === "closed") return;
    this.lossError = error; this.runtimeState = "lost";
    this.stopLocalWork();
    for (const listener of this.lossListeners) this.deliverLoss(listener, error);
    void this.stop().catch(() => console.error("[game] storage close failed"));
  }

  private stopLocalWork(): void {
    this.shutdown.abort(this.lossError ?? new Error("Game runtime stopped"));
    if (this.graceTimer) clearInterval(this.graceTimer);
    if (this.deadlineTimer) clearInterval(this.deadlineTimer);
    this.graceTimer = undefined; this.deadlineTimer = undefined;
    this.pendingAutoReveals.clear();
    this.matchSocketPresence.stop();
    this.disposeEngineEvents?.(); this.disposeEngineEvents = undefined;
    for (const dispose of this.lobbyDisposers) dispose();
    this.lobbyDisposers.clear(); this.listeners.clear();
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    // Cancellation listeners can call stop synchronously.
    this.stopPromise = new Promise<void>((done, failed) => { resolve = done; reject = failed; });
    if (!this.lossError) this.runtimeState = "stopping";
    let localError: unknown;
    try { this.stopLocalWork(); } catch (error) { localError = error; }
    try {
      const storage = this.stores?.close() ?? Promise.resolve();
      void storage.then(() => {
        this.runtimeState = "closed";
        if (localError) reject(localError); else resolve();
      }, (error) => { this.runtimeState = "closed"; reject(error); });
    } catch (error) { this.runtimeState = "closed"; reject(error); }
    return this.stopPromise;
  }

  private assertStartingOwner(): void {
    if (this.runtimeState !== "starting" || this.shutdown.signal.aborted)
      throw this.lossError ?? new Error("Game startup canceled");
    this.stores?.assertRuntimeActive();
  }

  private engine!: ArenaEngine;
  private stores?: PostgresStores;
  private lobbyStore!: ILobbyStore;
  private lobby!: Lobby;
  private readonly listeners = new Set<(event: string, matchId: string, payload: unknown) => void>();
  private readonly evaluationTelemetry = new InMemoryEvaluationTelemetry();
  private readonly matchSocketPresence: MatchSocketPresence;
  private graceTimer?: NodeJS.Timeout;
  private deadlineTimer?: NodeJS.Timeout;
  private readonly pendingAutoReveals = new Map<string, { userId: string }>();

  constructor() {
    this.matchSocketPresence = new MatchSocketPresence({
      participantSide: (userId, matchId) => {
        this.assertServing(); return this.engine.participantSide(userId, matchId);
      },
      modeOf: (matchId) => { this.assertServing(); return this.engine.modeOf(matchId); },
      setPresence: async (matchId, side, presence) => {
        this.assertServing(); await this.engine.setPresence(matchId, side, presence);
      },
      setMemberPresence: async (matchId, userId, presence) => {
        this.assertServing(); await this.engine.setMemberPresence(matchId, userId, presence);
      },
    });

  }

  onEvent(listener: (event: string, matchId: string, payload: unknown) => void): () => void {
    if (this.shutdown.signal.aborted) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  onLobbyEvent(listener: (event: string, payload: unknown) => void): () => void {
    if (this.shutdown.signal.aborted) return () => {};
    const remove = this.lobby.on((event, payload) => {
      if (this.runtimeReady) listener(event, payload);
    });
    const dispose = () => { remove(); this.lobbyDisposers.delete(dispose); };
    this.lobbyDisposers.add(dispose);
    return dispose;
  }

  private async initStorage(): Promise<MatchPersistence> {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      this.stores = new PostgresStores(databaseUrl); // required mode, no bypass
      await this.stores.acquireRuntime({ onLost: (error) => this.loseRuntime(error) });
      this.assertStartingOwner();
      await this.stores.ensureSchema();
      this.assertStartingOwner();
      this.lobbyStore = this.stores.lobby;
      return this.stores.persistence;
    }
    if (process.env.DEV_PRINCIPAL !== "true") {
      throw new Error("DATABASE_URL is required unless DEV_PRINCIPAL=true");
    }
    const matches = new InMemoryMatchStore();
    this.lobbyStore = new InMemoryLobbyStore(undefined, undefined, matches);
    return new StoreBackedMatchPersistence({
      matches,
      submissions: new InMemorySubmissionStore(),
      reveals: new InMemoryRevealStore(),
      collab: new InMemoryCollabPersist(),
    });
  }

  private wireEngineEvents(): () => void {
    return this.engine.on((event, payload) => {
      const matchId = (payload as { matchId?: string } | null)?.matchId;
      if (!this.runtimeReady || typeof matchId !== "string" || !matchId) return;
      for (const listener of this.listeners) {
        if (!this.runtimeReady) return;
        try {
          listener(event, matchId, payload);
        } catch (error) {
          console.error(`[game] live event listener failed for ${event}:`, error);
        }
      }
    });
  }

  private startPeriodicTimers(): void {
    this.deadlineTimer = setInterval(() => {
      if (!this.runtimeReady) return;
      void this.engine.sweepExpiredMatches().catch(() => {});
      for (const [matchId, pending] of this.pendingAutoReveals) {
        if (!this.runtimeReady) return;
        void this.maybeAutoReveal(pending.userId, matchId).catch(() => {});
      }
    }, 1000);
    this.deadlineTimer.unref();

    this.graceTimer = setInterval(() => {
      if (!this.runtimeReady) return;
      void this.engine.sweepGrace().catch(() => {});
      for (const mode of ["1v1", "2v2"] as const) {
        if (!this.runtimeReady) return;
        void this.triggerMatchmaking(mode).catch((error) => {
          if (this.runtimeReady) console.error("[lobby] matcher retry failed", error);
        });
      }
    }, 10000);
    this.graceTimer.unref();
  }

  async onModuleInit(): Promise<void> {
    if (this.initStarted || this.runtimeState !== "starting") {
      throw new Error("Game runtime cannot start twice");
    }
    this.initStarted = true;
    try {
      const persistence = await this.initStorage();
      this.assertStartingOwner();
      this.engine = new ArenaEngine({
        judge: createGameJudge(process.env, this.shutdownSignal),
        bank: new FileBank(),
        persistence,
        telemetry: this.evaluationTelemetry,
        reconnectGraceMs: Number(process.env.RECONNECT_GRACE_MS ?? 90000),
      });
      this.lobby = new Lobby({
        store: this.lobbyStore,
        createMatch: (input, save) => this.engine.createMatch(input, save),
        availableProblems: ["even-ledger", "double-it"],
      });
      this.disposeEngineEvents = this.wireEngineEvents();
      const recovered = await this.engine.recover();
      this.assertStartingOwner();
      console.log(`[game] boot recovery: ${recovered.matches} matches, ${recovered.retried} retried, ${recovered.failed} failed`);
      this.runtimeState = "ready";
      this.startPeriodicTimers();
    } catch (error) {
      void this.stop().catch(() => console.error("[game] startup cleanup failed"));
      throw error;
    }
  }

  onModuleDestroy(): Promise<void> { return this.stop(); }

  get inner(): ArenaEngine {
    return this.engine;
  }

  principalFor(userId: string): AuthenticatedPrincipal {
    // DEV-ONLY: the real auth middleware supplies this (see principal.ts).
    return testPrincipal(userId);
  }

  async sideOf(userId: string, matchId: string): Promise<string> {
    this.assertServing();
    return this.engine.participantSide(userId, matchId);
  }

  async modeOf(matchId: string) {
    this.assertServing();
    return this.engine.modeOf(matchId);
  }

  /**
   * Socket open for (user, match): first socket flips presence online.
   * Membership is verified via participantSide — strangers throw here and the
   * gateway must refuse the room (unauthorized join stays refused). 2v2 uses
  * per-member presence (two members share one side); 1v1 keeps side presence.
  */
  async noteSocketOpen(userId: string, matchId: string, socketId: string): Promise<string> {
    this.assertServing();
    return this.matchSocketPresence.noteSocketOpen(userId, matchId, socketId);
  }

  /** Socket close: presence goes offline only when its last socket drops. */
  async noteSocketClosed(userId: string, matchId: string, socketId: string): Promise<void> {
    await this.matchSocketPresence.noteSocketClosed(userId, matchId, socketId);
  }

  async leave(userId: string, matchId: string) {
    this.assertServing();
    return this.engine.leaveMatch(this.principalFor(userId), matchId);
  }

  async createMatch(input: { mode: "1v1" | "2v2"; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }): Promise<{ matchId: string }> {
    this.assertServing();
    const matchId = await this.engine.createMatch(input);
    return { matchId };
  }

  async snapshot(userId: string, matchId: string) {
    this.assertServing();
    return this.engine.snapshot(this.principalFor(userId), matchId);
  }

  async startRound(userId: string, matchId: string) {
    this.assertServing();
    await this.engine.startRound(this.principalFor(userId), matchId);
    return { ok: true as const };
  }

  async beginCoding(userId: string, matchId: string) {
    this.assertServing();
    await this.engine.beginCoding(this.principalFor(userId), matchId);
    return { ok: true as const };
  }

  async run(userId: string, matchId: string, input: { code: string; language: string }) {
    this.assertServing();
    return this.engine.run(this.principalFor(userId), matchId, input);
  }

  async submit(userId: string, matchId: string, input: { code: string; language: string; submissionId?: string; evaluationId?: string; documentRevision?: number }) {
    this.assertServing();
    const receipt = await this.engine.submit(this.principalFor(userId), matchId, input);
    // Reveal condition (game-owned): every side counted -> publish.
    // Fire-and-forget: publish errors never fail the accepted submission.
    if (this.runtimeReady) void this.maybeAutoReveal(userId, matchId).catch(() => {});
    return receipt;
  }

  /**
   * 2v2 readiness (per-player, revision-bound). The engine resolves the team
   * from the principal; a player can only ever mark themselves.
   */
  async setReady(userId: string, matchId: string, input: { ready: boolean; documentRevision?: number }) {
    this.assertServing();
    await this.engine.setReady(this.principalFor(userId), matchId, input);
    return { ok: true as const };
  }

  /**
   * Ticket 15 production ingress: real Yjs update frames. DEV-ONLY
   * notifyDocChanged below stays for ticket-14 tests; production clients use
   * the collab socket, which lands here after namespace authorization.
   */
  async applyCollabUpdate(userId: string, matchId: string, input: { roundId: string; updateB64: string }) {
    this.assertServing();
    return this.engine.applyCollabUpdate(this.principalFor(userId), matchId, input);
  }

  /** Join/sync baseline for the caller's current team document (read-only). */
  async collabSync(userId: string, matchId: string) {
    this.assertServing();
    return this.engine.collabSync(this.principalFor(userId), matchId);
  }

  /** Team-owned language switch (2v2): re-homes the doc + invalidates readiness. */
  async setTeamLanguage(userId: string, matchId: string, language: string) {
    this.assertServing();
    const revision = await this.engine.setTeamLanguage(this.principalFor(userId), matchId, language);
    return { ok: true as const, revision };
  }

  /** Ticket 16: authoritative 2v2 team chat context resolution. */
  async resolveTeamChatContext(userId: string, matchId: string) {
    this.assertServing();
    return this.engine.resolveTeamChatContext(this.principalFor(userId), matchId);
  }

  async advance(userId: string, matchId: string) {
    this.assertServing();
    await this.engine.nextRound(this.principalFor(userId), matchId);
    return { ok: true as const };
  }

  async final(userId: string, matchId: string) {
    this.assertServing();
    return this.engine.finalResult(this.principalFor(userId), matchId);
  }

  // ─── Ticket 04: Lobby and Matchmaking ──────────────────────────────────────

  async joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry> {
    this.assertServing();
    return this.lobby.joinQueue(userId, mode);
  }

  async cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    this.assertServing();
    return this.lobby.cancelQueue(userId);
  }

  async queueStatus(userId: string): Promise<QueueEntry | null> {
    this.assertServing();
    return this.lobby.queueStatus(userId);
  }

  async triggerMatchmaking(mode: MatchMode): Promise<{ matchId: string; entries: QueueEntry[] } | null> {
    this.assertServing();
    return this.lobby.triggerMatchmaking(mode);
  }

  async createPrivateRoom(userId: string, mode: MatchMode): Promise<RoomWithMembers> {
    this.assertServing();
    return this.lobby.createPrivateRoom(userId, mode);
  }

  async joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }> {
    this.assertServing();
    return this.lobby.joinPrivateRoom(userId, inviteCode);
  }

  async leavePrivateRoom(userId: string, roomId: string): Promise<{ left: boolean; closed: boolean }> {
    this.assertServing();
    return this.lobby.leavePrivateRoom(userId, roomId);
  }

  async setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    this.assertServing();
    return this.lobby.setRoomMemberSide(userId, roomId, sideId);
  }

  async setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers> {
    this.assertServing();
    return this.lobby.setRoomMemberReady(userId, roomId, ready);
  }

  async startPrivateRoom(userId: string, roomId: string): Promise<{ matchId: string }> {
    this.assertServing();
    return this.lobby.startPrivateRoom(userId, roomId);
  }

  async roomForMember(userId: string, roomId: string): Promise<RoomWithMembers> {
    this.assertServing();
    return this.lobby.roomForMember(userId, roomId);
  }

  async getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null> {
    this.assertServing();
    return this.lobby.getRoomWithMembers(roomId);
  }

  async userActiveRoom(userId: string): Promise<RoomWithMembers | null> {
    this.assertServing();
    return this.lobby.userActiveRoom(userId);
  }

  private async maybeAutoReveal(userId: string, matchId: string): Promise<void> {
    this.assertServing();
    const pending = { userId }; this.pendingAutoReveals.set(matchId, pending);
    const clear = () => {
      if (this.pendingAutoReveals.get(matchId) === pending) this.pendingAutoReveals.delete(matchId);
    };
    const principal = this.principalFor(userId);
    const snapshot = await this.engine.snapshot(principal, matchId);
    this.assertServing();
    if (snapshot.roundPhase !== "CODING") { clear(); return; }
    const sides = await this.engine.roundSides(principal, matchId);
    this.assertServing();
    const counted = await this.engine.roundCountedSides(principal, matchId);
    this.assertServing();
    if (sides.length > 0 && counted.length >= sides.length)
      await this.engine.publishReveal(principal, matchId, { graceMs: 1500 });
    clear();
  }
}
