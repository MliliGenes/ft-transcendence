import { createHash } from "node:crypto";
import { resolveProblemExecution } from "./problem-execution.js";
import type { ArenaEvent, PlayerStatus } from "arena-model";
import type { DriverKind, GameJudge, JudgeLimits, SealedGroup, SnippetOptions, SupportedLanguage } from "./judge-types.js";
import { assertSupportedLanguage, JudgeInfraError } from "./judge-types.js";
import { DuplicateError } from "./store.js";
import { IllegalStateError } from "./match-authority.js";
import type { EvaluationClaim, MatchPersistence } from "./persistence-types.js";
import type {
  CountedResult,
  DocumentRevision,
  MatchRecord,
  RoundState,
  SideId,
  SubmissionRecord,
} from "./records.js";
import type { RoundLifecycle, SealedVerdict } from "./round-lifecycle.js";
import type {
  EvaluationTelemetry,
  EvaluationTelemetryOutcome,
} from "./evaluation-telemetry.js";

export type EvaluationCompletion = { ok: true } | { ok: false; error: unknown };

interface EvaluationIdentity {
  matchId: string;
  roundId: string;
  sideId: SideId;
  submissionId: string;
  problemVersionId: string;
  language: SupportedLanguage;
  sourceHash: string;
  documentRevision: DocumentRevision | null;
}

interface InFlightEvaluation extends EvaluationIdentity {
  evaluationId: string;
  promise: Promise<EvaluationCompletion>;
  resolve: (completion: EvaluationCompletion) => void;
}

/**
 * Process-local ownership for evaluations accepted by this Game instance.
 *
 * Durable ownership still belongs to MatchPersistence.claimPendingEvaluation.
 * This registry only lets duplicate requests in the same process attach to
 * one logical evaluation and lets reveal wait for evaluations already running.
 */
class EvaluationInFlightRegistry {
  private readonly entries = new Map<string, InFlightEvaluation>();
  private readonly settledFailures = new Map<string, unknown>();

  get(evaluationId: string): InFlightEvaluation | undefined {
    return this.entries.get(evaluationId);
  }

  track(evaluationId: string, identity: EvaluationIdentity): InFlightEvaluation {
    let resolve!: (completion: EvaluationCompletion) => void;
    const promise = new Promise<EvaluationCompletion>((settle) => {
      resolve = settle;
    });
    const entry: InFlightEvaluation = { evaluationId, ...identity, promise, resolve };
    this.entries.set(evaluationId, entry);
    return entry;
  }

  settle(evaluationId: string, tracked: InFlightEvaluation, completion: EvaluationCompletion): void {
    if (this.entries.get(evaluationId) === tracked) this.entries.delete(evaluationId);
    if (completion.ok) {
      this.settledFailures.delete(evaluationId);
    } else {
      this.settledFailures.set(evaluationId, completion.error);
      if (this.settledFailures.size > 256) {
        const oldest = this.settledFailures.keys().next().value;
        if (oldest !== undefined) this.settledFailures.delete(oldest);
      }
    }
    tracked.resolve(completion);
  }

  failureFor(evaluationId: string): unknown {
    return this.settledFailures.get(evaluationId);
  }

  forRound(
    matchId: string,
    roundId: string,
  ): Array<{ evaluationId: string; promise: Promise<EvaluationCompletion> }> {
    const out: Array<{ evaluationId: string; promise: Promise<EvaluationCompletion> }> = [];
    for (const [evaluationId, entry] of this.entries) {
      if (entry.matchId === matchId && entry.roundId === roundId) {
        out.push({ evaluationId, promise: entry.promise });
      }
    }
    return out;
  }
}

interface EvaluationRunInput extends SnippetOptions {
  matchId: string;
  roundNo: number;
  roundId: string;
  sideId: SideId;
  submissionId: string;
  evaluationId: string;
  problemVersionId: string;
  hiddenSuiteId: string;
  language: SupportedLanguage;
  driver: DriverKind;
  entrypoint?: string;
  source: string;
  groups: SealedGroup[];
  documentRevision: DocumentRevision | null;
  tracked: InFlightEvaluation;
}

