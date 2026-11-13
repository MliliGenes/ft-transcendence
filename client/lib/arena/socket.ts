import { io, type Socket } from "socket.io-client";
import { TransportSession, type ArenaTransport, type ConnectionState, type RunReceipt, type SubmitReceipt } from "./transport";
import type { ArenaConnectionOptions, ArenaSnapshot, MatchFinalView, PlayerStatus, RevealView, SideView, TeamView } from "./types";

export type SocketTransportOptions = ArenaConnectionOptions;

/**
 * Minimum spacing between snapshot requests (ms).
 *
 * The gateway rate-limits per client IP, and every accepted collaboration edit
 * republishes readiness, so an uncoalesced event stream asks for a snapshot per
 * keystroke and the gateway answers 429.
 */
const SNAPSHOT_REFRESH_MIN_INTERVAL_MS = 1000;

/** Server hint about the newest snapshot (revision/round), when it carries one. */
interface SnapshotTrigger {
  revision?: number;
  round?: number;
}

/** A non-idempotent command was rejected against a newer Match snapshot. */
export class StaleCommandError extends Error {
  readonly code = 409;

  constructor(message: string) {
    super(message);
    this.name = "StaleCommandError";
  }
}

/** The gateway rate-limited the request (HTTP 429). */
export class RateLimitError extends Error {
  readonly code = 429;

  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
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
  sides: Record<string, { status: PlayerStatus; submissions: number; presence: SideView["presence"] }>;
  teams?: Array<{
    side: string;
    activity: PlayerStatus;
    submissions: number;
    members: Array<{
      userId: string | null;
      presence: SideView["presence"];
      ready: boolean;
      readyRevision: number | null;
      departed?: boolean;
      approvalRequired?: boolean | null;
      surrenderPending?: boolean;
    }>;
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
    const loserText = f.forfeit.reason === "surrender" ? "surrendered" : "forfeited";
    return {
      you,
      opponent,
      outcome: f.forfeit.winner === mySide ? `You win: opponent ${loserText}.` : `You ${loserText}.`,
    };
  }
  return {
    you,
    opponent,
    outcome:
      you > opponent ? "You win the match." : you < opponent ? "Opponent wins the match." : "The match is a draw.",
  };
}

/**
 * Stale-update guard: every refresh fetches current server truth, so applying
 * is normally safe; this drops only provably stale responses.
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

/** Server RevealSnapshot -> client RevealView */
export function adaptReveal(server: ServerReveal | null, mySide: string, otherId: string): RevealView | null {
  if (!server) return null;
  const mine = Array.isArray(server.groups?.[mySide]) ? server.groups[mySide] : [];
  return {
    roundScore: server.scores?.[mySide] ?? 0,
    groups: mine.map((g) => ({ name: g.name, weight: g.weight, earned: g.earned })),
    totals: { you: server.totals?.[mySide] ?? 0, opponent: server.totals?.[otherId] ?? 0 },
  };
}

