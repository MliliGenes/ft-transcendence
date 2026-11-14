import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  type ArenaEvent,
  type MatchMode,
  type PlayerStatus,
  type RevealCause,
  type TeamChatAuthContext,
  canRun,
  canSideRun,
  canSideSubmit,
  canSideTransition,
  canSubmit,
} from "arena-model";
import {
  type DriverKind,
  type GameJudge,
  type JudgeLimits,
  SPIKE_LIMITS,
  type SupportedLanguage,
  JudgeInfraError,
  ValidationError,
  assertSupportedLanguage,
} from "./judge.js";
import type { AuthenticatedPrincipal } from "./principal.js";
import { InMemoryCollabPersist, type CollabPersist, type CollabRow } from "./collab.js";
import { IllegalStateError, MatchAuthority, NotMemberError, type MatchLockOptions } from "./match-authority.js";
import { StoreBackedMatchPersistence, type MatchPersistence } from "./persistence.js";
import { RoundLifecycle, type SealedVerdict } from "./round-lifecycle.js";
import { TeamCollaboration, type TeamSnapshot } from "./team-collaboration.js";
import {
  EvaluationOrchestrator,
} from "./evaluation-orchestration.js";
import type { EvaluationTelemetry } from "./evaluation-telemetry.js";
export type { SealedVerdict } from "./round-lifecycle.js";
export type { TeamMemberSnapshot, TeamSnapshot } from "./team-collaboration.js";
import type {
  DocumentRevision,
  ForfeitRecord,
  MatchRecord,
  Participant,
  RevealSnapshot,
  RoundState,
  SideId,
  SubmissionRecord,
} from "./records.js";
import {
  DuplicateError,
  InMemoryMatchStore,
  InMemoryRevealStore,
  InMemorySubmissionStore,
  MatchRevisionConflictError,
  type MatchStore,
  type RevealStore,
  type SubmissionStore,
} from "./store.js";

export const MATCH_DURATION_MS = 30 * 60 * 1000;
export const ROUND_CODING_DURATION_MS = 10 * 60 * 1000;

export function teamChatRoomId(matchId: string, sideId: string): string {
  return `arena:${matchId}:team:${sideId}`;
}

export interface BankProblem {
  problemVersionId: string;
  hiddenSuiteId: string;
  /** Bank-declared execution driver; absent falls back to snippet-for-Python/stdio (05 declares it everywhere). */
  driver?: DriverKind;
  entrypoint?: string;
  visible: Array<{ id: string; input: string; expected: string }>;
  hidden: Array<{ name: string; weight: number; tests: Array<{ id: string; input: string; expected: string }> }>;
  statement: { title: string; description: string; examples: Array<{ id: string; input: string; expected: string }> };
  starters: Partial<Record<SupportedLanguage, string>>;
}

export interface ProblemBank {
  loadProblem(problemVersionId: string): BankProblem;
}

export interface RatePolicy {
  maxRunsPerWindow: number;
  windowMs: number;
}

/** Judge verdict groups for one sealed evaluation (judge output, game-scored). */
export interface EngineOptions {
  judge: GameJudge;
  bank: ProblemBank;
  /** Preferred dependency: one domain-shaped durable Match module. */
  persistence?: MatchPersistence;
  /** @deprecated Use persistence. Kept as a migration adapter for callers. */
  matches?: MatchStore;
  /** @deprecated Use persistence. Kept as a migration adapter for callers. */
  submissions?: SubmissionStore;
  /** @deprecated Use persistence. Kept as a migration adapter for callers. */
  reveals?: RevealStore;
  clock?: () => number;
  uuid?: () => string;
  limits?: JudgeLimits;
  telemetry?: EvaluationTelemetry;
  maxSourceBytes?: number;
  rate?: RatePolicy;
  revealGraceMs?: number;
  /**
   * Disconnect grace (ticket 11 §11): an offline side may resume seamlessly
   * while offlineSinceMs + grace > now; past it the side forfeits (1v1).
   * Default 90s per the Code Arena spec window (60–90, configurable).
   */
  reconnectGraceMs?: number;
  /** Shared per-round coding window (ticket 12). Default 10 minutes. */
  roundDurationMs?: number;
  /** Durable collab-document storage (ticket 15, option B: full state per commit). */
  collab?: CollabPersist;
  /**
   * Ticket 15 closure: ONE database transaction for match row + collab rows.
   * Provided by PostgresStores in production; absent in-memory/tests (where
   * the match lock alone serializes and saves cannot split-brain a process).
   */
  saveMatchAndCollab?: (match: MatchRecord, rows: CollabRow[]) => Promise<void>;
}

export { IllegalStateError, NotMemberError } from "./match-authority.js";

export class RateLimitedError extends Error {
  readonly code = 429;
  constructor(message: string) {
    super(message);
    this.name = "RateLimitedError";
  }
}

export class ExpiredError extends Error {
  readonly code = 410;
  constructor(message = "match clock expired") {
    super(message);
    this.name = "ExpiredError";
  }
}

function driverFor(language: SupportedLanguage, requestedDriver?: DriverKind): DriverKind {
  // Snippet execution requires a language-specific harness. Currently, only Python
  // has a snippet harness; all other languages (C++, C, etc.) must use stdio.
  if (requestedDriver === "snippet" && language !== "Python") {
    return "stdio";
  }
  return requestedDriver ?? (language === "Python" ? "snippet" : "stdio");
}

export class ArenaEngine {
  private readonly judge: GameJudge;
  private readonly bank: ProblemBank;
  private readonly persistence: MatchPersistence;
  private readonly authority: MatchAuthority;
  private readonly roundLifecycle: RoundLifecycle;
  private readonly teamCollaboration: TeamCollaboration;
  private readonly clock: () => number;
  private readonly uuid: () => string;
  private readonly limits: JudgeLimits;
  private readonly maxSourceBytes: number;
  private readonly rate: RatePolicy;
  private readonly revealGraceMs: number;
  private readonly reconnectGraceMs: number;
  private readonly roundDurationMs: number;
  private readonly deadlineByMatch = new Map<string, number>();
  private readonly listeners = new Set<(event: ArenaEvent, payload: unknown) => void>();
  private readonly eventCommand = new AsyncLocalStorage<{ matchId: string; events: Array<{ event: ArenaEvent; payload: unknown }> }>();
  private readonly runStamps = new Map<string, number[]>();
  private readonly evaluation: EvaluationOrchestrator;
  private readonly blockedAccounts = new Set<string>();

  private async withMatchLock<T>(matchId: string, fn: () => Promise<T>, options?: MatchLockOptions): Promise<T> {
    const command = { matchId, events: [] as Array<{ event: ArenaEvent; payload: unknown }> };
    const result = await this.eventCommand.run(command, () => this.authority.withLock(matchId, fn, options));
    for (const queued of command.events) this.deliverEvent(queued.event, queued.payload, result.revision);
    return result.value;
  }

  /**
   * Snapshot/grace reads and boot recovery are idempotent background work. If
   * another Game process commits the same Match between their load and save,
   * reload once more instead of leaking an optimistic-write conflict through a
   * GET or abandoning recovery. Gameplay commands intentionally do not use
   * this helper: their 409 conflicts must remain visible to the caller.
   */
  private async withRevisionRetry<T>(matchId: string, fn: () => Promise<T>, options?: MatchLockOptions): Promise<T> {
    let attempts = 0;
    while (true) {
      try {
        return await this.withMatchLock(matchId, fn, options);
      } catch (error) {
        if (!(error instanceof MatchRevisionConflictError) || attempts >= 2) throw error;
        attempts += 1;
      }
    }
  }

  constructor(options: EngineOptions) {
    this.judge = options.judge;
    this.bank = options.bank;
    const matches = options.matches ?? new InMemoryMatchStore();
    const submissions = options.submissions ?? new InMemorySubmissionStore();
    const reveals = options.reveals ?? new InMemoryRevealStore();
    this.persistence =
      options.persistence ??
      new StoreBackedMatchPersistence({
        matches,
        submissions,
        reveals,
        collab: options.collab ?? new InMemoryCollabPersist(),
        commitMatchAndTeamDocuments: options.saveMatchAndCollab,
    });
    this.authority = new MatchAuthority(this.persistence);
    this.roundLifecycle = new RoundLifecycle();
    this.clock = options.clock ?? (() => Date.now());
    this.teamCollaboration = new TeamCollaboration({
      persistence: {
        saveMatch: (match) => this.authority.saveMatch(match),
        loadTeamDocument: (matchId, roundId, sideId) => this.persistence.loadTeamDocument(matchId, roundId, sideId),
        commitMatchAndTeamDocuments: (match, rows) => this.authority.saveMatchAndTeamDocuments(match, rows),
      },
      bank: this.bank,
      clock: this.clock,
    });
    this.uuid = options.uuid ?? randomUUID;
    this.limits = options.limits ?? SPIKE_LIMITS;
    this.maxSourceBytes = options.maxSourceBytes ?? 100 * 1024;
    this.rate = options.rate ?? { maxRunsPerWindow: 10, windowMs: 60000 };
    this.revealGraceMs = options.revealGraceMs ?? 2000;
    this.reconnectGraceMs = options.reconnectGraceMs ?? 90000;
    this.roundDurationMs = options.roundDurationMs ?? ROUND_CODING_DURATION_MS;
    this.evaluation = new EvaluationOrchestrator({
      judge: this.judge,
      bank: this.bank,
      persistence: this.persistence,
      authority: this.authority,
      roundLifecycle: this.roundLifecycle,
      clock: this.clock,
      deadlineGraceMs: this.revealGraceMs,
      limits: this.limits,
      telemetry: options.telemetry,
      host: {
        withMatchLock: (matchId, fn, lockOptions) => this.withMatchLock(matchId, fn, lockOptions),
        loadMatchOrThrow: (matchId) => this.loadMatchOrThrow(matchId),
        currentRound: (match) => this.currentRound(match),
        activityOf: (round, side) => this.activityOf(round, side),
        transitionActivity: (match, round, side, next) => this.transitionActivity(match, round, side, next),
        emit: (event, payload) => this.emit(event, payload),
      },
    });
  }

