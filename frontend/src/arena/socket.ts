import { io, type Socket } from "socket.io-client";
import { monotonicNow } from "./clock.js";
import { TransportSession, type ArenaTransport, type ConnectionState, type RunReceipt, type SubmitReceipt } from "./transport.js";
import type { ArenaSnapshot, MatchFinalView, RevealView, SideView, TeamView } from "./types.js";

export interface SocketTransportOptions {
  baseUrl: string;
  userId: string;
  matchId: string;
}

/** Shared-session wiring: Bearer HTTP + token handshake, stable transport. */
export interface SocketAuthContext {
  apiBase: string;
  socketBase: string;
  matchId: string;
  getAccessToken: () => string | null;
  /** Renew the session (shared client restore), then the transport re-attaches. */
  onAuthExpired: () => Promise<unknown>;
}

export type SocketArenaTransportOptions = SocketTransportOptions | SocketAuthContext;

function isAuthContext(options: SocketArenaTransportOptions): options is SocketAuthContext {
  return typeof (options as SocketAuthContext).getAccessToken === "function";
}

/** A command lost its auth (or its ack): renewed, reconnected, never resent. Reconcile via snapshot. */
export class AuthExpiredError extends Error {
  readonly code = 401;

  constructor(message = "Session renewed. The action was not resent — check the latest snapshot before retrying.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

/** Best-effort JWT exp read for proactive renewal (undecodable → skip). */
function tokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(typeof atob === "function" ? atob(payload.replace(/-/g, "+").replace(/_/g, "/")) : "");
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Renew while the token still works: the server checks expiresAt > Date.now(). */
const RENEW_SKEW_MS = 30_000;

/** A non-idempotent command was rejected against a newer Match snapshot. */
export class StaleCommandError extends Error {
  readonly code = 409;

  constructor(message: string) {
    super(message);
    this.name = "StaleCommandError";
  }
}

/** Server RevealSnapshot (game-owned): per-side scores/groups/totals. Never rendered directly. */
export interface ServerReveal {
  round: number;
  roundId: string;
  scores: Record<string, number>;
  groups: Record<string, Array<{ name: string; weight: number; earned: number }>>;
  totals: Record<string, number>;
  publishedAt: number;
}

interface ServerSnapshot {
  mode: "1v1" | "2v2";
  roundPhase: ArenaSnapshot["roundPhase"];
  round: number;
  totalRounds: number;
  remainingMs: number;
  problem: Omit<ArenaSnapshot["problem"], "id"> & { id?: string; problemVersionId?: string };
  tests: ArenaSnapshot["tests"];
  mySide: string;
  sides: Record<string, { status: SideView["status"]; submissions: number; presence: SideView["presence"] }>;
  teams?: Array<{
    side: string;
    activity: SideView["status"];
    submissions: number;
    members: Array<{ userId: string; presence: SideView["presence"]; ready: boolean; readyRevision: number | null }>;
    documentRevision: number | null;
    language: string | null;
  }>;
  reveal: ServerReveal | null;
  revision: number;
  pendingEvaluation: boolean;
  final: {
    scores: Record<string, number>;
    outcome: "left" | "right" | "draw";
    winner: string | null;
    forfeit: { winner: string; loser: string; reason: string } | null;
  } | null;
}

/** Internal: a socket ack that never arrived (undefined or suppressed). */
class AuthLossSignal extends Error {
  constructor() {
    super("ack lost");
    this.name = "AuthLossSignal";
  }
}

/** Server terminal result -> viewer-relative final view (score sums + forfeit override). */
export function adaptFinal(
  final: ServerSnapshot["final"],
  mySide: string,
  otherId: string,
): MatchFinalView | null {
  const f = final;
  if (!f) return null;
  const you = f.scores?.[mySide] ?? 0;
  const opponent = f.scores?.[otherId] ?? 0;
  if (f.forfeit) {
    const outcome = f.forfeit.winner === mySide ? "You win by forfeit." : "Opponent wins by forfeit.";
    const departure = f.forfeit.reason === "leave"
      ? f.forfeit.loser === mySide ? "You forfeited." : "Opponent left the match."
      : null;
    return {
      you,
      opponent,
      outcome: departure ? `${outcome} ${departure}` : outcome,
    };
  }
  return {
    you,
    opponent,
    outcome:
      f.winner === null ? "The match is a draw." : f.winner === mySide ? "You win the match." : "Opponent wins the match.",
  };
}

/**
 * Stale-update guard (ticket 11 §3/§9): every refresh fetches current server
 * truth, so applying is normally safe; this drops only provably stale
 * responses (older revision than already applied) and skips fetches for
 * events from an older round than the applied snapshot.
 */
export function shouldApplyUpdate(
  applied: { revision: number; round: number },
  incoming: { revision?: number; round?: number },
): boolean {
  if (incoming.revision !== undefined && incoming.revision < applied.revision) return false;
  if (
    incoming.round !== undefined &&
    incoming.revision !== undefined &&
    incoming.round < applied.round &&
    incoming.revision <= applied.revision
  )
    return false;
  return true;
}

/**
 * Merge a burst of refresh demands into one follow-up. Any untagged demand
 * (command reconciliation) wins because it must observe post-command truth;
 * otherwise the highest revision (then round) is retained.
 */
function mergeRefreshTrigger(
  current: { revision?: number; round?: number } | undefined,
  next: { revision?: number; round?: number } | undefined,
): { revision?: number; round?: number } | undefined {
  if (!current || !next) return undefined;
  const currentRevision = current.revision ?? Number.NEGATIVE_INFINITY;
  const nextRevision = next.revision ?? Number.NEGATIVE_INFINITY;
  if (nextRevision > currentRevision) return next;
  if (nextRevision < currentRevision) return current;
  return (next.round ?? 0) > (current.round ?? 0) ? next : current;
}

/**
 * Server RevealSnapshot -> client RevealView: pick the viewer's side for the
 * round score and group breakdown; totals become you/opponent. The server
 * shape (per-side maps) is never rendered directly — passing it through
 * crashes RoundScoreReveal (`groups.map is not a function`).
 */
export function adaptReveal(server: ServerReveal | null, mySide: string, otherId: string): RevealView | null {
  if (!server) return null;
  const mine = Array.isArray(server.groups?.[mySide]) ? server.groups[mySide] : [];
  return {
    roundScore: server.scores?.[mySide] ?? 0,
    groups: mine.map((g) => ({ name: g.name, weight: g.weight, earned: g.earned })),
    totals: { you: server.totals?.[mySide] ?? 0, opponent: server.totals?.[otherId] ?? 0 },
  };
}

/** Server SealedSnapshot -> client ArenaSnapshot (units, side views, 2v2 teams). */
function adapt(server: ServerSnapshot, language: string, userId: string, sampledAt: number): ArenaSnapshot {
  const mine = server.sides[server.mySide] ?? { status: "coding" as const, submissions: 0, presence: "online" as const };
  const otherId = Object.keys(server.sides).find((k) => k !== server.mySide) ?? "right";
  const other = server.sides[otherId] ?? mine;
  const remainingMs = Math.max(0, server.remainingMs);
  const you: SideView = { name: "You", status: mine.status, presence: mine.presence, submissions: mine.submissions };
  const opponent: SideView = { name: "Opponent", status: other.status, presence: other.presence, submissions: other.submissions };
  // 2v2: real team state (alpha = own team, beta = opponents). 1v1 keeps the
  // legacy shape with the readiness shim off.
  const ownTeam = server.teams?.find((t) => t.members.some((m) => m.userId === userId));
  const otherTeam = server.teams?.find((t) => t !== ownTeam);
  const toTeamView = (t: NonNullable<ServerSnapshot["teams"]>[number]): TeamView => ({
    id: t.side,
    members: [
      {
        name: t.members[0]?.userId ?? "?",
        status: t.activity,
        presence: t.members[0]?.presence ?? "offline",
        submissions: t.submissions,
      },
      {
        name: t.members[1]?.userId ?? "?",
        status: t.activity,
        presence: t.members[1]?.presence ?? "offline",
        submissions: t.submissions,
      },
    ],
    score: null,
    submissions: t.submissions,
  });
  const youRec = ownTeam?.members.find((m) => m.userId === userId);
  const mateRec = ownTeam?.members.find((m) => m.userId !== userId);
  return {
    mode: server.mode,
    roundPhase: server.roundPhase,
    round: server.round,
    totalRounds: server.totalRounds,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    clock: { remainingMs, sampledAt },
    problem: {
      ...server.problem,
      id: server.problem.id ?? server.problem.problemVersionId ?? "unknown-problem",
    },
    language: ownTeam?.language ?? language,
    tests: server.tests,
    you,
    opponent,
    alpha: ownTeam
      ? toTeamView(ownTeam)
      : {
          id: "alpha",
          members: [you, { name: "Mate", status: "coding", presence: "online", submissions: 0 }],
          score: null,
          submissions: you.submissions,
        },
    beta: otherTeam
      ? toTeamView(otherTeam)
      : {
          id: "beta",
          members: [opponent, { name: "Rival 2", status: "coding", presence: "online", submissions: 0 }],
          score: null,
          submissions: opponent.submissions,
        },
    ready: ownTeam
      ? { you: youRec?.ready === true, mate: mateRec?.ready === true }
      : { you: false, mate: false },
    docRevision: ownTeam?.documentRevision ?? null,
    readyRevision: ownTeam
      ? { you: youRec?.readyRevision ?? null, mate: mateRec?.readyRevision ?? null }
      : null,
    reveal: adaptReveal(server.reveal, server.mySide, otherId),
    notice: null,
    revision: server.revision ?? 0,
    matchFinal: adaptFinal(server.final, server.mySide, otherId),
  };
}

/**
 * SocketArenaTransport: the real transport behind the ArenaTransport seam.
 * Actions go over HTTP; the socket carries game-owned events, each of which
 * triggers a fresh authoritative snapshot fetch (never incremental patching).
 * Identity: DEV_PRINCIPAL seam (x-dev-user-id header + socket auth) until the
 * auth owner lands; see docs/auth-game-contract.md. No competitive values are
 * ever computed client-side.
 */
export class SocketArenaTransport implements ArenaTransport {
  private readonly socketBase: string;
  private readonly matchId: string;
  private readonly apiBase: string | null;
  private readonly getAccessToken: (() => string | null) | null;
  private readonly onAuthExpired: (() => Promise<unknown>) | null;
  /** Legacy DEV identity (x-dev-user-id seam) when no shared session exists. */
  private readonly devUserId: string | null;
  /** Player id: legacy option or resolved once from GET /accounts/me. */
  private userId: string | null;
  private userIdPromise: Promise<string> | null = null;
  private socket: Socket | null = null;
  /** Token the attached socket handshook with (rotation detector). */
  private attachedToken: string | null | undefined;
  private lifetime: AbortController | null = null;
  private connecting: Promise<void> | null = null;
  private snap: ArenaSnapshot | null = null;
  private readonly session = new TransportSession("connecting");
  private language = "Python";
  /** Latest authoritative team-doc revision (2v2 submit gate + setReady binding). */
  private lastDocRevision: number | null = null;
  /**
   * Keep one unconfirmed submit's identifiers across a lost HTTP response.
   * A successful submit clears this record, so a deliberate later resubmit
   * receives fresh ids and keeps the server's last-wins semantics.
   */
  private pendingSubmit: {
    key: string;
    submissionId: string;
    evaluationId: string;
  } | null = null;
  private connected = false;
  private connectError: string | null = null;
  /** Last applied server revision/round (§3 stale-drop). */
  private appliedRevision = -1;
  private appliedRound = 0;
  private reopening = false;
  private recovery: Promise<void> | null = null;
  private tokenRenewal: Promise<unknown> | null = null;
  private expiryRecovery: Promise<void> | null = null;
  /** Serial authoritative-snapshot loop: one in-flight fetch + one merged demand. */
  private refreshLoop: Promise<void> | null = null;
  private refreshDemand: {
    waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
    trigger?: { revision?: number; round?: number };
    lifetime: AbortController;
  } | null = null;
  private refreshEpoch = 0;
  /** Browser reported a network outage since the last baseline. */
  private browserOffline = false;

  constructor(options: SocketArenaTransportOptions) {
    if (isAuthContext(options)) {
      this.socketBase = options.socketBase;
      this.matchId = options.matchId;
      this.apiBase = options.apiBase;
      this.getAccessToken = options.getAccessToken;
      this.onAuthExpired = options.onAuthExpired;
      this.devUserId = null;
      this.userId = null;
    } else {
      if (!import.meta.env.DEV) throw new Error("Development Match identity is disabled in production");
      this.socketBase = options.baseUrl;
      this.matchId = options.matchId;
      this.apiBase = null;
      this.getAccessToken = null;
      this.onAuthExpired = null;
      this.devUserId = options.userId;
      this.userId = options.userId;
    }
  }

  get connectionError(): string | null {
    return this.connectError;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  connection(): ConnectionState {
    return this.session.connection();
  }

  scopeKey(): string {
    return `live:${this.socketBase}:${this.matchId}`;
  }

  /** Signed-in identity for local draft isolation. */
  playerId(): string | null {
    return this.userId;
  }

  /** Identity for the separate collaboration socket (2v2 team document). */
  collabConfig(): { baseUrl: string; userId: string; matchId: string; getAccessToken?: () => string | null } {
    return { baseUrl: this.socketBase, userId: this.requireUserId(), matchId: this.matchId, ...(this.getAccessToken ? { getAccessToken: this.getAccessToken } : {}) };
  }

  /** Identity for the separate team chat socket (2v2 team chat and quick pings). */
  chatConfig(): { baseUrl: string; userId: string; matchId: string; getAccessToken?: () => string | null } | null {
    if (this.snap?.mode !== "2v2") return null;
    return { baseUrl: this.socketBase, userId: this.requireUserId(), matchId: this.matchId, ...(this.getAccessToken ? { getAccessToken: this.getAccessToken } : {}) };
  }

  private requireUserId(): string {
    if (!this.userId) throw new Error("Player identity is not resolved yet");
    return this.userId;
  }

  private setConn(next: ConnectionState): void {
    if (this.session.setConnection(next)) this.session.notify();
  }

  connect(): Promise<void> {
    if (this.connecting) return this.connecting;
    if (this.connected) return Promise.resolve();
    this.stopConnection();
    const lifetime = new AbortController();
    this.lifetime = lifetime;
    this.connectError = null;
    this.setConn("connecting");
    this.wireBrowserSignals(lifetime);
    const connecting = (async () => {
      if (this.getAccessToken) {
        await this.ensureFreshToken();
        await this.ensureUserId(lifetime);
      }
      const snap = (await this.get("/snapshot", lifetime)) as ServerSnapshot;
      this.assertActive(lifetime);
      this.applySnapshot(snap);
      const socket = this.attachFreshSocket(lifetime);
      const baseline = this.awaitBaseline(socket, lifetime);
      socket.connect();
      await baseline;
    })().catch((error: Error) => {
      if (this.lifetime === lifetime && !lifetime.signal.aborted) {
        this.stopConnection();
        this.connectError = error.message;
        this.setConn("offline");
        this.emit();
      }
      throw error;
    }).finally(() => {
      if (this.connecting === connecting) this.connecting = null;
    });
    this.connecting = connecting;
    return connecting;
  }

  /** Browser network recovery rejoins the authorized room for a fresh baseline. */
  private async reopen(): Promise<void> {
    const lifetime = this.lifetime;
    if (!lifetime || this.connecting || this.connected || this.reopening || !this.socket) return;
    this.reopening = true;
    try {
      // Renewal already owns a fresh socket and its baseline wait.
      // Network recovery must join it instead of detaching that socket.
      if (this.recovery) await this.recovery;
      else await this.reattach(lifetime);
    } catch {
      if (this.lifetime === lifetime && !lifetime.signal.aborted) {
        this.connected = false;
        this.setConn("reconnecting");
      }
    } finally {
      if (this.lifetime === lifetime) {
        this.reopening = false;
        this.emit();
      }
    }
  }

  private async reattach(lifetime: AbortController): Promise<void> {
    this.detachSocket();
    this.browserOffline = false;
    this.setConn("connecting");
    const socket = this.attachFreshSocket(lifetime);
    const baseline = this.awaitBaseline(socket, lifetime);
    socket.connect();
    await baseline;
  }

  /**
   * Explicit renewal: a fresh socket in the SAME transport (never recreated
   * on rotation) with fresh baselines. Command state is preserved —
   * pendingSubmit keeps its ids, no command is resent.
   */
  renewSocket(): Promise<void> {
    if (this.recovery) return this.recovery;
    const lifetime = this.lifetime;
    if (!lifetime || lifetime.signal.aborted) return Promise.resolve();
    const recovery = (async () => {
      this.assertActive(lifetime);
      await this.reattach(lifetime);
      await this.refresh(undefined, lifetime);
    })().finally(() => {
      if (this.recovery === recovery) this.recovery = null;
    });
    this.recovery = recovery;
    return recovery;
  }

  /** 401 renews and reconciles but never replays the rejected command. */
  private async renewAfterAuthLoss(lifetime: AbortController): Promise<never> {
    if (this.onAuthExpired) await this.renewAuth();
    this.assertActive(lifetime);
    if (this.socket) await this.renewSocket();
    this.assertActive(lifetime);
    throw new AuthExpiredError();
  }

  private recoverExpiredSocket(lifetime: AbortController): Promise<void> {
    if (this.expiryRecovery) return this.expiryRecovery;
    const recovery = (async () => {
      // Server expiry is authoritative even when the browser clock is slow.
      // Reuse an already rotated token; otherwise refresh once from this signal.
      const token = this.getAccessToken?.();
      if (token && token === this.attachedToken) await this.renewAuth();
      this.assertActive(lifetime);
      if (!this.getAccessToken?.()) throw new AuthExpiredError();
      if (this.attachedToken !== this.getAccessToken()) await this.renewSocket();
      if (this.recovery) await this.recovery;
      this.assertActive(lifetime);
      this.requireConnected("Session recovery");
    })().catch((error: unknown) => {
      if (this.lifetime === lifetime && !lifetime.signal.aborted && !this.connected) {
        this.connectError = error instanceof Error ? error.message : "Session unavailable. Please try again.";
        this.setConn("offline");
        this.emit();
      }
      throw error;
    }).finally(() => {
      if (this.expiryRecovery === recovery) this.expiryRecovery = null;
    });
    this.expiryRecovery = recovery;
    return recovery;
  }

  private async prepareCommand(action: string): Promise<AbortController> {
    // A command already waiting for renewal may resume; disconnected lifetimes cannot.
    const lifetime = this.activeLifetime();
    if (this.expiryRecovery) await this.expiryRecovery;
    if (this.recovery) await this.recovery;
    else this.requireConnected(action);
    await this.ensureFreshToken();
    this.assertActive(lifetime);
    await this.ensureSocketToken(lifetime);
    if (this.recovery) await this.recovery;
    this.assertActive(lifetime);
    this.requireConnected(action);
    return lifetime;
  }

  private attachFreshSocket(lifetime: AbortController): Socket {
    this.assertActive(lifetime);
    const token = this.getAccessToken?.();
    this.attachedToken = token;
    const socket = io(this.socketBase, {
      auth: token ? { accessToken: token, matchId: this.matchId } : import.meta.env.DEV ? { userId: this.userId, matchId: this.matchId } : { matchId: this.matchId },
      forceNew: true,
      autoConnect: false,
    });
    this.socket = socket;
    const active = () => this.socket === socket && this.lifetime === lifetime && !lifetime.signal.aborted;
    for (const event of [
      "phase.changed",
      "player.statusChanged",
      "player.presenceChanged",
      "readiness.changed",
      "tests.updated",
      "reveal.published",
      "round.advanced",
      "match.clock",
      "match.ended",
    ]) {
      socket.on(event, (payload: unknown) => {
        if (!active()) return;
        const p = payload as { revision?: number; round?: number } | null;
        void this.refresh({ revision: p?.revision, round: p?.round }, lifetime).catch(() => {});
      });
    }
    // This handler survives reconnects; only a server baseline enables commands.
    socket.on("snapshot", (snapshot: ServerSnapshot) => {
      if (!active() || this.browserOffline) return;
      this.applySnapshot(snapshot);
      this.connected = true;
      this.connectError = null;
      this.setConn("connected");
      this.emit();
    });
    socket.on("disconnect", (reason: string) => {
      if (!active()) return;
      this.connected = false;
      this.setConn("reconnecting");
      this.emit();
      if (reason === "io server disconnect" && token) {
        void this.recoverExpiredSocket(lifetime).catch(() => {});
      }
    });
    socket.on("connect_error", (error: Error) => {
      if (!active()) return;
      this.connectError = error.message;
      this.connected = false;
      this.setConn("reconnecting");
      this.emit();
    });
    return socket;
  }

  private wireBrowserSignals(lifetime: AbortController): void {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    window.addEventListener("offline", () => {
      this.browserOffline = true;
      this.connected = false;
      this.setConn("reconnecting");
      this.emit();
    }, { signal: lifetime.signal });
    window.addEventListener("online", () => {
      const wasOffline = this.browserOffline;
      this.browserOffline = false;
      if (wasOffline || !this.socket?.connected) void this.reopen();
      else void this.refresh(undefined, lifetime).catch(() => {});
    }, { signal: lifetime.signal });
  }

  private awaitBaseline(socket: Socket, lifetime: AbortController): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        socket.off("snapshot", baseline);
        socket.off("connect_error", failed);
        socket.off("disconnect", denied);
        lifetime.signal.removeEventListener("abort", cancelled);
        if (error) reject(error);
        else resolve();
      };
      const baseline = () => finish();
      const failed = (error: Error) => {
        if (!socket.active) finish(error);
      };
      const denied = () => finish(new Error("Arena room refused"));
      const cancelled = () => finish(new Error("Arena connection cancelled"));
      const timer = setTimeout(() => finish(new Error("Arena connection timed out")), 10_000);
      socket.once("snapshot", baseline);
      socket.on("connect_error", failed);
      socket.once("disconnect", denied);
      lifetime.signal.addEventListener("abort", cancelled, { once: true });
    });
  }

  private detachSocket(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  private stopConnection(): void {
    this.lifetime?.abort();
    this.lifetime = null;
    this.detachSocket();
    this.connecting = null;
    this.connected = false;
    this.browserOffline = false;
    this.reopening = false;
    this.recovery = null;
    this.expiryRecovery = null;
    this.refreshEpoch += 1;
    this.refreshLoop = null;
    const pending = this.refreshDemand;
    this.refreshDemand = null;
    if (pending) for (const waiter of pending.waiters) waiter.reject(new Error("Arena connection cancelled"));
  }

  disconnect(): void {
    this.stopConnection();
    this.setConn("offline");
    this.emit();
  }

  private activeLifetime(): AbortController {
    const lifetime = this.lifetime;
    if (!lifetime) throw new Error("Arena is disconnected");
    this.assertActive(lifetime);
    return lifetime;
  }

  private assertActive(lifetime: AbortController): void {
    if (this.lifetime !== lifetime || lifetime.signal.aborted) throw new Error("Arena connection cancelled");
  }

  /** Player id from GET /accounts/me (Bearer); legacy options already carry it. */
  private ensureUserId(lifetime: AbortController): Promise<string> {
    if (this.userId) return Promise.resolve(this.userId);
    if (!this.userIdPromise) {
      this.userIdPromise = (async () => {
        const me = (await this.get("/accounts/me", lifetime, true)) as { id?: unknown };
        const id = typeof me?.id === "string" && me.id.length > 0 ? me.id : null;
        if (!id) throw new Error("Could not resolve the signed-in player");
        this.userId = id;
        return id;
      })().catch((error: Error) => {
        this.userIdPromise = null;
        throw error;
      });
    }
    return this.userIdPromise;
  }

  /** Proactive renewal: refresh while the token still verifies (30s skew). */
  private async ensureFreshToken(): Promise<void> {
    if (!this.getAccessToken || !this.onAuthExpired) return;
    const token = this.getAccessToken();
    if (!token) return;
    const expiry = tokenExpiryMs(token);
    if (expiry !== null && expiry - Date.now() < RENEW_SKEW_MS) await this.renewAuth();
  }

  private renewAuth(): Promise<unknown> {
    if (this.tokenRenewal) return this.tokenRenewal;
    const renewal = Promise.resolve().then(() => this.onAuthExpired?.()).finally(() => {
      if (this.tokenRenewal === renewal) this.tokenRenewal = null;
    });
    this.tokenRenewal = renewal;
    return renewal;
  }

  private authHeaders(): Record<string, string> {
    const token = this.getAccessToken?.();
    if (token) return { Authorization: `Bearer ${token}` };
    if (import.meta.env.DEV && this.devUserId) return { "x-dev-user-id": this.devUserId };
    return {};
  }

  /** Apply a fetched server snapshot unless provably stale (§3). */
  private applySnapshot(server: ServerSnapshot): boolean {
    const userId = this.userId ?? this.devUserId ?? "";
    if (!this.snap) {
      this.snap = adapt(server, this.language, userId, monotonicNow());
      this.appliedRevision = this.snap.revision;
      this.appliedRound = this.snap.round;
      this.lastDocRevision = this.snap.docRevision;
      return true;
    }
    if (server.revision !== undefined && server.revision < this.appliedRevision) return false;
    this.snap = adapt(server, this.language, userId, monotonicNow());
    this.appliedRevision = this.snap.revision;
    this.appliedRound = this.snap.round;
    this.lastDocRevision = this.snap.docRevision;
    return true;
  }

  snapshot(): ArenaSnapshot {
    if (!this.snap) throw new Error("not connected");
    // Fresh reference every call: connectivity-only transitions (offline →
    // reconnecting) carry no new game state but must still re-render.
    return { ...this.snap };
  }

  subscribe(listener: () => void): () => void {
    return this.session.subscribe(listener);
  }

  async startRound(): Promise<void> {
    const lifetime = await this.prepareCommand("start");
    await this.post("/start", {}, lifetime);
    await this.refreshAfterCommand(lifetime);
  }

  async beginCoding(): Promise<void> {
    const lifetime = await this.prepareCommand("begin");
    await this.post("/begin", {}, lifetime);
    await this.refreshAfterCommand(lifetime);
  }

  async setLanguage(language: string): Promise<void> {
    if (this.snap?.mode === "2v2") {
      // Authoritative team switch: bumps the doc revision and invalidates
      // both approvals server-side (the refresh carries the new revision).
      const lifetime = await this.prepareCommand("language");
      await this.post("/language", { language }, lifetime);
      await this.refreshAfterCommand(lifetime);
      return;
    }
    this.language = language;
    void this.refresh().catch(() => {});
  }

  async run(input: { code: string; language: string }): Promise<RunReceipt> {
    const lifetime = await this.prepareCommand("run");
    await this.post("/run", input, lifetime);
    await this.refreshAfterCommand(lifetime);
    return { ok: true };
  }

  async submit(input: { code: string; language: string; documentRevision?: number }): Promise<SubmitReceipt> {
    const lifetime = await this.prepareCommand("submit");
    const documentRevision = input.documentRevision ?? this.lastDocRevision ?? undefined;
    const request = this.submitRequest(input, documentRevision);
    const receipt = (await this.post("/submit", {
      ...input,
      documentRevision,
      submissionId: request.submissionId,
      evaluationId: request.evaluationId,
    }, lifetime)) as SubmitReceipt;
    if (this.pendingSubmit === request) this.pendingSubmit = null;
    await this.refreshAfterCommand(lifetime);
    return receipt;
  }

  /**
   * Revision-bound readiness (2v2): approves the latest authoritative
   * revision this client has seen. The server re-checks currency — a stale
   * approval throws and the snapshot (source of truth) corrects the UI.
   */
  async setReady(value: boolean): Promise<void> {
    const lifetime = await this.prepareCommand("setReady");
    await this.ensureSocketToken(lifetime);
    const sock = this.socket;
    if (!sock || lifetime.signal.aborted) throw new Error("Readiness confirmation was lost");
    const payload = { value, documentRevision: this.lastDocRevision ?? undefined };
    try {
      await new Promise<void>((resolve, reject) => {
        const cancelled = () => reject(new Error("Readiness confirmation was lost"));
        lifetime.signal.addEventListener("abort", cancelled, { once: true });
        sock.timeout(5_000).emit("setReady", payload, (error: Error | null, res?: { ok: boolean; error?: string }) => {
          lifetime.signal.removeEventListener("abort", cancelled);
          if (lifetime.signal.aborted || this.socket !== sock) reject(new Error("Readiness confirmation was lost"));
          else if (res?.ok) resolve();
          // A missing ack (or a timeout where the server suppressed the ack)
          // means auth/runtime loss — never a blind retry. The catch below
          // renews, reconnects, and throws so the UI reconciles via snapshot.
          else if (res === undefined || error) reject(new AuthLossSignal());
          else reject(new Error(res?.error ?? "setReady rejected"));
        });
      });
    } catch (error) {
      if (error instanceof AuthLossSignal && this.onAuthExpired && !lifetime.signal.aborted && this.socket === sock)
        return this.renewAfterAuthLoss(lifetime);
      throw error instanceof AuthLossSignal ? new Error("Readiness confirmation was lost") : error;
    }
  }

  /** Reattach when the session token moved on (renewal) since the socket was attached. */
  private async ensureSocketToken(lifetime: AbortController): Promise<void> {
    this.assertActive(lifetime);
    if (this.recovery) await this.recovery;
    if (!this.getAccessToken || !this.socket) return;
    if (this.getAccessToken() !== this.attachedToken) await this.renewSocket();
    else this.assertActive(lifetime);
  }

  async advance(): Promise<void> {
    const lifetime = await this.prepareCommand("advance");
    await this.post("/advance", {}, lifetime);
    await this.refreshAfterCommand(lifetime);
  }

  async leave(): Promise<void> {
    const lifetime = await this.prepareCommand("leave");
    await this.post("/leave", {}, lifetime);
    await this.refreshAfterCommand(lifetime);
  }

  private async refreshAfterCommand(lifetime: AbortController): Promise<void> {
    try {
      await this.refresh(undefined, lifetime);
    } catch {
      // The command receipt is confirmed. Only state recovery failed.
      if (this.lifetime !== lifetime || lifetime.signal.aborted) return;
      if (this.snap) this.snap = { ...this.snap, notice: "Action accepted; state refresh failed. Reconnecting…" };
      this.connected = false;
      this.setConn("reconnecting");
      this.emit();
      void this.reopen();
    }
  }

  private requireConnected(action: string): AbortController {
    const connection = this.session.connection();
    if (connection !== "connected") throw new Error(`${action} unavailable while ${connection}`);
    return this.activeLifetime();
  }

  private async refresh(trigger?: { revision?: number; round?: number }, lifetime = this.activeLifetime()): Promise<void> {
    if (
      trigger &&
      !shouldApplyUpdate(
        { revision: this.appliedRevision, round: this.appliedRound },
        trigger,
      )
    ) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      if (this.refreshDemand) {
        this.refreshDemand.waiters.push(waiter);
        this.refreshDemand.trigger = mergeRefreshTrigger(this.refreshDemand.trigger, trigger);
        this.refreshDemand.lifetime = lifetime;
        return;
      }
      this.refreshDemand = { waiters: [waiter], trigger, lifetime };
      if (!this.refreshLoop) {
        const epoch = ++this.refreshEpoch;
        this.refreshLoop = this.runRefreshLoop(epoch);
      }
    });
  }

  /**
   * Serial snapshot loop. A burst collapses into the fetch already in flight
   * plus one merged follow-up (highest revision wins); every caller resolves
   * only after the fetch that satisfies its demand completes. Untagged
   * demands (commands, 409 reconciliation, renewal) always follow the
   * in-flight fetch so a pre-command response can never masquerade as
   * post-command truth.
   */
  private async runRefreshLoop(epoch: number): Promise<void> {
    try {
      while (this.refreshEpoch === epoch && this.refreshDemand) {
        const demand = this.refreshDemand;
        this.refreshDemand = null;
        try {
          if (
            demand.trigger &&
            !shouldApplyUpdate(
              { revision: this.appliedRevision, round: this.appliedRound },
              demand.trigger,
            )
          ) {
            for (const waiter of demand.waiters) waiter.resolve();
            continue;
          }
          const snap = (await this.get("/snapshot", demand.lifetime)) as ServerSnapshot;
          this.assertActive(demand.lifetime);
          if (this.applySnapshot(snap)) this.emit();
          for (const waiter of demand.waiters) waiter.resolve();
        } catch (error) {
          for (const waiter of demand.waiters) waiter.reject(error);
        }
      }
    } finally {
      if (this.refreshEpoch === epoch) this.refreshLoop = null;
    }
  }

  private submitRequest(input: { code: string; language: string; documentRevision?: number }, documentRevision: number | undefined): {
    submissionId: string;
    evaluationId: string;
  } {
    const key = JSON.stringify([this.appliedRound, input.code, input.language, documentRevision ?? null]);
    if (this.pendingSubmit?.key === key) return this.pendingSubmit;

    this.pendingSubmit = {
      key,
      submissionId: this.requestId("submission"),
      evaluationId: this.requestId("evaluation"),
    };
    return this.pendingSubmit;
  }

  private requestId(prefix: string): string {
    const randomUuid = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : null;
    return `${prefix}-${randomUuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }

  private emit(): void {
    this.session.notify();
  }

  private async get(path: string, lifetime = this.activeLifetime(), apiBase = false): Promise<unknown> {
    this.assertActive(lifetime);
    const root = apiBase && this.apiBase ? this.apiBase : this.socketBase;
    const url = apiBase ? `${root}${path}` : `${root}/matches/${this.matchId}${path}`;
    const send = async (): Promise<Response> =>
      fetch(url, {
        headers: this.authHeaders(),
        signal: lifetime.signal,
      });
    let res = await send();
    this.assertActive(lifetime);
    if (res.status === 401 && this.onAuthExpired) {
      await this.onAuthExpired();
      this.assertActive(lifetime);
      res = await send();
      this.assertActive(lifetime);
      if (res.status === 401) throw new AuthExpiredError();
    }
    if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
    const payload = await res.json();
    this.assertActive(lifetime);
    return payload;
  }

  private async post(path: string, body: unknown, lifetime = this.activeLifetime()): Promise<unknown> {
    this.assertActive(lifetime);
    const res = await fetch(`${this.socketBase}/matches/${this.matchId}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
      signal: lifetime.signal,
    });
    this.assertActive(lifetime);
    if (res.status === 401 && this.onAuthExpired) return this.renewAfterAuthLoss(lifetime);
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        const conflict = new StaleCommandError(payload?.error ?? `${path} rejected against a newer Match revision`);
        await this.refresh(undefined, lifetime).catch(() => {});
        throw conflict;
      }
      throw new Error(payload?.error ?? `${path} failed with ${res.status}`);
    }
    const payload = await res.json();
    this.assertActive(lifetime);
    return payload;
  }
}