/** Server SealedSnapshot -> client ArenaSnapshot */
function adapt(server: ServerSnapshot, language: string, userId: string): ArenaSnapshot {
  const mine = server.sides[server.mySide] ?? { status: "coding" as const, submissions: 0, presence: "online" as const };
  const otherId = Object.keys(server.sides).find((k) => k !== server.mySide) ?? "right";
  const other = server.sides[otherId] ?? mine;
  const you: SideView = { name: "You", status: mine.status, presence: mine.presence, submissions: mine.submissions };
  const opponent: SideView = { name: "Opponent", status: other.status, presence: other.presence, submissions: other.submissions };

  let ready: ArenaSnapshot["ready"] = { you: false, mate: false };
  let docRevision: number | null = null;
  let readyRevision: ArenaSnapshot["readyRevision"] = null;
  let surrender: ArenaSnapshot["surrender"] = { you: false, mate: false };

  let mateView: SideView = { name: "Teammate", status: "coding", presence: "online", submissions: 0 };
  let opponent2View: SideView = { name: "Opponent 2", status: "coding", presence: "online", submissions: 0 };

  if (server.mode === "2v2" && server.teams) {
    const myTeam = server.teams.find((t) => t.side === server.mySide);
    if (myTeam) {
      docRevision = myTeam.documentRevision;
      const youMember = myTeam.members.find((m) => m.userId === userId);
      const mateMember = myTeam.members.find((m) => m.userId !== userId);
      ready = {
        you: youMember?.ready === true,
        mate: mateMember?.approvalRequired === false || mateMember?.ready === true,
      };
      surrender = {
        you: youMember?.surrenderPending === true,
        mate: mateMember?.surrenderPending === true,
      };
      readyRevision = {
        you: youMember?.readyRevision ?? null,
        mate: mateMember?.readyRevision ?? null,
      };
      if (mateMember) {
        mateView = {
          name: mateMember.departed ? "Left" : mateMember.userId ? (mateMember.userId.length > 8 ? mateMember.userId.slice(0, 8) : mateMember.userId) : "Teammate",
          status: mateMember.departed ? "left" : mateMember.ready ? "ready" : (myTeam.activity ?? "coding"),
          presence: mateMember.presence ?? "online",
          submissions: myTeam.submissions ?? 0,
          departed: mateMember.departed,
        };
      }
    }
    const otherTeam = server.teams.find((t) => t.side === otherId);
    if (otherTeam && otherTeam.members.length > 1) {
      const opp2 = otherTeam.members[1];
      opponent2View = {
        name: opp2.userId ? (opp2.userId.length > 8 ? opp2.userId.slice(0, 8) : opp2.userId) : "Opponent 2",
        status: opp2.ready ? "ready" : (otherTeam.activity ?? "coding"),
        presence: opp2.presence ?? "online",
        submissions: otherTeam.submissions ?? 0,
      };
    }
  }

  const alpha: TeamView = {
    id: "alpha",
    members: [you, mateView],
    score: server.reveal?.totals[server.mySide] ?? null,
    submissions: mine.submissions,
  };
  const beta: TeamView = {
    id: "beta",
    members: [opponent, opponent2View],
    score: server.reveal?.totals[otherId] ?? null,
    submissions: other.submissions,
  };

  const problem = {
    id: server.problem.id ?? server.problem.problemVersionId ?? "unknown",
    title: server.problem.title,
    description: server.problem.description,
    examples: server.problem.examples,
    starters: server.problem.starters,
  };

  return {
    mode: server.mode,
    roundPhase: server.roundPhase,
    round: server.round,
    totalRounds: server.totalRounds,
    remainingSeconds: Math.max(0, Math.ceil(server.remainingMs / 1000)),
    problem,
    language,
    tests: server.tests,
    you,
    opponent,
    alpha,
    beta,
    ready,
    docRevision,
    readyRevision,
    surrender,
    reveal: adaptReveal(server.reveal, server.mySide, otherId),
    notice: null,
    revision: server.revision,
    matchFinal: adaptFinal(server.final, server.mySide, otherId),
  };
}

export class SocketArenaTransport implements ArenaTransport {
  private socket: Socket | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private currentSnapshot: ArenaSnapshot;
  private language = "C++";
  private appliedRevision = -1;
  private appliedRound = -1;
  private lastDocRevision: number | null = null;
  private pendingSubmit: { key: string; submissionId: string; evaluationId: string } | null = null;
  /** Snapshot requests queued or running: never more than one on the wire. */
  private snapshotRequests = 0;
  /** Serializes snapshot requests: the next one starts after the previous one. */
  private snapshotLane: Promise<void> = Promise.resolve();
  /** A refresh was asked for while another was running: it runs once, trailing. */
  private snapshotRefreshPending = false;
  /** Earliest moment the next snapshot request may start (ms). */
  private nextSnapshotAllowedAt = 0;
  private readonly session = new TransportSession("connecting");

  constructor(private readonly options: SocketTransportOptions) {
    this.currentSnapshot = {
      mode: "1v1",
      roundPhase: "ROUND_INTRO",
      round: 1,
      totalRounds: 3,
      remainingSeconds: 0,
      problem: { id: "loading", title: "Loading…", description: "", examples: [], starters: {} },
      language: this.language,
      tests: [],
      you: { name: "You", status: "coding", presence: "online", submissions: 0 },
      opponent: { name: "Opponent", status: "coding", presence: "online", submissions: 0 },
      alpha: { id: "alpha", members: [{ name: "You", status: "coding", presence: "online", submissions: 0 }, { name: "Teammate", status: "coding", presence: "online", submissions: 0 }], score: null, submissions: 0 },
      beta: { id: "beta", members: [{ name: "Opponent", status: "coding", presence: "online", submissions: 0 }, { name: "Opponent 2", status: "coding", presence: "online", submissions: 0 }], score: null, submissions: 0 },
      ready: { you: false, mate: false },
      docRevision: null,
      readyRevision: null,
      surrender: { you: false, mate: false },
      reveal: null,
      notice: null,
      revision: -1,
      matchFinal: null,
    };
    this.connect();
  }

  connection(): ConnectionState {
    return this.session.connection();
  }

  scopeKey(): string {
    return this.options.matchId;
  }