  on(listener: (event: ArenaEvent, payload: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: ArenaEvent, payload: unknown): void {
    const matchId = (payload as { matchId?: string } | null)?.matchId;
    const command = this.eventCommand.getStore();
    if (command && command.matchId === matchId) {
      command.events.push({ event, payload });
      return;
    }
    const revision = typeof matchId === "string" ? this.authority.revisionFor(matchId) : undefined;
    this.deliverEvent(event, payload, revision);
  }

  private deliverEvent(event: ArenaEvent, payload: unknown, revision?: number): void {
    const matchId = (payload as { matchId?: string } | null)?.matchId;
    const stamped =
      payload !== null &&
      typeof payload === "object" &&
      typeof matchId === "string" &&
      revision !== undefined
        ? { ...(payload as Record<string, unknown>), revision }
        : payload;
    for (const listener of this.listeners) {
      try {
        listener(event, stamped);
      } catch (error) {
        console.error(`Arena event listener failed after ${event} committed`, error);
      }
    }
  }

  async createMatch(input: {
    mode: MatchMode;
    participants: Participant[];
    problemVersionIds: string[];
    durationMs?: number;
    now?: number;
  }, save: (match: MatchRecord) => Promise<void> = (match) => this.persistence.saveMatch(match)): Promise<string> {
    if (input.mode !== "1v1" && input.mode !== "2v2") throw new ValidationError("unknown match mode");
    if (input.problemVersionIds.length === 0) throw new ValidationError("at least one round required");
    const bySide = new Map<SideId, string[]>();
    for (const p of input.participants) {
      const list = bySide.get(p.sideId) ?? [];
      list.push(p.userId);
      bySide.set(p.sideId, list);
    }
    if (input.mode === "1v1") {
      if (bySide.size !== 2 || input.participants.length !== 2) {
        throw new ValidationError("1v1 requires exactly two participants on two sides");
      }
    } else {
      // ponytail: teams ARE sides — one team = one competitive side, so the
      // sideId is the team identity and participants[] is the membership
      // relation. No parallel team table, no fixed player columns.
      if (input.participants.length !== 4 || bySide.size !== 2) {
        throw new ValidationError("2v2 requires exactly four participants on two sides");
      }
      for (const [side, users] of bySide) {
        if (users.length !== 2) throw new ValidationError(`2v2 side ${side} requires exactly two members`);
      }
      const distinct = new Set(input.participants.map((p) => p.userId));
      if (distinct.size !== 4) throw new ValidationError("2v2 requires four distinct users");
    }
    const teams = input.mode === "2v2";
    const now = input.now ?? this.clock();
    const matchId = this.uuid();
    const sideIds = [...bySide.keys()];
    const match: MatchRecord = {
      id: matchId,
      mode: input.mode,
      roundPhase: "MATCH_FOUND",
      currentRound: 1,
      totalRounds: input.problemVersionIds.length,
      durationMs: input.durationMs ?? MATCH_DURATION_MS,
      startedAt: now,
      participants: input.participants.map((p) => ({ ...p })),
      rounds: input.problemVersionIds.map((problemVersionId) => {
        const problem = this.bank.loadProblem(problemVersionId);
        const activities: Partial<Record<SideId, PlayerStatus>> = {};
        for (const p of input.participants) activities[p.sideId] = "coding";
        return {
          roundId: this.uuid(),
          problemVersionId: problem.problemVersionId,
          hiddenSuiteId: problem.hiddenSuiteId,
          counted: {},
          attempts: {},
          activities,
          runTests: {},
          // 2v2 only: fresh shared-doc identity per team side (revision 1).
          teamDocs: teams ? Object.fromEntries(sideIds.map((s) => [s, { revision: 1, language: "Python" }])) : undefined,
          readiness: teams ? {} : undefined,
          reveal: null,
          closing: false,
          cutoffPassed: false,
          superseded: [],
        };
      }),
      failures: [],
      revision: 0,
      presence: {},
      offlineSinceMs: {},
      forfeit: null,
    };
    await save(match);
    this.rememberDeadline(match);
    return matchId;
  }

  async startRound(principal: AuthenticatedPrincipal, matchId: string): Promise<void> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      this.requireUnexpired(match);
      this.roundLifecycle.startRound(match);
      await this.authority.saveMatch(match);
      this.emit("phase.changed", { matchId: match.id, phase: match.roundPhase, round: match.currentRound });
    });
  }
  async beginCoding(principal: AuthenticatedPrincipal, matchId: string): Promise<void> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      this.requireUnexpired(match);
      if (match.roundPhase === "CODING") {
        // Repeated Begin Coding: idempotent, never resets coding deadline
        return;
      }
      const now = this.clock();
      const matchDeadline = match.startedAt + match.durationMs;
      const round = this.currentRound(match);
      const codingDeadline = round.codingDeadlineMs ?? Math.min(now + this.roundDurationMs, matchDeadline);
      this.roundLifecycle.beginCoding(match, codingDeadline);
      this.rememberDeadline(match);
      await this.authority.saveMatch(match);
      this.emit("phase.changed", { matchId: match.id, phase: match.roundPhase, round: match.currentRound });
    });
  }

  /** Team readiness remains a facade operation; collaboration owns its rules. */
  async setReady(
    principal: AuthenticatedPrincipal,
    matchId: string,
    input: { ready: boolean; documentRevision?: DocumentRevision },
  ): Promise<void> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      this.requireUnexpired(match);
      if (match.mode !== "2v2") return;
      const result = await this.teamCollaboration.setReady(match, principal.userId, input);
      await this.authority.saveMatch(match);
      this.emit("readiness.changed", {
        matchId: match.id,
        side: result.side,
        userId: principal.userId,
        ready: result.ready,
        documentRevision: result.documentRevision,
      });
    });
  }

  async applyCollabUpdate(
    principal: AuthenticatedPrincipal,
    matchId: string,
    input: { roundId: string; updateB64: string },
  ): Promise<{ revision: DocumentRevision; changed: boolean; source: string }> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      this.requireUnexpired(match);
      const result = await this.teamCollaboration.applyUpdate(match, principal.userId, input);
      if (result.changed) {
        this.emit("readiness.changed", {
          matchId: match.id,
          side: result.side,
          invalidated: true,
          documentRevision: result.revision,
        });
      }
      return { revision: result.revision, changed: result.changed, source: result.source };
    });
  }

  async collabSync(
    principal: AuthenticatedPrincipal,
    matchId: string,
  ): Promise<{ roomId: string; roundId: string; side: SideId; stateB64: string; source: string; revision: DocumentRevision; language: string }> {
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      return this.teamCollaboration.sync(match, principal.userId);
    });
  }

  /**
   * Team chat context resolution (ticket 16):
   * Game-owned authority boundary for the /chat namespace.
   * Rejects strangers (throws NotMemberError), 1v1 matches (throws IllegalStateError),
   * and inactive/forfeited matches.
   * Resolves caller's side and returns the isolated team room id.
   */
  async resolveTeamChatContext(
    principal: AuthenticatedPrincipal,
    matchId: string,
  ): Promise<TeamChatAuthContext> {
    const match = await this.requireMember(principal, matchId);
    if (match.mode !== "2v2") {
      throw new IllegalStateError("no team chat in 1v1");
    }
    const side = this.sideOf(match, principal);
    const active = match.roundPhase !== "MATCH_COMPLETE" && !match.forfeit;
    return {
      matchId: match.id,
      sideId: side,
      userId: principal.userId,
      displayName: principal.userId,
      roomId: teamChatRoomId(match.id, side),
      active,
      phase: match.roundPhase,
    };
  }

  async setTeamLanguage(principal: AuthenticatedPrincipal, matchId: string, language: string): Promise<DocumentRevision | null> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      this.requireUnexpired(match);
      if (match.mode === "2v2") {
        assertSupportedLanguage(language);
        this.requireProblemLanguage(this.loadPlayableProblem(this.currentRound(match).problemVersionId), language);
      }
      const result = await this.teamCollaboration.setLanguage(match, principal.userId, language);
      if (!result) return null;
      this.emit("readiness.changed", {
        matchId: match.id,
        side: result.side,
        invalidated: true,
        documentRevision: result.revision,
      });
      return result.revision;
    });
  }
  async run(
    principal: AuthenticatedPrincipal,
    matchId: string,
    input: { code: string; language: string },
  ): Promise<{ runId: string; tests: Array<{ id: string; passed: boolean; output: string; runtimeMs: number }> }> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    const setup = await this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      const side = this.sideOf(match, principal);
      const round = this.currentRound(match);
      this.requireUnexpired(match);
      this.requireRoundUnexpired(round);
      if (!canRun(match.roundPhase)) throw new IllegalStateError(`run rejected in ${match.roundPhase}`);
      if (!canSideRun(this.activityOf(round, side))) {
        throw new IllegalStateError(`run rejected for side while ${this.activityOf(round, side)}`);
      }
      assertSupportedLanguage(input.language);
      const problem = this.loadPlayableProblem(round.problemVersionId);
      this.requireProblemLanguage(problem, input.language);
      this.validateSource(input.code);
      this.checkRate(matchId, side);
      const runId = this.uuid();
      await this.setActivity(match, round, side, "running");
      return {
        runId,
        side,
        roundId: round.roundId,
        visible: problem.visible.map((t) => ({ id: t.id, input: t.input, expected: t.expected })),
        driver: driverFor(input.language as SupportedLanguage, problem.driver),
        entrypoint: problem.entrypoint,
      };
    });
    try {
      // Visible tests only. Runs outside the match lock: the other side stays free.
      const verdicts = await this.judge.runVisible(
        input.language as SupportedLanguage,
        setup.driver,
        input.code,
        setup.visible,
        this.limits,
        setup.entrypoint,
      );
      await this.withMatchLock(matchId, async () => {
        const match = await this.requireMember(principal, matchId, true);
        const round = match.rounds.find((r) => r.roundId === setup.roundId) ?? this.currentRound(match);
        this.emit("tests.updated", {
          matchId: match.id,
          side: setup.side,
          tests: verdicts.map((v) => ({ id: v.id, status: v.passed ? "passed" : "failed" })),
        });
        round.runTests[setup.side] = verdicts.map((v) => ({
          id: v.id,
          status: v.passed ? "passed" : "failed",
          output: v.output,
          ms: v.runtimeMs,
        }));
        await this.authority.saveMatch(match);
        if (this.activityOf(round, setup.side) === "running") {
          await this.setActivity(match, round, setup.side, "coding");
        }
      });
      return {
        runId: setup.runId,
        tests: verdicts.map((v) => ({ id: v.id, passed: v.passed, output: v.output, runtimeMs: v.runtimeMs })),
      };
    } catch (error) {
      await this.withMatchLock(matchId, async () => {
        const match = await this.requireMember(principal, matchId, true);
        const round = match.rounds.find((r) => r.roundId === setup.roundId) ?? this.currentRound(match);
        await this.recordFailure(match, `run: ${error instanceof Error ? error.message : String(error)}`);
        delete round.runTests[setup.side];
        await this.authority.saveMatch(match);
        if (this.activityOf(round, setup.side) === "running") {
          await this.setActivity(match, round, setup.side, "coding");
        }
      });
      throw error;
    }
  }

  async submit(
    principal: AuthenticatedPrincipal,
    matchId: string,
    input: { code: string; language: string; submissionId?: string; evaluationId?: string; documentRevision?: DocumentRevision },
  ): Promise<{ ok: true; round: number; submissionId: string; evaluationId: string }> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    // Phase 1 (locked): gates, ids, pending record, activity dispatch.
    const setup = await this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      const side = this.sideOf(match, principal);
      const round = this.currentRound(match);
      this.requireUnexpired(match);
      this.requireRoundUnexpired(round);
      // 1v1 keeps the legacy gate (phase only). 2v2 additionally requires
      // both teammates ready via the arena-model gate AND both approvals
      // bound to the current document revision — stale R1 readiness can
      // never authorize an R2 submission. The lock makes the gate + record
      // atomic, so a concurrent edit deterministically wins or loses whole.
      this.requireActiveMember(match, principal.userId);
      const readiness = match.mode === "2v2"
        ? this.teamCollaboration.readinessFor(match, side, this.clock(), this.reconnectGraceMs)
        : { you: false, mate: false };
      if (!canSubmit(match.roundPhase, match.mode, readiness)) {
        throw new IllegalStateError(`submit rejected in ${match.roundPhase} (team not both ready)`);
      }
      if (round.closing) throw new IllegalStateError("submit rejected while reveal is closing the round");
      assertSupportedLanguage(input.language);
      const problem = this.loadPlayableProblem(round.problemVersionId);
      this.requireProblemLanguage(problem, input.language);
      // 2v2 frozen source (ticket 15 §11): the judge receives the immutable
      // authoritative Y.Text snapshot, never the client payload. The client
      // language must equal the team language (no split-language document).
      let submitCode = input.code;
      let submitDocRevision: DocumentRevision | null = null;
      if (match.mode === "2v2") {
        const document = await this.teamCollaboration.submissionDocument(
          match,
          side,
          input.language,
          input.documentRevision,
          principal.userId,
          this.reconnectGraceMs,
        );
        submitCode = document.source;
        submitDocRevision = document.documentRevision;
      }
      this.validateSource(submitCode);
      const submissionId = input.submissionId ?? this.uuid();
      const evaluationId = input.evaluationId ?? this.uuid();
      const sourceHash = createHash("sha256").update(submitCode, "utf8").digest("hex");
      const dup = this.evaluation.get(evaluationId);
      if (dup) {
        if (
          dup.matchId !== matchId ||
          dup.roundId !== round.roundId ||
          dup.sideId !== side ||
          dup.submissionId !== submissionId ||
          dup.problemVersionId !== round.problemVersionId ||
          dup.language !== input.language ||
          dup.sourceHash !== sourceHash ||
          dup.documentRevision !== submitDocRevision
        ) {
          throw new DuplicateError("evaluation id is already bound to different submission data");
        }
        // Concurrent duplicate under the same ids: attach to the accepted
        // evaluation, never duplicate work or history.
        // The caller waits after leaving the Match lock. The original
        // evaluator must re-enter this lock to commit its verdict.
        return { attached: true as const, waitFor: dup.promise, roundNo: match.currentRound, evaluationId };
      }
      const tracked = this.evaluation.track(evaluationId, {
        matchId,
        roundId: round.roundId,
        sideId: side,
        submissionId,
        problemVersionId: round.problemVersionId,
        language: input.language,
        sourceHash,
        documentRevision: submitDocRevision,
      });
      try {
        const existing = await this.persistence.findSubmissionByEvaluationId(evaluationId);
        if (
          existing &&
          (existing.submissionId !== submissionId ||
            existing.matchId !== matchId ||
            existing.roundId !== round.roundId ||
            existing.sideId !== side ||
            existing.problemVersionId !== round.problemVersionId ||
            existing.language !== input.language ||
            existing.sourceHash !== sourceHash ||
            (existing.documentRevision ?? null) !== submitDocRevision)
        ) {
          throw new DuplicateError("evaluation id is already bound to different submission data");
        }
        if (existing && existing.status !== "pending") {
          if (existing.status === "failed") {
            throw this.evaluation.failureFor(evaluationId) ?? new JudgeInfraError("evaluation previously failed");
          }
          // Idempotent retry: same stored outcome, no second logical evaluation.
          this.evaluation.settle(evaluationId, tracked, { ok: true });
          return { attached: true as const, roundNo: match.currentRound, submissionId: existing.submissionId, evaluationId: existing.evaluationId };
        }
        const resumed = existing?.status === "pending";
        if (resumed && (existing!.matchId !== matchId || existing!.roundId !== round.roundId || existing!.sideId !== side)) {
          throw new IllegalStateError("pending evaluation does not belong to this round and side");
        }
        if (!resumed && !canSideSubmit(this.activityOf(round, side))) {
          throw new IllegalStateError(`submit rejected for side while ${this.activityOf(round, side)}`);
        }
        const now = this.clock();
        let record = existing ?? null;
        if (!record) {
          record = {
            submissionId,
            evaluationId,
            matchId,
            roundId: round.roundId,
            sideId: side,
            problemVersionId: round.problemVersionId,
            language: input.language,
            source: submitCode,
            sourceHash,
            documentRevision: submitDocRevision,
            submittedAt: now,
            elapsedMatchMs: now - match.startedAt,
            status: "pending",
            score: null,
            scoreBp: null,
            groups: null,
            testStatuses: null,
            failureCode: null,
          };
          await this.persistence.recordSubmission(record);
        }
        if (!resumed) {
          await this.setActivity(match, round, side, "submitted");
          await this.setActivity(match, round, side, "evaluating");
        }
        return {
          attached: false as const,
          roundNo: match.currentRound,
          submissionId: record.submissionId,
          evaluationId,
          side,
          roundId: round.roundId,
          problemVersionId: round.problemVersionId,
          hiddenSuiteId: round.hiddenSuiteId,
          language: record.language as SupportedLanguage,
          driver: driverFor(record.language as SupportedLanguage, problem.driver),
          entrypoint: problem.entrypoint,
          source: record.source,
          groups: problem.hidden.map((g) => ({
            name: g.name,
            weight: g.weight,
            tests: g.tests.map((t) => ({ id: t.id, input: t.input, expected: t.expected })),
          })),
          tracked,
        };
      } catch (error) {
        this.evaluation.settle(evaluationId, tracked, { ok: false, error });
        throw error;
      }
    });
    if (setup.attached) {
      if (setup.waitFor) {
        const completion = await setup.waitFor;
        if (!completion.ok) throw completion.error;
      }
      const settled = await this.persistence.findSubmissionByEvaluationId(setup.evaluationId);
      if (!settled) throw new IllegalStateError("evaluation vanished");
      return { ok: true, round: setup.roundNo, submissionId: settled.submissionId, evaluationId: setup.evaluationId };
    }
    return this.evaluation.run({
      matchId,
      roundNo: setup.roundNo,
      roundId: setup.roundId,
      sideId: setup.side,
      submissionId: setup.submissionId,
      evaluationId: setup.evaluationId,
      problemVersionId: setup.problemVersionId,
      hiddenSuiteId: setup.hiddenSuiteId,
      language: setup.language,
      driver: setup.driver,
      entrypoint: setup.entrypoint,
      source: setup.source,
      groups: setup.groups,
      documentRevision: setup.tracked.documentRevision,
      tracked: setup.tracked,
    });
  }

  async publishReveal(
    principal: AuthenticatedPrincipal,
    matchId: string,
    options: { graceMs?: number } = {},
  ): Promise<RevealSnapshot> {
    const reveal = await this.publishRevealInternal(
      matchId,
      options,
      () => this.requireMember(principal, matchId),
      false,
    );
    if (!reveal) throw new IllegalStateError("reveal unavailable");
    return reveal;
  }

  /** Game-owned auto reveal; no player identity is needed after an accepted score. */
  async autoRevealIfAllSidesCounted(
    matchId: string,
    options: { graceMs?: number } = {},
  ): Promise<RevealSnapshot | null> {
    return this.publishRevealInternal(
      matchId,
      options,
      () => this.loadMatchOrThrow(matchId),
      true,
    );
  }

  private async publishRevealInternal(
    matchId: string,
    options: { graceMs?: number },
    loadMatch: () => Promise<MatchRecord>,
    automatic: boolean,
  ): Promise<RevealSnapshot | null> {
    if (this.deadlineHasElapsedOrUnknown(matchId) && await this.closeExpiredMatch(matchId)) {
      const match = await loadMatch();
      const reveal = this.currentRound(match).reveal;
      return reveal ? JSON.parse(JSON.stringify(reveal)) as RevealSnapshot : null;
    }
    const start = await this.withMatchLock(matchId, async () => {
      const match = await loadMatch();
      const round = this.currentRound(match);
      if ((match.roundPhase === "MATCH_COMPLETE" || automatic) && round.reveal) {
        return { status: "existing" as const, reveal: JSON.parse(JSON.stringify(round.reveal)) as RevealSnapshot };
      }
      if (match.roundPhase === "MATCH_COMPLETE" || match.forfeit) {
        return { status: "skip" as const };
      }
      if (automatic) {
        const sides = Object.keys(round.activities);
        if (match.roundPhase !== "CODING" || sides.length === 0 ||
          !sides.every((side) => round.counted[side] !== undefined)) {
          return { status: "skip" as const };
        }
        if (this.applyGraceToMatch(match)) {
          await this.authority.saveMatch(match);
          return { status: "skip" as const };
        }
      }
      this.roundLifecycle.beginReveal(match);
      await this.authority.saveMatch(match);
      return { status: "wait" as const, roundId: round.roundId };
    });
    if (start.status === "existing") return start.reveal;
    if (start.status === "skip") return null;
    const graceMs = options.graceMs ?? this.revealGraceMs;
    const pending = this.evaluation.forRound(matchId, start.roundId);
    if (pending.length > 0 && graceMs > 0) {
      await Promise.race([
        Promise.allSettled(pending.map((p) => p.promise)),
        new Promise((resolve) => setTimeout(resolve, graceMs)),
      ]);
    }
    return this.withMatchLock(matchId, async () => {
      const match = await loadMatch();
      const round = match.rounds.find((entry) => entry.roundId === start.roundId);
      if (!round) throw new IllegalStateError("reveal round no longer exists");
      if (automatic && round.reveal) return JSON.parse(JSON.stringify(round.reveal)) as RevealSnapshot;
      if (match.roundPhase === "MATCH_COMPLETE" || match.forfeit) {
        return round.reveal ? JSON.parse(JSON.stringify(round.reveal)) as RevealSnapshot : null;
      }
      this.roundLifecycle.prepareReveal(
        match,
        new Set(
          (await this.persistence.listRoundSubmissions(matchId, start.roundId))
            .filter((s) => s.status === "completed")
            .map((s) => s.evaluationId),
        ),
        this.evaluation.forRound(matchId, start.roundId).map((entry) => entry.evaluationId),
      );
      const now = this.clock();
      const scores: Partial<Record<SideId, number>> = {};
      const groups: RevealSnapshot["groups"] = {};
      const totals: Partial<Record<SideId, number>> = {};
      const noSubmission: Partial<Record<SideId, boolean>> = {};
      for (const side of Object.keys(round.activities)) {
        const counted = round.counted[side];
        scores[side] = counted?.score ?? 0;
        const latest = await this.latestCompleted(matchId, round.roundId, side);
        groups[side] = latest?.groups ?? [];
        totals[side] = this.roundLifecycle.totalScore(match, side);
        noSubmission[side] = latest === undefined;
      }
      const snapshot = this.roundLifecycle.createReveal(match, {
        scores,
        groups,
        totals,
        publishedAt: now,
        cause: "REVEAL_CONDITION_MET",
        noSubmission,
      });
      try {
        await this.persistence.publishReveal(match.id, round.roundId, snapshot);
      } catch (error) {
        if (error instanceof DuplicateError) throw new IllegalStateError("reveal already published");
        throw error;
      }
      this.roundLifecycle.commitReveal(match, snapshot);
      for (const side of Object.keys(round.activities)) {
        if (this.activityOf(round, side) !== "locked") await this.setActivity(match, round, side, "locked");
      }
      await this.authority.saveMatch(match);
      this.emit("reveal.published", { matchId: match.id, round: match.currentRound });
      return JSON.parse(JSON.stringify(snapshot)) as RevealSnapshot;
    });
  }

  async nextRound(principal: AuthenticatedPrincipal, matchId: string): Promise<void> {
    if (this.deadlineHasElapsedOrUnknown(matchId) && await this.closeExpiredMatch(matchId)) return;
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      const plan = this.roundLifecycle.advance(match);
      if (plan.completed) {
        await this.authority.saveMatch(match);
        this.emit("match.ended", { matchId: match.id, result: "pending-final" });
        return;
      }
      const oldRound = match.rounds.find((round) => round.roundId === plan.previousRoundId) ?? this.currentRound(match);
      const round = this.currentRound(match);
      if (match.mode === "2v2") {
        // New round = new team document identity (revision restarts at 1;
        // the new roundId scopes old approvals invalid regardless), all
        // readiness cleared, team language carried over like 1v1 clients do.
        // Old Y.Docs are destroyed: late old-round frames carry the old
        // roundId and are rejected at the gate, never applied here.
        this.teamCollaboration.destroyRound(match, oldRound);
      }
      for (const side of plan.activityResets) await this.setActivity(match, round, side, "coding");
      await this.authority.saveMatch(match);
      this.emit("round.advanced", { matchId: match.id, round: match.currentRound });
    });
  }
  async finalResult(
    principal: AuthenticatedPrincipal,
    matchId: string,
  ): Promise<{ scores: Partial<Record<SideId, number>>; outcome: "left" | "right" | "draw"; winner: SideId | null; forfeit: ForfeitRecord | null }> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    const match = await this.requireMember(principal, matchId, true);
    if (match.roundPhase !== "MATCH_COMPLETE") throw new IllegalStateError("match not complete");
    return this.roundLifecycle.computeFinal(match);
  }

  private requireProblemLanguage(problem: BankProblem, language: SupportedLanguage): void {
    if (typeof problem.starters[language] !== "string") {
      throw new ValidationError(`${language} is not available for this problem; choose ${Object.keys(problem.starters).join(", ")}`);
    }
  }

  private loadPlayableProblem(problemVersionId: string): BankProblem {
    const problem = this.bank.loadProblem(problemVersionId);
    // All current judge adapters execute bank snippets through the Python harness.
    // The bank may retain starters for future adapters without advertising them.
    if (problem.driver !== "snippet") return problem;
    return {
      ...problem,
      starters: typeof problem.starters.Python === "string" ? { Python: problem.starters.Python } : {},
    };
  }

  async snapshot(principal: AuthenticatedPrincipal, matchId: string): Promise<SealedSnapshot> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withRevisionRetry(matchId, async () => {
      const match = await this.requireMember(principal, matchId, true);
      this.applyGraceToMatch(match);
      await this.authority.saveMatch(match);
      const side = this.sideOf(match, principal);
      const round = this.currentRound(match);
      const problem = this.loadPlayableProblem(round.problemVersionId);
      const now = this.clock();
      const remainingMs = Math.max(0, match.durationMs - (now - match.startedAt));
      const roundRemainingMs =
        match.roundPhase === "CODING" && round.codingDeadlineMs != null
          ? Math.max(0, round.codingDeadlineMs - now)
          : null;
      const sides: Record<SideId, { status: PlayerStatus; submissions: number; presence: "online" | "offline" }> = {};
      for (const [sideId, status] of Object.entries(round.activities)) {
        const sidePresence =
          match.mode === "2v2"
            ? this.teamCollaboration.hasOnlineMember(match, sideId)
              ? ("online" as const)
              : ("offline" as const)
            : (match.presence[sideId] ?? "offline");
        sides[sideId] = {
          status: status ?? "coding",
          submissions: round.attempts[sideId] ?? 0,
          presence: sidePresence,
        };
      }
      const pending = (await this.persistence.listRoundSubmissions(matchId, round.roundId)).some(
        (s) => s.sideId === side && s.status === "pending",
      );
      return {
        matchId: match.id,
        mode: match.mode,
        roundPhase: match.roundPhase,
        round: match.currentRound,
        totalRounds: match.totalRounds,
        remainingMs,
        roundRemainingMs,
        expired: remainingMs <= 0,
        mySide: side,
        revision: match.revision,
        pendingEvaluation: pending,
        final: match.roundPhase === "MATCH_COMPLETE" ? this.roundLifecycle.computeFinal(match) : null,
        teams: match.mode === "2v2"
          ? this.teamCollaboration.snapshots(match, round, side, now, this.reconnectGraceMs)
          : undefined,
        problem: {
        problemVersionId: problem.problemVersionId,
        title: problem.statement.title,
        description: problem.statement.description,
        examples: problem.statement.examples.map((e) => ({ ...e })),
        starters: { ...problem.starters },
      },
      visibleTests: problem.visible.map((t) => ({ id: t.id, input: t.input, expected: t.expected })),
      tests:
        round.runTests[side] ??
        problem.visible.map((t) => ({ id: t.id, status: "idle" as const, output: null, ms: null })),
      sides,
      reveal: round.reveal ? JSON.parse(JSON.stringify(round.reveal)) : null,
      failures: [...match.failures],
    };
    });
  }

  /**
   * Side resolution for the service layer (socket attach, presence mapping).
   * Membership-verified; never trusts client-supplied sides.
   */
  async participantSide(userId: string, matchId: string): Promise<SideId> {
    if (this.blockedAccounts.has(userId)) throw new NotMemberError(matchId);
    const match = await this.loadMatchOrThrow(matchId);
    const found = match.participants.find((p) => p.userId === userId);
    if (!found || match.departedMembers?.includes(userId)) throw new NotMemberError(matchId);
    return found.sideId;
  }

  /** Match mode for service-layer branching (presence path, validation). */
  async modeOf(matchId: string): Promise<MatchMode> {
    return (await this.loadMatchOrThrow(matchId)).mode;
  }

  /**
   * Presence attach/detach (ticket 11 §1/§12): the service calls this when a
   * socket opens/closes for a side. Presence NEVER rewrites side activity.
   * Going offline stamps offlineSinceMs (grace starts); rejoining online
   * clears it. Terminal matches ignore presence changes. Returns presence.
   */
  async setPresence(matchId: string, side: SideId, presence: "online" | "offline"): Promise<"online" | "offline"> {
    return this.withMatchLock(matchId, async () => {
      const match = await this.loadMatchOrThrow(matchId);
      if (!match.participants.some((p) => p.sideId === side)) throw new NotMemberError(matchId);
      return this.applySidePresence(match, side, presence);
    });
  }

  /** Lock-free side-presence core (ticket 11 §1/§12), shared by both presence paths. Caller holds the match lock. */
  private async applySidePresence(match: MatchRecord, side: SideId, presence: "online" | "offline"): Promise<"online" | "offline"> {
    if (match.roundPhase === "MATCH_COMPLETE" || match.forfeit) return match.presence[side] ?? "offline";
    if (presence === "online") {
      match.presence[side] = "online";
      delete match.offlineSinceMs[side];
    } else {
      match.presence[side] = "offline";
      // First drop starts grace; repeated disconnects never extend it.
      match.offlineSinceMs[side] ??= this.clock();
    }
    await this.authority.saveMatch(match);
    this.emit("player.presenceChanged", { matchId: match.id, side, presence: match.presence[side] });
    return match.presence[side]!;
  }

  /**
   * Per-member presence (2v2): two members share one side, so side-keyed
   * presence cannot represent them. Membership-verified (strangers throw);
   * never rewrites team activity; terminal matches ignore changes. 1v1
   * delegates to the unchanged side path.
   */
  async setMemberPresence(matchId: string, userId: string, presence: "online" | "offline"): Promise<"online" | "offline"> {
    return this.withMatchLock(matchId, async () => {
      const match = await this.loadMatchOrThrow(matchId);
      const participant = match.participants.find((p) => p.userId === userId);
      if (!participant) throw new NotMemberError(matchId);
      if (this.applyGraceToMatch(match)) {
        await this.authority.saveMatch(match);
        return match.memberPresence?.[userId] ?? "offline";
      }
      if (match.roundPhase === "MATCH_COMPLETE" || match.forfeit) {
        return match.memberPresence?.[userId] ?? match.presence[participant.sideId] ?? "offline";
      }
      if (match.mode === "2v2" && match.departedMembers?.includes(userId)) return "offline";
      if (match.mode !== "2v2") return this.applySidePresence(match, participant.sideId, presence);
      match.memberPresence ??= {};
      if (presence === "online") {
        const offlineSince = match.memberOfflineSinceMs?.[userId];
        if (offlineSince !== undefined && offlineSince + this.reconnectGraceMs <= this.clock()) {
          const readiness = this.currentRound(match).readiness;
          if (readiness) delete readiness[userId];
        }
        match.memberPresence[userId] = "online";
        if (match.memberOfflineSinceMs) delete match.memberOfflineSinceMs[userId];
      } else {
        match.memberPresence[userId] = "offline";
        match.memberOfflineSinceMs ??= {};
        match.memberOfflineSinceMs[userId] ??= this.clock();
      }
        this.clearSurrenderVotesForSide(match, participant.sideId);
      await this.authority.saveMatch(match);
      this.emit("player.presenceChanged", { matchId: match.id, side: participant.sideId, userId, presence: match.memberPresence[userId] });
      return match.memberPresence[userId]!;
    });
  }

  /**
   * Grace sweep entry (ticket 11 §11): forfeit sides past the grace window.
   * Explicit server logic — never called from socket callbacks directly; the
   * service drives it on an interval, and snapshot/actions apply it lazily.
   * Returns true when a forfeit was recorded.
   */
  async applyGraceIfExpired(matchId: string): Promise<boolean> {
    return this.withMatchLock(matchId, async () => {
      const match = await this.loadMatchOrThrow(matchId);
      const changed = this.applyGraceToMatch(match);
      if (changed) await this.authority.saveMatch(match);
      return changed;
    });
  }

  /** Sweep every known match (service interval). Per-match failures never abort the sweep. */
  async sweepGrace(): Promise<string[]> {
    const forfeited: string[] = [];
    for (const id of await this.persistence.listMatchIds()) {
      try {
        if (await this.applyGraceIfExpired(id)) forfeited.push(id);
      } catch {
        // Unknown/gone match: skip.
      }
    }
    return forfeited;
  }

  /** Close expired Matches on the server, including after a process restart. */
  async sweepExpiredMatches(): Promise<string[]> {
    const ids = await this.persistence.listMatchIds();
    const outcomes = await Promise.all(ids.map(async (id) => {
      try {
        return (await this.closeExpiredMatch(id)) ? id : null;
      } catch {
        // A failed Match commit is retried by the next sweep or player snapshot.
        return null;
      }
    }));
    return outcomes.filter((id): id is string => id !== null);
  }

  private async closeExpiredMatch(matchId: string): Promise<boolean> {
    const decision = await this.withRevisionRetry(matchId, async () => {
      const match = await this.loadMatchOrThrow(matchId);
      if (match.roundPhase === "MATCH_COMPLETE") {
        return { status: "idle" as const };
      }

      const matchExpired = this.isExpired(match);
      const round = this.currentRound(match);
      const roundExpired =
        match.roundPhase === "CODING" &&
        round.codingDeadlineMs != null &&
        this.clock() >= round.codingDeadlineMs;

      if (!matchExpired && !roundExpired) {
        return { status: "idle" as const };
      }

      if (matchExpired) {
        if (match.roundPhase === "CODING") {
          const persistedReveal = await this.persistence.findReveal(match.id, round.roundId);
          if (persistedReveal) {
            await this.finishExpiredRound(match, round, persistedReveal);
            return { status: "completed" as const };
          }
          const matchDeadline = match.startedAt + match.durationMs;
          const cutoff = round.codingDeadlineMs != null ? Math.min(round.codingDeadlineMs, matchDeadline) : matchDeadline;
          const pendingEvaluationIds = (await this.persistence.listRoundSubmissions(match.id, round.roundId))
            .filter((submission) => submission.status === "pending" && submission.submittedAt < cutoff)
            .map((submission) => submission.evaluationId);
          if (!round.closing) {
            this.roundLifecycle.beginReveal(match);
            await this.authority.saveMatch(match);
          }
          return {
            status: "waiting_match" as const,
            roundId: round.roundId,
            cutoffPassed: round.cutoffPassed,
            pendingEvaluationIds,
            graceDeadline: cutoff + this.revealGraceMs,
          };
        }

        if (match.roundPhase === "MATCH_FOUND" || match.roundPhase === "ROUND_INTRO") {
          await this.finishExpiredRound(match, round);
          return { status: "completed" as const };
        }

        if (match.roundPhase === "SCORE_REVEAL" || match.roundPhase === "ROUND_COMPLETE") {
          await this.finishExpiredRound(match, round, round.reveal ?? undefined);
          return { status: "completed" as const };
        }

        return { status: "idle" as const };
      }

      // Round deadline expired while match deadline has not
      if (roundExpired) {
        const persistedReveal = await this.persistence.findReveal(match.id, round.roundId);
        if (persistedReveal) {
          await this.finishExpiredRoundAtDeadline(match, round, persistedReveal);
          return { status: "completed" as const };
        }
        const matchDeadline = match.startedAt + match.durationMs;
        const cutoff = round.codingDeadlineMs != null ? Math.min(round.codingDeadlineMs, matchDeadline) : matchDeadline;
        const pendingEvaluationIds = (await this.persistence.listRoundSubmissions(match.id, round.roundId))
          .filter((submission) => submission.status === "pending" && submission.submittedAt < cutoff)
          .map((submission) => submission.evaluationId);
        if (!round.closing) {
          this.roundLifecycle.beginReveal(match);
          await this.authority.saveMatch(match);
        }
        return {
          status: "waiting_round" as const,
          roundId: round.roundId,
          cutoffPassed: round.cutoffPassed,
          pendingEvaluationIds,
          graceDeadline: cutoff + this.revealGraceMs,
        };
      }

      return { status: "idle" as const };
    });

    if (decision.status === "idle") return false;
    if (decision.status === "completed") return true;

    if (!decision.cutoffPassed && decision.pendingEvaluationIds.length > 0) {
      await this.waitForDeadlineEvaluations(
        matchId,
        decision.roundId,
        decision.pendingEvaluationIds,
        decision.graceDeadline,
      );
    }

    return this.withRevisionRetry(matchId, async () => {
      const match = await this.loadMatchOrThrow(matchId);
      if (match.roundPhase === "MATCH_COMPLETE") return false;

      const matchExpired = this.isExpired(match);
      const round = this.currentRound(match);

      if (matchExpired) {
        if (match.roundPhase === "CODING") {
          const persistedReveal = await this.persistence.findReveal(match.id, round.roundId);
          await this.finishExpiredRound(match, round, persistedReveal);
          return true;
        }
        if (match.roundPhase === "SCORE_REVEAL" || match.roundPhase === "ROUND_COMPLETE") {
          await this.finishExpiredRound(match, round, round.reveal ?? undefined);
          return true;
        }
        if (match.roundPhase === "MATCH_FOUND" || match.roundPhase === "ROUND_INTRO") {
          await this.finishExpiredRound(match, round);
          return true;
        }
        return false;
      }

      if (decision.status === "waiting_round" && match.roundPhase === "CODING") {
        const persistedReveal = await this.persistence.findReveal(match.id, round.roundId);
        await this.finishExpiredRoundAtDeadline(match, round, persistedReveal);
        return true;
      }

      return false;
    });
  }

  private async waitForDeadlineEvaluations(
    matchId: string,
    roundId: string,
    evaluationIds: readonly string[],
    graceDeadline: number,
  ): Promise<void> {
    while (true) {
      const submissions = await Promise.all(
        evaluationIds.map((evaluationId) => this.persistence.findSubmissionByEvaluationId(evaluationId)),
      );
      if (!submissions.some((submission) => submission?.matchId === matchId && submission.roundId === roundId && submission.status === "pending")) {
        return;
      }

      const remainingGraceMs = graceDeadline - this.clock();
      if (remainingGraceMs <= 0) return;
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(50, remainingGraceMs)));
    }
  }

  private async finishExpiredRound(
    match: MatchRecord,
    round: RoundState,
    existingReveal?: RevealSnapshot,
  ): Promise<void> {
    const phase = match.roundPhase;
    const wasRevealed = round.reveal !== null;
    let reveal = round.reveal ?? existingReveal ?? (await this.persistence.findReveal(match.id, round.roundId));

    if (phase === "CODING") {
      const submissions = await this.persistence.listRoundSubmissions(match.id, round.roundId);
      this.roundLifecycle.prepareReveal(
        match,
        new Set(submissions.filter((submission) => submission.status === "completed").map((submission) => submission.evaluationId)),
        this.evaluation.forRound(match.id, round.roundId).map((entry) => entry.evaluationId),
      );
    } else if (phase === "MATCH_FOUND" || phase === "ROUND_INTRO") {
      this.roundLifecycle.prepareDeadlineReveal(match, new Set(), []);
    }

    if (!reveal) {
      reveal = await this.createRevealSnapshot(match, round, "MATCH_DEADLINE");
      await this.persistence.publishReveal(match.id, round.roundId, reveal);
    }

    if (!round.reveal) {
      if (phase === "CODING" || phase === "MATCH_FOUND" || phase === "ROUND_INTRO") {
        this.roundLifecycle.commitReveal(match, reveal, "MATCH_DEADLINE");
      } else {
        round.reveal = reveal;
      }
    }

    round.closing = false;
    round.cutoffPassed = true;
    for (const side of Object.keys(round.activities)) {
      if (this.activityOf(round, side) !== "locked") {
        await this.setActivity(match, round, side, "locked");
      }
    }
    this.roundLifecycle.finishAtDeadline(match);
    await this.authority.saveMatch(match);
    if (!wasRevealed) this.emit("reveal.published", { matchId: match.id, round: match.currentRound });
    const final = this.roundLifecycle.computeFinal(match);
    this.emit("match.ended", { matchId: match.id, result: "deadline", winner: final.winner ?? undefined });
  }

  private async finishExpiredRoundAtDeadline(
    match: MatchRecord,
    round: RoundState,
    existingReveal?: RevealSnapshot,
  ): Promise<void> {
    const wasRevealed = round.reveal !== null;
    let reveal = round.reveal ?? existingReveal ?? (await this.persistence.findReveal(match.id, round.roundId));

    if (match.roundPhase === "CODING") {
      const submissions = await this.persistence.listRoundSubmissions(match.id, round.roundId);
      this.roundLifecycle.prepareReveal(
        match,
        new Set(submissions.filter((submission) => submission.status === "completed").map((submission) => submission.evaluationId)),
        this.evaluation.forRound(match.id, round.roundId).map((entry) => entry.evaluationId),
      );
    }

    if (!reveal) {
      reveal = await this.createRevealSnapshot(match, round, "ROUND_DEADLINE");
      await this.persistence.publishReveal(match.id, round.roundId, reveal);
    }

    if (!round.reveal) {
      this.roundLifecycle.commitReveal(match, reveal, "ROUND_DEADLINE");
    }

    round.closing = false;
    round.cutoffPassed = true;
    for (const side of Object.keys(round.activities)) {
      if (this.activityOf(round, side) !== "locked") {
        await this.setActivity(match, round, side, "locked");
      }
    }
    this.rememberDeadline(match);
    await this.authority.saveMatch(match);
    if (!wasRevealed) this.emit("reveal.published", { matchId: match.id, round: match.currentRound });
  }

  private async createRevealSnapshot(match: MatchRecord, round: RoundState, cause?: RevealCause): Promise<RevealSnapshot> {
    const scores: Partial<Record<SideId, number>> = {};
    const groups: RevealSnapshot["groups"] = {};
    const totals: Partial<Record<SideId, number>> = {};
    const noSubmission: Partial<Record<SideId, boolean>> = {};
    for (const side of Object.keys(round.activities)) {
      scores[side] = round.counted[side]?.score ?? 0;
      const latest = await this.latestCompleted(match.id, round.roundId, side);
      groups[side] = latest?.groups ?? [];
      totals[side] = this.roundLifecycle.totalScore(match, side);
      noSubmission[side] = latest === undefined;
    }
    return this.roundLifecycle.createReveal(match, {
      scores,
      groups,
      totals,
      publishedAt: this.clock(),
      cause,
      noSubmission,
    });
  }

  /**
   * Caller holds the lock and a loaded match. Records a grace forfeit when an
   * offline side (previously online, never rejoined) exhausts the window.
   * Both sides past grace: earliest-offline side forfeits, deterministically.
   */
  private applyGraceToMatch(match: MatchRecord): boolean {
    if (match.roundPhase === "MATCH_COMPLETE" || match.forfeit || this.isExpired(match)) return false;
    const now = this.clock();
    if (match.mode === "2v2") {
      const sides = Object.keys(match.rounds[0]?.activities ?? {});
      const expiredSides = sides.flatMap((side) => {
        const members = match.participants.filter((participant) => participant.sideId === side);
        if (members.length === 0) return [];
        const unavailableSince = members.map((member) => {
          const offlineSince = match.memberOfflineSinceMs?.[member.userId];
          if (offlineSince !== undefined) return offlineSince;
          return match.departedMembers?.includes(member.userId) ? match.startedAt : undefined;
        });
        if (unavailableSince.some((timestamp) => timestamp === undefined)) return [];
        const teamUnavailableSince = Math.max(...unavailableSince as number[]);
        return teamUnavailableSince + this.reconnectGraceMs <= now ? [{ side, teamUnavailableSince }] : [];
      }).sort((a, b) => a.teamUnavailableSince - b.teamUnavailableSince);
      const loser = expiredSides[0]?.side;
      if (!loser) return false;
      const winner = sides.find((candidate) => candidate !== loser);
      if (!winner) return false;
      this.recordForfeit(match, winner, loser, "grace-expired");
      return true;
    }
    const expired = Object.entries(match.offlineSinceMs)
      .filter(([, since]) => since !== undefined && since + this.reconnectGraceMs <= now)
      .sort((a, b) => a[1]! - b[1]!);
    if (expired.length === 0) return false;
    const loser = expired[0]![0];
    const winner = match.participants.find((p) => p.sideId !== loser)?.sideId ?? loser;
    this.recordForfeit(match, winner, loser, "grace-expired");
    return true;
  }

  /**
   * Explicit leave removes one 2v2 teammate; a 1v1 leave forfeits immediately.
   */
  async leaveMatch(
    principal: AuthenticatedPrincipal,
    matchId: string,
  ): Promise<{ winner: SideId; loser: SideId } | { winner: SideId | null; loser: SideId; teammateContinues: boolean }> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      if (match.roundPhase === "MATCH_COMPLETE" || match.forfeit) {
        throw new IllegalStateError("match already complete");
      }
      const loser = this.sideOf(match, principal);
      const winner = match.participants.find((p) => p.sideId !== loser)?.sideId ?? loser;
      if (match.mode === "2v2") {
        match.departedMembers ??= [];
        if (!match.departedMembers.includes(principal.userId)) match.departedMembers.push(principal.userId);
        match.memberPresence ??= {};
        match.memberPresence[principal.userId] = "offline";
        match.memberOfflineSinceMs ??= {};
        match.memberOfflineSinceMs[principal.userId] = this.clock();
        const round = this.currentRound(match);
        if (round.readiness) delete round.readiness[principal.userId];
        this.clearSurrenderVotesForSide(match, loser);
        const teammates = match.participants.filter((member) => member.sideId === loser);
        const everyoneLeft = teammates.every((member) => match.departedMembers?.includes(member.userId));
        await this.authority.saveMatch(match);
        return { winner: null, loser, teammateContinues: !everyoneLeft };
      }
      this.recordForfeit(match, winner, loser, "leave");
      await this.authority.saveMatch(match);
      return { winner, loser };
    });
  }

  /** Request or cancel a team's unanimous surrender. */
  async setSurrenderVote(
    principal: AuthenticatedPrincipal,
    matchId: string,
    approve: boolean,
  ): Promise<{ complete: boolean }> {
    if (this.deadlineHasElapsedOrUnknown(matchId)) await this.closeExpiredMatch(matchId);
    return this.withMatchLock(matchId, async () => {
      const match = await this.requireMember(principal, matchId);
      if (match.roundPhase === "MATCH_COMPLETE" || match.forfeit) {
        throw new IllegalStateError("match already complete");
      }
      this.requireUnexpired(match);
      if (match.mode !== "2v2") throw new IllegalStateError("team surrender is only available in 2v2");
      const side = this.sideOf(match, principal);
      const activeMembers = match.participants.filter((member) => member.sideId === side &&
        !match.departedMembers?.includes(member.userId) &&
        (match.memberOfflineSinceMs?.[member.userId] === undefined ||
          match.memberOfflineSinceMs[member.userId]! + this.reconnectGraceMs > this.clock()));
      if (!activeMembers.some((member) => member.userId === principal.userId)) {
        throw new NotMemberError(matchId);
      }
      const votes = new Set(match.surrenderVotes ?? []);
      if (approve) votes.add(principal.userId);
      else votes.delete(principal.userId);
      const activeMemberIds = new Set(activeMembers.map((member) => member.userId));
      match.surrenderVotes = [...votes].filter((userId) => {
        const voter = match.participants.find((member) => member.userId === userId);
        return voter !== undefined && (voter.sideId !== side || activeMemberIds.has(userId));
      });
      const complete = activeMembers.every((member) => votes.has(member.userId));
      if (complete) {
        const winner = match.participants.find((member) => member.sideId !== side)?.sideId;
        if (!winner) throw new IllegalStateError("opposing team is missing");
        this.recordForfeit(match, winner, side, "surrender");
      }
      await this.authority.saveMatch(match);
      this.emit("surrender.changed", { matchId });
      return { complete };
    });
  }

  /** Immediately deny new game actions from this account while erasure runs. */
  blockAccount(userId: string): void {
    this.blockedAccounts.add(userId);
  }

  /**
   * Remove a deleted user's identity and code while keeping public match
   * results. In 2v2 the source belongs to the team side, so the whole side's
   * submissions and shared documents are erased together.
   */
  async eraseAccount(userId: string): Promise<void> {
    this.blockAccount(userId);
    for (const matchId of await this.persistence.listMatchIds()) {
      const initial = await this.persistence.loadMatch(matchId);
      if (!initial?.participants.some((participant) => participant.userId === userId)) continue;

      // Drain accepted submission setup first, then let each evaluation make
      // its terminal commit before acquiring the erasure lock. Waiting under
      // that lock would deadlock the evaluation's final commit.
      await this.withMatchLock(matchId, async () => undefined);
      await Promise.all(this.evaluation.forMatch(matchId).map((entry) => entry.promise));

      await this.withRevisionRetry(matchId, async () => {
        const match = await this.loadMatchOrThrow(matchId);
        const participant = match.participants.find((entry) => entry.userId === userId);
        if (!participant) return;
        const side = participant.sideId;

        if (match.roundPhase !== "MATCH_COMPLETE" && !match.forfeit) {
          const winner = match.participants.find((entry) => entry.sideId !== side)?.sideId ?? side;
          this.recordForfeit(match, winner, side, "leave");
        }

        const anonymousId = this.uniqueAnonymousId(match);
        const wasDeparted = match.departedMembers?.includes(userId) ?? false;
        participant.userId = anonymousId;
        participant.anonymized = true;
        delete match.memberPresence?.[userId];
        delete match.memberOfflineSinceMs?.[userId];
        if (match.departedMembers) {
          match.departedMembers = match.departedMembers.filter((memberId) => memberId !== userId);
          if (wasDeparted) match.departedMembers.push(anonymousId);
        }
        if (match.surrenderVotes) {
          match.surrenderVotes = match.surrenderVotes.filter((voterId) => voterId !== userId);
        }
        for (const round of match.rounds) {
          delete round.readiness?.[userId];
          delete round.runTests[side];
        }
        // Failure strings are diagnostic text and may include judge output.
        match.failures = [];

        await this.authority.eraseMatchSideData(match, [side]);
        this.teamCollaboration.destroySide(match, side);
      });
    }
  }

  private uniqueAnonymousId(match: MatchRecord): string {
    let userId = this.uuid();
    while (match.participants.some((participant) => participant.userId === userId)) userId = this.uuid();
    return userId;
  }

  private clearSurrenderVotesForSide(match: MatchRecord, side: SideId): void {
    if (!match.surrenderVotes) return;
    match.surrenderVotes = match.surrenderVotes.filter((voterId) =>
      match.participants.some((participant) => participant.userId === voterId && participant.sideId !== side),
    );
  }

  private recordForfeit(match: MatchRecord, winner: SideId, loser: SideId, reason: ForfeitRecord["reason"]): void {
    match.forfeit = { winner, loser, at: this.clock(), reason };
    match.roundPhase = "MATCH_COMPLETE";
    this.emit("match.ended", { matchId: match.id, result: "forfeit", winner, loser, reason });
  }

  /**
   * Boot recovery (ticket 11 §10). The service awaits this before serving.
   * Per known match: presence goes offline with a fresh grace window (sockets
   * die with the process); transient activities in the live round are
   * repaired (`running`/`submitted` back to `coding`; `evaluating` kept only
   * when its pending submission still exists); an interrupted reveal flip is
   * finished from the persisted immutable reveal or unwound. Then every
   * pending submission is re-driven through the judge EXACTLY once under its
   * original ids (idempotent retry): live round → normal commit (counted or
   * superseded by the shared rule); stale round or dead match → superseded
   * without judging; judge failure → explicit failed, never fabricated.
   */
  async recover(): Promise<{ matches: number; retried: number; failed: number }> {
    let retried = 0;
    let failed = 0;
    const ids = await this.persistence.listMatchIds();
    for (const id of ids) {
      await this.withRevisionRetry(id, async () => {
        const match = await this.loadMatchOrThrow(id);
        const now = this.clock();
        for (const p of match.participants) {
          match.presence[p.sideId] = "offline";
          match.offlineSinceMs[p.sideId] = now;
        }
        if (match.mode === "2v2") {
          match.memberPresence ??= {};
          match.memberOfflineSinceMs ??= {};
          for (const p of match.participants) {
            match.memberPresence[p.userId] = "offline";
            match.memberOfflineSinceMs[p.userId] = now;
          }
        }
        if (match.roundPhase !== "MATCH_COMPLETE") {
          const round = this.currentRound(match);
          const pendingSides = new Set(
            (await this.persistence.listRoundSubmissions(id, round.roundId))
              .filter((s) => s.status === "pending")
              .map((s) => s.sideId),
          );
          for (const side of Object.keys(round.activities)) {
            const activity = this.activityOf(round, side);
            if (activity === "running" || activity === "submitted") {
              round.activities[side] = "coding";
            } else if (activity === "evaluating" && !pendingSides.has(side)) {
              round.activities[side] = "coding";
              await this.recordFailure(match, "recover: evaluating without a pending submission");
            }
          }
          if (round.closing || round.cutoffPassed) {
            const published = await this.persistence.findReveal(id, round.roundId);
            if (published && !round.reveal) {
              round.reveal = published;
              round.closing = false;
              match.roundPhase = "SCORE_REVEAL";
              for (const side of Object.keys(round.activities)) {
                if (this.activityOf(round, side) !== "locked") round.activities[side] = "locked";
              }
              await this.authority.saveMatch(match);
              this.emit("reveal.published", { matchId: match.id, round: match.currentRound });
            } else if (!published) {
              round.closing = false;
              round.cutoffPassed = false;
              round.superseded = [];
            }
          }
        }
        await this.authority.saveMatch(match);
      });
    }
    const recovery = await this.evaluation.recoverPending();
    retried = recovery.retried;
    failed = recovery.failed;
    // The service does not accept clients until this work is complete. Start
    // reconnect grace when it is actually ready, not before slow judge retries.
    const recoveryReadyAt = this.clock();
    for (const id of ids) {
      await this.withRevisionRetry(id, async () => {
        const match = await this.loadMatchOrThrow(id);
        for (const participant of match.participants) {
          match.presence[participant.sideId] = "offline";
          match.offlineSinceMs[participant.sideId] = recoveryReadyAt;
        }
        if (match.mode === "2v2") {
          match.memberPresence ??= {};
          match.memberOfflineSinceMs ??= {};
          for (const participant of match.participants) {
            match.memberPresence[participant.userId] = "offline";
            match.memberOfflineSinceMs[participant.userId] = recoveryReadyAt;
          }
        }
        await this.authority.saveMatch(match);
      });
    }
    // Recovery can complete both sides' accepted scores with no live submit
    // request, so the game-owned automatic reveal is triggered here as well.
    // It is idempotent (an already published reveal is returned unchanged) and
    // a failed publish is retried by the next recovery or the deadline
    // closure, so the round never waits for a request that cannot arrive.
    for (const id of ids) {
      await this.autoRevealIfAllSidesCounted(id, { graceMs: 0 }).catch((error) => {
        console.error(`[arena] recovery reveal failed for match ${id}`, error);
      });
    }
    await this.sweepExpiredMatches();
    return { matches: ids.length, retried, failed };
  }

  private async requireMember(principal: AuthenticatedPrincipal, matchId: string, allowDeparted = false): Promise<MatchRecord> {
    if (this.blockedAccounts.has(principal.userId)) throw new NotMemberError(matchId);
    const match = await this.authority.requireMember(principal, matchId);
    if (!allowDeparted && match.departedMembers?.includes(principal.userId)) throw new NotMemberError(matchId);
    this.rememberDeadline(match);
    return match;
  }

  private requireActiveMember(match: MatchRecord, userId: string): void {
    if (match.departedMembers?.includes(userId)) throw new NotMemberError(match.id);
  }

  private async loadMatchOrThrow(matchId: string): Promise<MatchRecord> {
    const match = await this.authority.loadOrThrow(matchId);
    this.rememberDeadline(match);
    return match;
  }

  private rememberDeadline(match: MatchRecord): void {
    let deadline = match.startedAt + match.durationMs;
    if (match.roundPhase === "CODING") {
      const round = match.rounds[match.currentRound - 1];
      if (round?.codingDeadlineMs != null) {
        deadline = Math.min(deadline, round.codingDeadlineMs);
      }
    }
    this.deadlineByMatch.set(match.id, deadline);
  }

  private deadlineHasElapsedOrUnknown(matchId: string): boolean {
    const deadline = this.deadlineByMatch.get(matchId);
    return deadline === undefined || this.clock() >= deadline;
  }

  private sideOf(match: MatchRecord, principal: AuthenticatedPrincipal): SideId {
    return this.authority.sideOf(match, principal);
  }

  private currentRound(match: MatchRecord): RoundState {
    return this.authority.currentRound(match);
  }

  private activityOf(round: RoundState, side: SideId): PlayerStatus {
    return round.activities[side] ?? "coding";
  }

  private async setActivity(match: MatchRecord, round: RoundState, side: SideId, next: PlayerStatus): Promise<void> {
    this.transitionActivity(match, round, side, next);
    await this.authority.saveMatch(match);
    this.emit("player.statusChanged", { matchId: match.id, side, status: next });
  }

  private transitionActivity(match: MatchRecord, round: RoundState, side: SideId, next: PlayerStatus): void {
    const from = this.activityOf(round, side);
    if (!canSideTransition(from, next)) {
      throw new IllegalStateError(`illegal side transition ${side} ${from} -> ${next}`);
    }
    round.activities[side] = next;
  }

  private requireUnexpired(match: MatchRecord): void {
    if (this.isExpired(match)) throw new ExpiredError();
  }

  private isExpired(match: MatchRecord): boolean {
    return this.clock() >= match.startedAt + match.durationMs;
  }

  private requireRoundUnexpired(round: RoundState): void {
    if (round.codingDeadlineMs != null && this.clock() >= round.codingDeadlineMs) {
      throw new ExpiredError("round coding deadline expired");
    }
    if (round.cutoffPassed) {
      throw new ExpiredError("round coding cutoff passed");
    }
  }

  private validateSource(code: string): void {
    if (code.length === 0) throw new ValidationError("empty source");
    if (code.length > this.maxSourceBytes) {
      throw new ValidationError(`source exceeds ${this.maxSourceBytes} bytes`);
    }
  }

  private checkRate(matchId: string, side: SideId): void {
    const key = `${matchId}:${side}`;
    const now = this.clock();
    const stamps = (this.runStamps.get(key) ?? []).filter((t) => now - t < this.rate.windowMs);
    if (stamps.length >= this.rate.maxRunsPerWindow) {
      throw new RateLimitedError(`run rate exceeded for ${side}`);
    }
    stamps.push(now);
    this.runStamps.set(key, stamps);
  }

  private async latestCompleted(matchId: string, roundId: string, side: SideId): Promise<SubmissionRecord | undefined> {
    const all = (await this.persistence.listRoundSubmissions(matchId, roundId)).filter(
      (s) => s.sideId === side && s.status === "completed",
    );
    return all[all.length - 1];
  }

  private async recordFailure(match: MatchRecord, message: string): Promise<void> {
    match.failures.push(message);
    await this.authority.saveMatch(match);
  }
}

