import { io, type Socket } from "socket.io-client";
import { TransportSession, type ArenaTransport, type ConnectionState, type RunReceipt, type SubmitReceipt } from "./transport";
import type { ArenaSnapshot, MatchFinalView, RevealView, SideView, TeamView } from "./types";

export interface SocketTransportOptions {
  baseUrl: string;
  userId: string;
  matchId: string;
  token?: string;
  socketPath?: string;
}

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
    return {
      you,
      opponent,
      outcome: f.forfeit.winner === mySide ? "You win by forfeit." : "Opponent wins by forfeit.",
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

  if (server.mode === "2v2" && server.teams) {
    const myTeam = server.teams.find((t) => t.side === server.mySide);
    if (myTeam) {
      docRevision = myTeam.documentRevision;
      const youMember = myTeam.members.find((m) => m.userId === userId);
      const mateMember = myTeam.members.find((m) => m.userId !== userId);
      ready = {
        you: youMember?.ready === true,
        mate: mateMember?.ready === true,
      };
      readyRevision = {
        you: youMember?.readyRevision ?? null,
        mate: mateMember?.readyRevision ?? null,
      };
    }
  }

  const alpha: TeamView = {
    id: "alpha",
    members: [you, { name: "Teammate", status: "coding", presence: "online", submissions: 0 }],
    score: server.reveal?.totals[server.mySide] ?? null,
    submissions: mine.submissions,
  };
  const beta: TeamView = {
    id: "beta",
    members: [opponent, { name: "Opponent 2", status: "coding", presence: "online", submissions: 0 }],
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
    reveal: adaptReveal(server.reveal, server.mySide, otherId),
    notice: null,
    revision: server.revision,
    matchFinal: adaptFinal(server.final, server.mySide, otherId),
  };
}

export class SocketArenaTransport implements ArenaTransport {
  private socket: Socket | null = null;
  private currentSnapshot: ArenaSnapshot;
  private language = "C++";
  private appliedRevision = -1;
  private appliedRound = -1;
  private lastDocRevision: number | null = null;
  private pendingSubmit: { key: string; submissionId: string; evaluationId: string } | null = null;
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
      this.session.setConnection("connected");
      void this.refresh();
    });

    sock.on("disconnect", () => {
      this.session.setConnection("reconnecting");
      this.emit();
    });

    sock.on("connect_error", () => {
      this.session.setConnection("offline");
      this.emit();
    });

    sock.on("match:event", (event: { revision?: number; round?: number }) => {
      void this.refresh(event);
    });
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
    await this.refresh();
  }

  async beginCoding(): Promise<void> {
    this.requireConnected("beginCoding");
    await this.post("/begin-coding", {});
    await this.refresh();
  }

  async setLanguage(language: string): Promise<void> {
    if (this.currentSnapshot.mode === "2v2") {
      this.requireConnected("language");
      await this.post("/language", { language });
      await this.refresh();
      return;
    }
    this.language = language;
    void this.refresh();
  }

  async run(input: { code: string; language: string }): Promise<RunReceipt> {
    this.requireConnected("run");
    await this.post("/run", input);
    await this.refresh();
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
    await this.refresh();
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
    await this.refresh();
  }

  async leave(): Promise<void> {
    this.requireConnected("leave");
    await this.post("/leave", {});
    await this.refresh();
  }

  private requireConnected(action: string): void {
    const connection = this.session.connection();
    if (connection !== "connected") throw new Error(`${action} unavailable while ${connection}`);
  }

  private async refresh(trigger?: { revision?: number; round?: number }): Promise<void> {
    if (
      trigger &&
      !shouldApplyUpdate(
        { revision: this.appliedRevision, round: this.appliedRound },
        { revision: trigger.revision, round: trigger.round },
      )
    ) {
      return;
    }
    const snap = (await this.get("/snapshot")) as ServerSnapshot;
    if (this.applySnapshot(snap)) this.emit();
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
    if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
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
        await this.refresh().catch(() => {});
        throw conflict;
      }
      throw new Error(payload?.error ?? `${path} failed with ${res.status}`);
    }
    return res.json();
  }
}