/** Accepted command context; pending acceptance stays with the Match facade. */
export interface EvaluationSubmission extends EvaluationIdentity {
  evaluationId: string;
  roundNo: number;
  hiddenSuiteId: string;
  liveWindow?: boolean;
  acceptPending(existing: SubmissionRecord | undefined): Promise<SubmissionRecord>;
}

interface EvaluationRetryRequest {
  mode: MatchRecord["mode"];
  sideId: SideId;
  code: string;
  language: string;
  submissionId?: string;
  evaluationId?: string;
  documentRevision?: DocumentRevision;
}

interface EvaluationRetryRound {
  roundNo: number;
  hiddenSuiteId: string;
  liveWindow: boolean;
}

type EvaluationRetryLookup = (
  request: EvaluationRetryRequest,
  roundContext: (record: SubmissionRecord) => EvaluationRetryRound,
) => Promise<EvaluationSubmission | undefined>;

export interface EvaluationReceipt {
  ok: true;
  round: number;
  submissionId: string;
  evaluationId: string;
}

export interface EvaluationRecoveryReport {
  retried: number;
  failed: number;
}

interface EvaluationProblemBank {
  loadProblem(problemVersionId: string): {
    driver?: DriverKind;
    entrypoint?: string;
    snippets?: Partial<Record<SupportedLanguage, SnippetOptions>>;
    hidden: Array<{
      name: string;
      weight: number;
      tests: Array<{ id: string; input: string; expected: string }>;
    }>;
  };
}

export interface EvaluationOrchestrationHost {
  commitClaimedEvaluation(claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord): Promise<void>;
  withMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T>;
  loadMatchOrThrow(matchId: string): Promise<MatchRecord>;
  currentRound(match: MatchRecord): RoundState;
  activityOf(round: RoundState, side: SideId): PlayerStatus;
  transitionActivity(match: MatchRecord, round: RoundState, side: SideId, next: PlayerStatus): void;
  emit(event: ArenaEvent, payload: unknown): void;
}

export interface EvaluationOrchestratorOptions {
  judge: GameJudge;
  bank: EvaluationProblemBank;
  persistence: MatchPersistence;
  roundLifecycle: RoundLifecycle;
  clock: () => number;
  /** Time after Match expiry during which already-accepted evaluations may count. */
  deadlineGraceMs: number;
  limits: JudgeLimits;
  telemetry?: EvaluationTelemetry;
  host: EvaluationOrchestrationHost;
}

function buildRunInput(
  matchId: string,
  input: EvaluationSubmission,
  record: SubmissionRecord,
  problem: ReturnType<EvaluationProblemBank["loadProblem"]>,
  tracked: InFlightEvaluation,
): EvaluationRunInput {
  const language = record.language as SupportedLanguage;
  const execution = resolveProblemExecution(problem, language);
  return {
    matchId,
    roundNo: input.roundNo,
    roundId: record.roundId,
    sideId: record.sideId,
    submissionId: record.submissionId,
    evaluationId: record.evaluationId,
    problemVersionId: record.problemVersionId,
    hiddenSuiteId: input.hiddenSuiteId,
    language,
    driver: execution.driver,
    ...execution.snippet,
    source: record.source,
    groups: problem.hidden.map((group) => ({
      name: group.name,
      weight: group.weight,
      tests: group.tests.map((test) => ({ id: test.id, input: test.input, expected: test.expected })),
    })),
    documentRevision: record.documentRevision ?? null,
    tracked,
  };
}

function isSubmissionWithinGrace(
  match: MatchRecord,
  submittedAt: number,
  now: number,
  graceMs: number,
): boolean {
  const matchDeadline = match.startedAt + match.durationMs;
  return submittedAt < matchDeadline && now <= matchDeadline + graceMs;
}

function isRecoverableRound(
  match: MatchRecord | null | undefined,
  round: RoundState | undefined,
  submittedAt: number,
  now: number,
  graceMs: number,
): boolean {
  if (!match || !round) return false;
  const isCurrentRound = round.roundId === match.rounds[match.currentRound - 1]?.roundId;
  return (
    match.roundPhase === "CODING" &&
    isCurrentRound &&
    !round.cutoffPassed &&
    isSubmissionWithinGrace(match, submittedAt, now, graceMs)
  );
}

