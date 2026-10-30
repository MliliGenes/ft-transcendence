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
      const problem = this.options.bank.loadProblem(input.problemVersionId);
      const duplicate = this.inFlight.get(input.evaluationId);
      if (duplicate) {
        this.assertIdentity(identity, duplicate);
        return { attached: true as const, roundNo: input.roundNo,
          evaluationId: input.evaluationId, waitFor: duplicate.promise };
      }
      const tracked = this.inFlight.track(input.evaluationId, identity);
      owned = { evaluationId: input.evaluationId, tracked };
      const existing = await this.options.persistence.findSubmissionByEvaluationId(input.evaluationId);
      if (existing) this.assertIdentity(identity, this.identityFor(existing));
      if (existing && existing.status !== "pending") {
        if (existing.status === "failed") {
          throw this.inFlight.failureFor(input.evaluationId) ?? new JudgeInfraError("evaluation previously failed");
        }
        this.inFlight.settle(input.evaluationId, tracked, { ok: true });
        return { attached: true as const, roundNo: input.roundNo, evaluationId: input.evaluationId };
      }
      if (existing && existing.status === "pending" && input.liveWindow === false) {
        throw new IllegalStateError("evaluation is still pending recovery");
      }
      const record = await input.acceptPending(existing);
      if (record.evaluationId !== input.evaluationId) {
        throw new DuplicateError("accepted submission has a different evaluation id");
      }
      this.assertIdentity(identity, this.identityFor(record));
      const execution = resolveProblemExecution(problem, record.language as SupportedLanguage);
      return { attached: false as const, input: {
        matchId, roundNo: input.roundNo, roundId: record.roundId, sideId: record.sideId,
        submissionId: record.submissionId, evaluationId: record.evaluationId,
        problemVersionId: record.problemVersionId, hiddenSuiteId: input.hiddenSuiteId,
        language: record.language as SupportedLanguage,
        driver: execution.driver,
        ...execution.snippet, source: record.source,
        groups: problem.hidden.map((group) => ({
          name: group.name, weight: group.weight,
          tests: group.tests.map((test) => ({ id: test.id, input: test.input, expected: test.expected })),
        })),
        documentRevision: record.documentRevision ?? null, tracked,
      } };
    }).catch((error: unknown) => {
      // Include errors from the host's final durable save, not just acceptance.
      if (owned) this.inFlight.settle(owned.evaluationId, owned.tracked, { ok: false, error });
      throw error;
    });
    if (!setup.attached) return this.run(setup.input);
    if (setup.waitFor) {
      const completion = await setup.waitFor;
      if (!completion.ok) throw completion.error;
    }
    const stored = await this.storedSubmission(setup.evaluationId);
    return { ok: true, round: setup.roundNo, submissionId: stored.submissionId, evaluationId: setup.evaluationId };
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
    const byEvaluation = request.evaluationId !== undefined
      ? await this.options.persistence.findSubmissionByEvaluationId(request.evaluationId)
      : undefined;
    const bySubmission = request.submissionId !== undefined
      ? await this.options.persistence.findSubmissionById(request.submissionId)
      : undefined;
    if (byEvaluation && bySubmission && byEvaluation.submissionId !== bySubmission.submissionId) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
    const existing = byEvaluation ?? bySubmission;
    if (!existing) return undefined;
    if (existing.matchId !== matchId) {
      throw new DuplicateError("evaluation request does not belong to this Match command");
    }
    if (existing.sideId !== request.sideId
      || request.submissionId !== undefined && existing.submissionId !== request.submissionId
      || request.evaluationId !== undefined && existing.evaluationId !== request.evaluationId) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
    const round = roundContext(existing);
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
    // Team retries identify the server's frozen Y.Doc revision, not raw client code.
    if (request.documentRevision !== undefined && request.documentRevision !== (existing.documentRevision ?? undefined)
      || request.mode === "2v2" && !round.liveWindow && request.documentRevision === undefined) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
    }
    return {
      matchId,
      ...round,
      roundId: existing.roundId,
      sideId: existing.sideId,
      submissionId: existing.submissionId,
      evaluationId: existing.evaluationId,
      problemVersionId: existing.problemVersionId,
      language: request.language,
      sourceHash: existing.sourceHash,
      documentRevision: existing.documentRevision ?? null,
      acceptPending: async () => existing,
    };
  }

  private assertIdentity(expected: EvaluationIdentity, actual: EvaluationIdentity): void {
    if (expected.matchId !== actual.matchId || expected.roundId !== actual.roundId
      || expected.sideId !== actual.sideId || expected.submissionId !== actual.submissionId
      || expected.problemVersionId !== actual.problemVersionId || expected.language !== actual.language
      || expected.sourceHash !== actual.sourceHash || expected.documentRevision !== actual.documentRevision) {
      throw new DuplicateError("evaluation id is already bound to different submission data");
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

    try {
      let verdict: SealedVerdict;
      try {
        claim.assertActive();
        const result = await this.evaluateSealed(input.evaluationId, {
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
        verdict = result;
      } catch (error) {
        try {
          claim.assertActive();
        } catch (claimError) {
          this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error: claimError });
          throw claimError;
        }
        try {
          await this.options.host.withMatchLock(
            input.matchId,
            async () => {
              await this.failStoredEvaluation(
                claim!,
                input.matchId,
                input.evaluationId,
                input.roundId,
                input.sideId,
                error,
              );
            },
          );
        } catch (failureError) {
          this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error: failureError });
          throw failureError;
        }
        this.inFlight.settle(input.evaluationId, input.tracked, { ok: false, error });
        throw error;
      }

      let completion: EvaluationCompletion = { ok: true };
      try {
        claim.assertActive();
        await this.options.host.withMatchLock(
          input.matchId,
          async () => {
            await this.commitStoredEvaluation(
              claim!,
              input.matchId,
              input.evaluationId,
              verdict,
              this.options.clock(),
            );
          },
        );
        return {
          ok: true,
          round: input.roundNo,
          submissionId: input.submissionId,
          evaluationId: input.evaluationId,
        };
      } catch (error) {
        completion = { ok: false, error };
        throw error;
      } finally {
        this.inFlight.settle(input.evaluationId, input.tracked, completion);
      }
    } finally {
      await claim.release();
    }
  }

  /** Re-drive all durable pending submissions after the Game process starts. */
  async recoverPending(): Promise<EvaluationRecoveryReport> {
    let retried = 0;
    let failed = 0;
    for (const stored of await this.options.persistence.listPendingSubmissions()) {
      if (this.inFlight.get(stored.evaluationId)) continue;
      const tracked = this.inFlight.track(stored.evaluationId, this.identityFor(stored));
      let claim: EvaluationClaim | undefined;
      let judgeStarted = false;
      let completion: EvaluationCompletion = { ok: true };
      try {
        const match = await this.options.persistence.loadMatch(stored.matchId);
        const round = match?.rounds.find((candidate) => candidate.roundId === stored.roundId);
        const matchDeadline = match ? match.startedAt + match.durationMs : undefined;
        const withinDeadlineGrace =
          matchDeadline !== undefined &&
          stored.submittedAt < matchDeadline &&
          this.options.clock() <= matchDeadline + this.options.deadlineGraceMs;
        const live =
          match &&
          match.roundPhase === "CODING" &&
          round &&
          round.roundId === match.rounds[match.currentRound - 1]?.roundId &&
          !round.cutoffPassed &&
          withinDeadlineGrace;
        if (!live) {
          await this.options.host.withMatchLock(stored.matchId, async () => {
            const gone = await this.options.persistence.findSubmissionByEvaluationId(stored.evaluationId);
            if (gone && gone.status === "pending") {
              gone.status = "superseded";
              gone.score = null;
              await this.options.persistence.updateSubmission(gone);
            }
          });
          continue;
        }
        claim = await this.options.persistence.claimPendingEvaluation(stored.evaluationId);
        if (!claim) continue;
        const current = await this.options.persistence.findSubmissionByEvaluationId(stored.evaluationId);
        if (!current || current.status !== "pending") continue;
        claim.assertActive();
        let verdict: SealedVerdict;
        try {
          judgeStarted = true;
          verdict = await this.evaluateStoredEvaluation(stored, round!.hiddenSuiteId);
        } catch (error) {
          completion = { ok: false, error };
          await this.options.host.withMatchLock(
            stored.matchId,
            async () => {
              await this.failStoredEvaluation(
                claim!,
                stored.matchId,
                stored.evaluationId,
                stored.roundId,
                stored.sideId,
                error,
              );
            },
          );
          failed++;
          continue;
        }
        claim.assertActive();
        await this.options.host.withMatchLock(
          stored.matchId,
          async () => {
            await this.commitStoredEvaluation(claim!, stored.matchId, stored.evaluationId, verdict, this.options.clock());
          },
        );
        retried++;
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
    // Rollout measurements must never replace a judge verdict or its error.
    try {
      const metrics = this.options.judge.consumeMetrics?.();
      telemetry.record({
        evaluationId,
        provider: metrics?.provider ?? this.options.judge.provider ?? this.options.judge.constructor.name,
        queueWaitMs: metrics?.queueWaitMs ?? 0,
        executionMs: metrics?.executionMs ?? Math.max(0, this.options.clock() - startedAt),
        outcome,
      });
    } catch {
      // Telemetry is best effort and cannot change competitive Match state.
    }
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
      const activityChanged = this.options.host.activityOf(round, side) === "evaluating";
      if (activityChanged) this.options.host.transitionActivity(match, round, side, "coding");
      await this.options.host.commitClaimedEvaluation(claim, match, stored);
      if (activityChanged) this.options.host.emit("player.statusChanged", { matchId: match.id, side, status: "coding" });
      throw new JudgeInfraError("judge returned non-competitive verdict set");
    }
    const { score, scoreBp, groups: groupResults, testStatuses: statuses } = scored;
    const matchDeadline = match.startedAt + match.durationMs;
    const withinDeadlineGrace = stored.submittedAt < matchDeadline && now <= matchDeadline + this.options.deadlineGraceMs;
    if (
      match.roundPhase === "CODING" &&
      round.roundId === this.options.host.currentRound(match).roundId &&
      !round.cutoffPassed &&
      !round.superseded.includes(evaluationId) &&
      withinDeadlineGrace
    ) {
      const attempts = (round.attempts[side] ?? 0) + 1;
      round.attempts[side] = attempts;
      const counted: CountedResult = { score, scoringTimeMs: stored.elapsedMatchMs };
      round.counted[side] = counted;
      stored.status = "completed";
      stored.score = score;
      stored.scoreBp = scoreBp;
      stored.groups = groupResults;
      stored.testStatuses = statuses;
    } else {
      stored.status = "superseded";
      stored.score = null;
      stored.scoreBp = scoreBp;
      stored.groups = groupResults;
      stored.testStatuses = statuses;
    }
    const activityChanged = this.options.host.activityOf(round, side) === "evaluating";
    if (activityChanged) this.options.host.transitionActivity(match, round, side, "coding");
    await this.options.host.commitClaimedEvaluation(claim, match, stored);
    if (activityChanged) this.options.host.emit("player.statusChanged", { matchId: match.id, side, status: "coding" });
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
    const activityChanged = this.options.host.activityOf(round, side) === "evaluating";
    if (activityChanged) this.options.host.transitionActivity(match, round, side, "coding");
    await this.options.host.commitClaimedEvaluation(claim, match, stored);
    if (activityChanged) this.options.host.emit("player.statusChanged", { matchId: match.id, side, status: "coding" });
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