export interface SealedSnapshot {
  matchId: string;
  mode: MatchMode;
  roundPhase: MatchRecord["roundPhase"];
  round: number;
  totalRounds: number;
  remainingMs: number;
  roundRemainingMs?: number | null;
  expired: boolean;
  mySide: SideId;
  /** Monotonic mutation counter (§3): clients drop events/responses below this. */
  revision: number;
  /** Caller side has a judge evaluation still in flight (survives restart). */
  pendingEvaluation: boolean;
  /** Terminal result once MATCH_COMPLETE (score sums + forfeit override). */
  final: {
    scores: Partial<Record<SideId, number>>;
    outcome: "left" | "right" | "draw";
    winner: SideId | null;
    forfeit: ForfeitRecord | null;
  } | null;
  problem: {
    problemVersionId: string;
    title: string;
    description: string;
    examples: Array<{ id: string; input: string; expected: string }>;
    starters: Partial<Record<SupportedLanguage, string>>;
  };
  visibleTests: Array<{ id: string; input: string; expected: string }>;
  /** Requesting side's last visible-run results (idle before the first run). */
  tests: Array<{ id: string; status: "idle" | "running" | "passed" | "failed"; output: string | null; ms: number | null }>;
  sides: Record<SideId, { status: PlayerStatus; submissions: number; presence: "online" | "offline" }>;
  /**
   * 2v2 only: per-team competitive state. Never carries opponent source
   * (the server stores none), hidden tests, sealed scores, or the opponent's
   * document revision. Absent in 1v1.
   */
  teams?: TeamSnapshot[];
  reveal: RevealSnapshot | null;
  failures: string[];
}