function applySubmissionScoring(
  stored: SubmissionRecord,
  round: RoundState,
  side: SideId,
  scored: NonNullable<ReturnType<RoundLifecycle["scoreVerdict"]>>,
  isCompetitive: boolean,
): void {
  const { score, scoreBp, groups: groupResults, testStatuses: statuses } = scored;
  stored.scoreBp = scoreBp;
  stored.groups = groupResults;
  stored.testStatuses = statuses;

  if (isCompetitive) {
    round.attempts[side] = (round.attempts[side] ?? 0) + 1;
    round.counted[side] = { score, scoringTimeMs: stored.elapsedMatchMs };
    stored.status = "completed";
    stored.score = score;
  } else {
    stored.status = "superseded";
    stored.score = null;
  }
}

function isCompetitiveRound(
  match: MatchRecord,
  round: RoundState,
  currentRoundId: string,
  evaluationId: string,
  submittedAt: number,
  now: number,
  graceMs: number,
): boolean {
  const matchDeadline = match.startedAt + match.durationMs;
  const withinDeadlineGrace = submittedAt < matchDeadline && now <= matchDeadline + graceMs;
  return (
    match.roundPhase === "CODING" &&
    round.roundId === currentRoundId &&
    !round.cutoffPassed &&
    !round.superseded.includes(evaluationId) &&
    withinDeadlineGrace
  );
}

function extractTelemetryPayload(
  judge: GameJudge,
  evaluationId: string,
  outcome: EvaluationTelemetryOutcome,
  startedAt: number,
  now: number,
) {
  const metrics = judge.consumeMetrics?.();
  const provider = metrics?.provider ?? judge.provider ?? judge.constructor.name;
  const queueWaitMs = metrics?.queueWaitMs ?? 0;
  const executionMs = metrics?.executionMs ?? Math.max(0, now - startedAt);
  return { evaluationId, provider, queueWaitMs, executionMs, outcome };
}

/**
 * Owns the lock-free/locked phases of a logical Evaluation.
 *
 * ArenaEngine remains the compatibility facade: it authorizes the request,
 * creates the durable pending Submission, and supplies short Match commands
 * and transport events through a structural host. This module owns immutable
 * retry validation and completion as well as the work shared by direct Submit
 * and boot recovery: durable claim, provider invocation, failure classification,
 * and claim-session commit. Internal attachment bookkeeping stays private.
 */
export class EvaluationOrchestrator {
  private readonly inFlight = new EvaluationInFlightRegistry();

  constructor(private readonly options: EvaluationOrchestratorOptions) {}

  forRound(
    matchId: string,
    roundId: string,
  ): Array<{ evaluationId: string; promise: Promise<EvaluationCompletion> }> {
    return this.inFlight.forRound(matchId, roundId);
  }

  /** Authorize/accept under a short command lock, then complete outside it. */
  async submit(
    matchId: string,
    prepare: (recoverRetry: EvaluationRetryLookup) => Promise<EvaluationSubmission>,
  ): Promise<EvaluationReceipt> {
    let owned: { evaluationId: string; tracked: InFlightEvaluation } | undefined;
    const setup = await this.options.host.withMatchLock(matchId, async () => {
      const input = await prepare((request, roundContext) => this.prepareRetry(matchId, request, roundContext));
      const identity = this.identityFor(input);
      if (identity.matchId !== matchId) {
        throw new DuplicateError("evaluation request does not belong to this Match command");
      }
      const duplicate = this.inFlight.get(input.evaluationId);
      if (duplicate) {
        this.assertIdentity(identity, duplicate);
        return { attached: true as const, roundNo: input.roundNo,
          evaluationId: input.evaluationId, waitFor: duplicate.promise };
      }
      const tracked = this.inFlight.track(input.evaluationId, identity);
      owned = { evaluationId: input.evaluationId, tracked };
      const existing = await this.options.persistence.findSubmissionByEvaluationId(input.evaluationId);
      const existingResult = this.checkExistingPendingStatus(existing, input, tracked);
      if (existingResult) return existingResult;

      const record = await input.acceptPending(existing);
      if (record.evaluationId !== input.evaluationId) {
        throw new DuplicateError("accepted submission has a different evaluation id");
      }
      this.assertIdentity(identity, this.identityFor(record));
      const problem = this.options.bank.loadProblem(input.problemVersionId);
      return {
        attached: false as const,
        input: buildRunInput(matchId, input, record, problem, tracked),
      };
    }).catch((error: unknown) => {
      // Include errors from the host's final durable save, not just acceptance.
      if (owned) this.inFlight.settle(owned.evaluationId, owned.tracked, { ok: false, error });
      throw error;
    });
    if (!setup.attached) return this.run(setup.input);
    if ("waitFor" in setup && setup.waitFor) {
      const completion = await setup.waitFor;
      if (!completion.ok) throw completion.error;
    }
    const stored = await this.storedSubmission(setup.evaluationId);
    return { ok: true, round: setup.roundNo, submissionId: stored.submissionId, evaluationId: setup.evaluationId };
  }