  collabConfig(): { baseUrl: string; userId: string; matchId: string; token?: string; socketPath?: string } | null {
    if (this.currentSnapshot.mode !== "2v2") return null;
    return {
      baseUrl: this.options.baseUrl,
      userId: this.options.userId,
      matchId: this.options.matchId,
      token: this.options.token,
      socketPath: this.options.socketPath,
    };
  }

  chatConfig(): { baseUrl: string; userId: string; matchId: string; token?: string; socketPath?: string } | null {
    if (this.currentSnapshot.mode !== "2v2") return null;
    return {
      baseUrl: this.options.baseUrl,
      userId: this.options.userId,
      matchId: this.options.matchId,
      token: this.options.token,
      socketPath: this.options.socketPath,
    };
  }

  fixtureControls(): null {
    return null;
  }

  snapshot(): ArenaSnapshot {
    return this.currentSnapshot;
  }

  subscribe(listener: () => void): () => void {
    return this.session.subscribe(listener);
  }

  disconnect(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.snapshotRefreshPending = false;
    this.socket?.disconnect();
    this.socket = null;
    this.session.setConnection("offline");
  }

  private connect(): void {
    const socketPath = this.options.socketPath ?? (this.options.baseUrl.includes("/api/game") ? "/api/game/socket.io" : "/socket.io");
    const auth: Record<string, unknown> = {
      userId: this.options.userId,
      matchId: this.options.matchId,
    };
    if (this.options.token) {
      auth.token = this.options.token;
    }

    const sock = io(this.options.baseUrl, {
      path: socketPath,
      auth,
      query: { userId: this.options.userId, matchId: this.options.matchId },
      transports: ["websocket", "polling"],
    });

    this.socket = sock;

    sock.on("connect", () => {
      if (this.session.setConnection("connected")) this.emit();
      void this.refreshNow().catch((error) => this.reportRefreshError(error));
    });

    sock.on("disconnect", () => {
      this.session.setConnection("reconnecting");
      this.emit();
    });

    sock.on("connect_error", () => {
      this.session.setConnection("offline");
      this.emit();
    });

    // onAny already receives every server packet ("readiness.changed",
    // "phase.changed", ...). A dedicated "match:event" listener on top of it
    // only doubled the refreshes for the same event.
    sock.onAny((_event: string, payload: unknown) => {
      this.scheduleRefresh(payload as SnapshotTrigger);
    });

    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.scheduleRefresh();
      }, 2000);
    }
  }

  private applySnapshot(snap: ServerSnapshot): boolean {
    if (!shouldApplyUpdate({ revision: this.appliedRevision, round: this.appliedRound }, snap)) {
      return false;
    }
    this.appliedRevision = snap.revision;
    this.appliedRound = snap.round;
    if (snap.mode === "2v2" && snap.teams) {
      const myTeam = snap.teams.find((t) => t.side === snap.mySide);
      if (myTeam?.language) this.language = myTeam.language;
      this.lastDocRevision = myTeam?.documentRevision ?? null;
    }
    this.currentSnapshot = adapt(snap, this.language, this.options.userId);
    return true;
  }

  async startRound(): Promise<void> {
    this.requireConnected("startRound");
    await this.post("/start-round", {});
    await this.refreshNow();
  }

  async beginCoding(): Promise<void> {
    this.requireConnected("beginCoding");
    await this.post("/begin-coding", {});
    await this.refreshNow();
  }

  async setLanguage(language: string): Promise<void> {
    if (this.currentSnapshot.mode === "2v2") {
      this.requireConnected("language");
      await this.post("/language", { language });
      await this.refreshNow();
      return;
    }
    this.language = language;
    void this.refreshNow().catch((error) => this.reportRefreshError(error));
  }

  async run(input: { code: string; language: string }): Promise<RunReceipt> {
    this.requireConnected("run");
    await this.post("/run", input);
    await this.refreshNow();
    return { ok: true };
  }

  async submit(input: { code: string; language: string; documentRevision?: number }): Promise<SubmitReceipt> {
    this.requireConnected("submit");
    const documentRevision = input.documentRevision ?? this.lastDocRevision ?? undefined;
    const request = this.submitRequest(input, documentRevision);
    const receipt = (await this.post("/submit", {
      ...input,
      documentRevision,
      submissionId: request.submissionId,
      evaluationId: request.evaluationId,
    })) as SubmitReceipt;
    await this.refreshNow();
    this.pendingSubmit = null;
    return receipt;
  }

  async setReady(value: boolean): Promise<void> {
    const sock = this.socket;
    if (!sock) return;
    const payload = { value, documentRevision: this.lastDocRevision ?? undefined };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("setReady timed out")), 5000);
      sock.emit("setReady", payload, (res: { ok: boolean; error?: string } | undefined) => {
        clearTimeout(timer);
        if (res?.ok) resolve();
        else reject(new Error(res?.error ?? "setReady rejected"));
      });
    });
  }

  async advance(): Promise<void> {
    this.requireConnected("advance");
    await this.post("/advance", {});
    await this.refreshNow();
  }

  async leave(): Promise<void> {
    this.requireConnected("leave");
    await this.post("/leave", {});
    await this.refreshNow();
  }

  async surrender(approve: boolean): Promise<void> {
    this.requireConnected("surrender");
    await this.post("/surrender", { approve });
    await this.refreshNow();
  }

  private requireConnected(action: string): void {
    const connection = this.session.connection();
    if (connection !== "connected") throw new Error(`${action} unavailable while ${connection}`);
  }

  /**
   * Ask for a snapshot refresh because the server announced a change.
   *
   * Bursts are coalesced: one request runs at a time, a burst collapses into a
   * single trailing request, and requests stay
   * SNAPSHOT_REFRESH_MIN_INTERVAL_MS apart. Without this, an accepted
   * keystroke (one "readiness.changed" per edit) becomes one snapshot request
   * per keystroke and the gateway answers 429.
   */
  private scheduleRefresh(trigger?: SnapshotTrigger): void {
    if (
      trigger &&
      !shouldApplyUpdate(
        { revision: this.appliedRevision, round: this.appliedRound },
        { revision: trigger.revision, round: trigger.round },
      )
    ) {
      return;
    }
    this.snapshotRefreshPending = true;
    this.pumpSnapshotRefresh();
  }

  /** Run the pending refresh as soon as the spacing window allows it. */
  private pumpSnapshotRefresh(): void {
    if (this.snapshotRequests > 0) return;
    if (!this.snapshotRefreshPending) return;
    const wait = this.nextSnapshotAllowedAt - Date.now();
    if (wait > 0) {
      if (!this.refreshTimer) {
        this.refreshTimer = setTimeout(() => {
          this.refreshTimer = null;
          this.pumpSnapshotRefresh();
        }, wait);
      }
      return;
    }
    this.snapshotRefreshPending = false;
    void this.enqueueSnapshotRequest().catch((error) => this.reportRefreshError(error));
  }

  /** Read server truth. Requests are serialized, so two never overlap. */
  private enqueueSnapshotRequest(): Promise<void> {
    this.snapshotRequests += 1;
    const start = () => {
      this.nextSnapshotAllowedAt = Date.now() + SNAPSHOT_REFRESH_MIN_INTERVAL_MS;
      return this.get("/snapshot");
    };
    const run = this.snapshotLane.then(start).then((raw) => {
      const snap = raw as ServerSnapshot;
      if (this.applySnapshot(snap)) this.emit();
    });
    const tracked = run.finally(() => {
      this.snapshotRequests -= 1;
      this.pumpSnapshotRefresh();
    });
    this.snapshotLane = tracked.catch(() => {});
    return tracked;
  }

  /**
   * Read server truth now (command paths): the caller has to see the effect of
   * the command it just sent, so it reads after whatever is already queued.
   */
  private async refreshNow(): Promise<void> {
    await this.snapshotLane;
    await this.enqueueSnapshotRequest();
  }

  /** Surface a failed background refresh instead of hiding it or rejecting late. */
  private reportRefreshError(error: unknown): void {
    const notice = error instanceof RateLimitError
      ? "Match updates are temporarily limited. Retrying automatically."
      : "Unable to sync the match. Retrying automatically.";
    if (this.currentSnapshot.notice === notice) return;
    this.currentSnapshot = { ...this.currentSnapshot, notice };
    this.emit();
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

  private async get(path: string): Promise<unknown> {
    const headers: Record<string, string> = { "x-dev-user-id": this.options.userId };
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`;
    const res = await fetch(`${this.options.baseUrl}/matches/${this.options.matchId}${path}`, { headers });
    if (!res.ok) {
      if (res.status === 429) throw new RateLimitError(`${path} failed with 429`);
      throw new Error(`${path} failed with ${res.status}`);
    }
    return res.json();
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-dev-user-id": this.options.userId,
    };
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`;

    const res = await fetch(`${this.options.baseUrl}/matches/${this.options.matchId}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        const conflict = new StaleCommandError(payload?.error ?? `${path} rejected against a newer Match revision`);
        await this.refreshNow().catch(() => {});
        throw conflict;
      }
      throw new Error(payload?.error ?? `${path} failed with ${res.status}`);
    }
    return res.json();
  }
}