  private checkExistingPendingStatus(
    existing: SubmissionRecord | undefined,
    input: EvaluationSubmission,
    tracked: InFlightEvaluation,
  ): { attached: true; roundNo: number; evaluationId: string; waitFor?: Promise<EvaluationCompletion> } | undefined {
    if (!existing) return undefined;
    this.assertIdentity(this.identityFor(input), this.identityFor(existing));
    if (existing.status !== "pending") {
      if (existing.status === "failed") {
        throw this.inFlight.failureFor(input.evaluationId) ?? new JudgeInfraError("evaluation previously failed");
      }
      this.inFlight.settle(input.evaluationId, tracked, { ok: true });
      return { attached: true, roundNo: input.roundNo, evaluationId: input.evaluationId };
    }
    if (input.liveWindow === false) {
      throw new IllegalStateError("evaluation is still pending recovery");
    }
    return undefined;
  }

  private async prepareRetry(
    matchId: string,
    request: EvaluationRetryRequest,
    roundContext: (record: SubmissionRecord) => EvaluationRetryRound,
  ): Promise<EvaluationSubmission | undefined> {
    if (request.submissionId !== undefined && request.submissionId.trim() === ""
      || request.evaluationId !== undefined && request.evaluationId.trim() === "") {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
    const existing = await this.findRetrySubmission(request);
    if (!existing) return undefined;
    this.assertRetryOwnership(matchId, request, existing);
    const round = roundContext(existing);
    const language = this.validateRetrySource(request, existing);
    this.assertRetryRevision(request, existing, round.liveWindow);
    return {
      matchId,
      ...round,
      roundId: existing.roundId,
      sideId: existing.sideId,
      submissionId: existing.submissionId,
      evaluationId: existing.evaluationId,
      problemVersionId: existing.problemVersionId,
      language,
      sourceHash: existing.sourceHash,
      documentRevision: existing.documentRevision ?? null,
      acceptPending: async () => existing,
    };
  }

  private async findRetrySubmission(request: EvaluationRetryRequest): Promise<SubmissionRecord | undefined> {
    const byEvaluation = request.evaluationId !== undefined
      ? await this.options.persistence.findSubmissionByEvaluationId(request.evaluationId)
      : undefined;
    const bySubmission = request.submissionId !== undefined
      ? await this.options.persistence.findSubmissionById(request.submissionId)
      : undefined;
    if (byEvaluation && bySubmission && byEvaluation.submissionId !== bySubmission.submissionId) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
    return byEvaluation ?? bySubmission;
  }

  private assertRetryOwnership(matchId: string, request: EvaluationRetryRequest, existing: SubmissionRecord): void {
    if (existing.matchId !== matchId) {
      throw new DuplicateError("evaluation request does not belong to this Match command");
    }
    if (existing.sideId !== request.sideId
      || request.submissionId !== undefined && existing.submissionId !== request.submissionId
      || request.evaluationId !== undefined && existing.evaluationId !== request.evaluationId) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
  }

  private validateRetrySource(request: EvaluationRetryRequest, existing: SubmissionRecord): EvaluationSubmission["language"] {
    assertSupportedLanguage(request.language);
    if (request.language !== existing.language) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
    if (request.mode === "1v1") {
      const sourceHash = createHash("sha256").update(request.code, "utf8").digest("hex");
      if (sourceHash !== existing.sourceHash || request.code !== existing.source) {
        throw new DuplicateError("evaluation id is already bound to different submission data");
      }
    }
    return request.language;
  }

  private assertRetryRevision(request: EvaluationRetryRequest, existing: SubmissionRecord, liveWindow: boolean): void {
    // Team retries identify the server's frozen Y.Doc revision, not raw client code.
    if (request.documentRevision !== undefined && request.documentRevision !== (existing.documentRevision ?? undefined)
      || request.mode === "2v2" && !liveWindow && request.documentRevision === undefined) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
  }

  private assertIdentity(expected: EvaluationIdentity, actual: EvaluationIdentity): void {
    if (expected.matchId !== actual.matchId || expected.roundId !== actual.roundId
      || expected.sideId !== actual.sideId || expected.submissionId !== actual.submissionId
      || expected.problemVersionId !== actual.problemVersionId || expected.language !== actual.language
      || expected.sourceHash !== actual.sourceHash || expected.documentRevision !== actual.documentRevision) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
  }

  private async resolveUnclaimedRun(
    input: EvaluationRunInput,
  ): Promise<{ ok: true; round: number; submissionId: string; evaluationId: string }> {
    try {
      const settled = await this.options.persistence.findSubmissionByEvaluationId(input.evaluationId);
      if (!settled || settled.status === "pending") {
        throw new IllegalStateError("evaluation claim disappeared before completion");
      }
      if (settled.status === "failed") {
        throw new JudgeInfraError("evaluation previously failed");
      }
      this.inFlight.settle(input.evaluationId, input.tracked, { ok: true });
      return {
        ok: true,
        round: input.roundNo,
        submissionId: settled.submissionId,
        evaluationId: input.evaluationId,
      };
    } catch (error) {
      this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error });
      throw error;
    }
  }

  private async executeRunEvaluation(claim: EvaluationClaim, input: EvaluationRunInput): Promise<SealedVerdict> {
    try {
      claim.assertActive();
      return await this.evaluateSealed(input.evaluationId, {
        evaluationId: input.evaluationId,
        submissionId: input.submissionId,
        problemVersionId: input.problemVersionId,
        hiddenSuiteId: input.hiddenSuiteId,
        language: input.language,
        driver: input.driver,
        entrypoint: input.entrypoint,
        signature: input.signature,
        className: input.className,
        source: input.source,
        groups: input.groups,
        limits: this.options.limits,
      });
    } catch (error) {
      try {
        claim.assertActive();
      } catch (claimError) {
        this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error: claimError });
        throw claimError;
      }
      try {
        await this.options.host.withMatchLock(input.matchId, async () => {
          await this.failStoredEvaluation(
            claim,
            input.matchId,
            input.evaluationId,
            input.roundId,
            input.sideId,
            error,
          );
        });
      } catch (failureError) {
        this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error: failureError });
        throw failureError;
      }
      this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error });
      throw error;
    }
  }

  private async commitRunEvaluation(
    claim: EvaluationClaim,
    input: EvaluationRunInput,
    verdict: SealedVerdict,
  ): Promise<void> {
    let completion: EvaluationCompletion = { ok: true };
    try {
      claim.assertActive();
      await this.options.host.withMatchLock(input.matchId, async () => {
        await this.commitStoredEvaluation(
          claim,
          input.matchId,
          input.evaluationId,
          verdict,
          this.options.clock(),
        );
      });
    } catch (error) {
      completion = { ok: false, error };
      throw error;
    } finally {
      this.inFlight.settle(input.evaluationId, input.tracked, completion);
    }
  }

  private async run(input: EvaluationRunInput): Promise<{ ok: true; round: number; submissionId: string; evaluationId: string }> {
    let claim: EvaluationClaim | undefined;
    try {
      claim = await this.options.persistence.claimPendingEvaluation(input.evaluationId);
    } catch (error) {
      this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error });
      throw error;
    }
    if (!claim) {
      return this.resolveUnclaimedRun(input);
    }

    try {
      const verdict = await this.executeRunEvaluation(claim, input);
      await this.commitRunEvaluation(claim, input, verdict);
      return {
        ok: true,
        round: input.roundNo,
        submissionId: input.submissionId,
        evaluationId: input.evaluationId,
      };
    } finally {
      await claim.release();
    }
  }

  private async supersedePendingSubmission(matchId: string, evaluationId: string): Promise<void> {
    await this.options.host.withMatchLock(matchId, async () => {
      const gone = await this.options.persistence.findSubmissionByEvaluationId(evaluationId);
      if (gone && gone.status === "pending") {
        gone.status = "superseded";
        gone.score = null;
        await this.options.persistence.updateSubmission(gone);
      }
    });
  }

  private async executePendingRecovery(
    claim: EvaluationClaim,
    stored: SubmissionRecord,
    round: RoundState,
  ): Promise<{ kind: "retried" } | { kind: "failed"; error: unknown }> {
    claim.assertActive();
    let verdict: SealedVerdict;
    try {
      verdict = await this.evaluateStoredEvaluation(stored, round.hiddenSuiteId);
    } catch (error) {
      await this.options.host.withMatchLock(stored.matchId, async () => {
        await this.failStoredEvaluation(
          claim,
          stored.matchId,
          stored.evaluationId,
          stored.roundId,
          stored.sideId,
          error,
        );
      });
      return { kind: "failed", error };
    }
    claim.assertActive();
    await this.options.host.withMatchLock(stored.matchId, async () => {
      await this.commitStoredEvaluation(claim, stored.matchId, stored.evaluationId, verdict, this.options.clock());
    });
    return { kind: "retried" };
  }

  private async verifyClaimedPending(evaluationId: string): Promise<boolean> {
    const current = await this.options.persistence.findSubmissionByEvaluationId(evaluationId);
    return current?.status === "pending";
  }

  private async recoverSingleSubmission(
    stored: SubmissionRecord,
  ): Promise<"retried" | "failed" | "skipped"> {
    const tracked = this.inFlight.track(stored.evaluationId, this.identityFor(stored));
    let claim: EvaluationClaim | undefined;
    let judgeStarted = false;
    let completion: EvaluationCompletion = { ok: true };
    try {
      const match = await this.options.persistence.loadMatch(stored.matchId);
      const round = match?.rounds.find((candidate) => candidate.roundId === stored.roundId);
      if (!isRecoverableRound(match, round, stored.submittedAt, this.options.clock(), this.options.deadlineGraceMs)) {
        await this.supersedePendingSubmission(stored.matchId, stored.evaluationId);
        return "skipped";
      }
      claim = await this.options.persistence.claimPendingEvaluation(stored.evaluationId);
      if (!claim) return "skipped";
      if (!(await this.verifyClaimedPending(stored.evaluationId))) return "skipped";

      judgeStarted = true;
      const result = await this.executePendingRecovery(claim, stored, round!);
      if (result.kind === "failed") {
        completion = { ok: false, error: result.error };
        return "failed";
      }
      return "retried";
    } catch (error) {
      completion = { ok: false, error };
      if (!judgeStarted) throw error;
      claim?.assertActive();
      throw error;
    } finally {
      if (claim) await claim.release();
      this.inFlight.settle(stored.evaluationId, tracked, completion);
    }
  }

  /** Re-drive all durable pending submissions after the Game process starts. */
  async recoverPending(): Promise<EvaluationRecoveryReport> {
    let retried = 0;
    let failed = 0;
    for (const stored of await this.options.persistence.listPendingSubmissions()) {
      if (this.inFlight.get(stored.evaluationId)) continue;
      const outcome = await this.recoverSingleSubmission(stored);
      if (outcome === "retried") retried++;
      else if (outcome === "failed") failed++;
    }
    return { retried, failed };
  }

  private async evaluateStoredEvaluation(stored: SubmissionRecord, hiddenSuiteId: string): Promise<SealedVerdict> {
    const problem = this.options.bank.loadProblem(stored.problemVersionId);
    const language = stored.language as SupportedLanguage;
    const execution = resolveProblemExecution(problem, language);
    return this.evaluateSealed(stored.evaluationId, {
      evaluationId: stored.evaluationId,
      submissionId: stored.submissionId,
      problemVersionId: stored.problemVersionId,
      hiddenSuiteId,
      language,
      driver: execution.driver,
      ...execution.snippet,
      source: stored.source,
      groups: problem.hidden.map((group) => ({
        name: group.name,
        weight: group.weight,
        tests: group.tests.map((test) => ({ id: test.id, input: test.input, expected: test.expected })),
      })),
      limits: this.options.limits,
    });
  }

  private async evaluateSealed(
    evaluationId: string,
    request: Parameters<GameJudge["evaluateSealed"]>[0],
  ): Promise<SealedVerdict> {
    const startedAt = this.options.clock();
    try {
      const verdict = await this.options.judge.evaluateSealed(request);
      this.recordTelemetry(evaluationId, "completed", startedAt);
      return verdict;
    } catch (error) {
      this.recordTelemetry(
        evaluationId,
        error instanceof JudgeInfraError ? "infrastructure_error" : "failed",
        startedAt,
      );
      throw error;
    }
  }

  private recordTelemetry(evaluationId: string, outcome: EvaluationTelemetryOutcome, startedAt: number): void {
    const telemetry = this.options.telemetry;
    if (!telemetry) return;
    try {
      telemetry.record(
        extractTelemetryPayload(this.options.judge, evaluationId, outcome, startedAt, this.options.clock()),
      );
    } catch {
      // Telemetry is best effort and cannot change competitive Match state.
    }
  }

  private async finishEvaluationCommit(
    claim: EvaluationClaim,
    match: MatchRecord,
    round: RoundState,
    side: SideId,
    stored?: SubmissionRecord,
  ): Promise<void> {
    const activityChanged = this.options.host.activityOf(round, side) === "evaluating";
    if (activityChanged) this.options.host.transitionActivity(match, round, side, "coding");
    await this.options.host.commitClaimedEvaluation(claim, match, stored);
    if (activityChanged) this.options.host.emit("player.statusChanged", { matchId: match.id, side, status: "coding" });
  }

  private async commitStoredEvaluation(
    claim: EvaluationClaim,
    matchId: string,
    evaluationId: string,
    verdict: SealedVerdict,
    now: number,
  ): Promise<void> {
    const match = structuredClone(await this.options.host.loadMatchOrThrow(matchId));
    const stored = structuredClone(await this.storedSubmission(evaluationId));
    if (stored.status !== "pending") return;
    const round = match.rounds.find((candidate) => candidate.roundId === stored.roundId) ?? this.options.host.currentRound(match);
    const side = stored.sideId;
    const scored = this.options.roundLifecycle.scoreVerdict(verdict);
    if (!scored) {
      stored.status = "failed";
      stored.failureCode = "internal_error";
      match.failures.push("submit: judge returned non-competitive verdict set");
      await this.finishEvaluationCommit(claim, match, round, side, stored);
      throw new JudgeInfraError("judge returned non-competitive verdict set");
    }
    const currentRoundId = this.options.host.currentRound(match).roundId;
    const isCompetitive = isCompetitiveRound(
      match,
      round,
      currentRoundId,
      evaluationId,
      stored.submittedAt,
      now,
      this.options.deadlineGraceMs,
    );
    applySubmissionScoring(stored, round, side, scored, isCompetitive);
    await this.finishEvaluationCommit(claim, match, round, side, stored);
  }

  private async failStoredEvaluation(
    claim: EvaluationClaim,
    matchId: string,
    evaluationId: string,
    roundId: string,
    side: SideId,
    error: unknown,
  ): Promise<void> {
    const existing = await this.options.persistence.findSubmissionByEvaluationId(evaluationId);
    const stored = existing?.status === "pending" ? structuredClone(existing) : undefined;
    if (stored) {
      stored.status = "failed";
      stored.failureCode = error instanceof JudgeInfraError ? "internal_error" : "evaluation_error";
    }
    const match = structuredClone(await this.options.host.loadMatchOrThrow(matchId));
    match.failures.push(`submit: ${error instanceof Error ? error.message : String(error)}`);
    const round = match.rounds.find((candidate) => candidate.roundId === roundId) ?? this.options.host.currentRound(match);
    await this.finishEvaluationCommit(claim, match, round, side, stored);
  }

  private async storedSubmission(evaluationId: string): Promise<SubmissionRecord> {
    const stored = await this.options.persistence.findSubmissionByEvaluationId(evaluationId);
    if (!stored) throw new IllegalStateError("submission vanished");
    return stored;
  }

  private identityFor(stored: EvaluationIdentity | SubmissionRecord): EvaluationIdentity {
    return {
      matchId: stored.matchId,
      roundId: stored.roundId,
      sideId: stored.sideId,
      submissionId: stored.submissionId,
      problemVersionId: stored.problemVersionId,
      language: stored.language as SupportedLanguage,
      sourceHash: stored.sourceHash,
      documentRevision: stored.documentRevision ?? null,
    };
  }
}
