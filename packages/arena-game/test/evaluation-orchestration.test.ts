import { describe, expect, it } from "vitest";
import { EvaluationOrchestrator, type EvaluationSubmission } from "../src/evaluation-orchestration.js";

import type { PlayerStatus } from "arena-model";
import type { MatchRecord, SubmissionRecord } from "../src/index.js";
import { inMemoryPersistence, DuplicateError, type MatchPersistence } from "../src/persistence.js";
import { RoundLifecycle } from "../src/round-lifecycle.js";
import { SPIKE_LIMITS, JudgeInfraError, type GameJudge } from "../src/judge.js";

async function evaluationFixture(judge?: GameJudge, decorate = (store: MatchPersistence) => store) {
  const persistence = decorate(inMemoryPersistence());
  let locked = false;
  let tail = Promise.resolve();
  let exitFailure: Error | undefined;
  const match: MatchRecord = {
    id: "evaluation-match", mode: "1v1", roundPhase: "CODING",
    currentRound: 1, totalRounds: 1, startedAt: 1000, durationMs: 60000,
    participants: [{ userId: "left-user", sideId: "left" }, { userId: "right-user", sideId: "right" }],
    rounds: [{
      roundId: "evaluation-round", problemVersionId: "problem-v1", hiddenSuiteId: "hidden-v1",
      counted: {}, attempts: {}, activities: { left: "evaluating", right: "coding" },
      runTests: {}, reveal: null, closing: false, cutoffPassed: false, superseded: [],
    }],
    failures: [], revision: 0, presence: {}, offlineSinceMs: {}, forfeit: null,
  };
  await persistence.saveMatch(match);
  const record: SubmissionRecord = {
    evaluationId: "evaluation-1", submissionId: "submission-1", matchId: match.id,
    roundId: "evaluation-round", sideId: "left", problemVersionId: "problem-v1",
    language: "Python", source: "solution", sourceHash: "source-hash", documentRevision: null,
    submittedAt: 1100, elapsedMatchMs: 100, status: "pending", score: null, scoreBp: null,
    groups: null, testStatuses: null, failureCode: null,
  };
  const problem = { driver: "snippet" as const, hidden: [{
    name: "Hidden", weight: 100, tests: [{ id: "case-1", input: "1", expected: "2" }],
  }] };
  const options = {
    persistence,
    judge: judge ?? {
      runVisible: async () => [],
      evaluateSealed: async () => ({ groups: [{ name: "Hidden", weight: 100,
        results: [{ id: "case-1", passed: true, status: "accepted" as const, runtimeMs: 1 }],
      }] }),
    },
    bank: { loadProblem: () => problem }, roundLifecycle: new RoundLifecycle(),
    clock: () => 1200, deadlineGraceMs: 0, limits: SPIKE_LIMITS,
    host: {
      withMatchLock: async <T>(_: string, work: () => Promise<T>): Promise<T> => {
        const previous = tail;
        let release!: () => void;
        tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        locked = true;
        try {
          const value = await work();
          if (exitFailure) {
            const error = exitFailure;
            exitFailure = undefined;
            throw error;
          }
          return value;
        } finally { locked = false; release(); }
      },
      revisionFor: () => 1,
      loadMatchOrThrow: async (id: string) => {
        const stored = await persistence.loadMatch(id);
        if (!stored) throw new Error("missing Match");
        return stored;
      },
      currentRound: (current: MatchRecord) => current.rounds[current.currentRound - 1]!,
      activityOf: (round: MatchRecord["rounds"][number], side: string) => round.activities[side] ?? "coding",
      transitionActivity: (current: MatchRecord, round: MatchRecord["rounds"][number], side: string, next: PlayerStatus) => {
        round.activities[side] = next;
      },
      emit: () => {},
    },
  };
  const request = (changes: Partial<EvaluationSubmission> = {}): EvaluationSubmission => ({
    matchId: match.id, roundNo: 1, roundId: record.roundId, sideId: record.sideId,
    submissionId: record.submissionId, evaluationId: record.evaluationId,
    problemVersionId: record.problemVersionId, hiddenSuiteId: "hidden-v1", language: "Python",
    sourceHash: record.sourceHash, documentRevision: null,
    acceptPending: async (existing) => existing ?? persistence.recordSubmission(record),
    ...changes,
  });
  return { persistence, match, record, options, request,
    locked: () => locked, failNextLockExit: (error: Error) => { exitFailure = error; } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function controlledJudge() {
  const started = deferred<void>();
  const result = deferred<{ groups: Array<{ name: string; weight: number; results: Array<{
    id: string; passed: boolean; status: "accepted"; runtimeMs: number;
  }> }> }>();
  let calls = 0;
  const judge: GameJudge = {
    runVisible: async () => [],
    evaluateSealed: async () => { calls++; started.resolve(); return result.promise; },
  };
  const finish = () => result.resolve({ groups: [{ name: "Hidden", weight: 100,
    results: [{ id: "case-1", passed: true, status: "accepted", runtimeMs: 1 }],
  }] });
  return { judge, started: started.promise, calls: () => calls, finish, fail: result.reject };
}

const receipt = { ok: true, round: 1, submissionId: "submission-1", evaluationId: "evaluation-1" };

// Each assertion exercises the supported workflow, never its registry entries.
describe("Evaluation retry workflow", () => {
  it("owns submission completion through its supported interface", async () => {
    const f = await evaluationFixture();
    const workflow = new EvaluationOrchestrator(f.options);
    await expect(Promise.resolve().then(() => workflow.submit(f.match.id, async () => f.request()))).resolves.toEqual(receipt);
    await expect(f.persistence.findSubmissionByEvaluationId("evaluation-1")).resolves.toMatchObject({ status: "completed", score: 100 });
    await expect(f.persistence.loadMatch(f.match.id)).resolves.toMatchObject({
      revision: 1, rounds: [{ attempts: { left: 1 }, counted: { left: { score: 100, scoringTimeMs: 100 } } }],
    });
  });

  it("rejects an accepted record under a different evaluation ID and releases ownership", async () => {
    const f = await evaluationFixture();
    let judgeCalls = 0;
    const judge = f.options.judge;
    f.options.judge = { ...judge, evaluateSealed: async (input) => {
      judgeCalls++;
      return judge.evaluateSealed(input);
    } };
    const workflow = new EvaluationOrchestrator(f.options);
    await expect(workflow.submit(f.match.id, async () => f.request({
      acceptPending: async () => f.persistence.recordSubmission({ ...f.record, evaluationId: "other-evaluation" }),
    }))).rejects.toBeInstanceOf(DuplicateError);
    expect(judgeCalls).toBe(0);
    expect(workflow.forRound(f.match.id, "evaluation-round")).toEqual([]);
    await expect(f.persistence.findSubmissionByEvaluationId("other-evaluation")).resolves.toMatchObject({ status: "pending" });
  });

  it("attaches identical requests without holding the Match lock while waiting", async () => {
    const control = controlledJudge();
    const f = await evaluationFixture(control.judge);
    const workflow = new EvaluationOrchestrator(f.options);
    const first = workflow.submit(f.match.id, async () => f.request());
    await control.started;
    expect(f.locked()).toBe(false);
    const retry = workflow.submit(f.match.id, async () => f.request());
    await expect(f.options.host.withMatchLock(f.match.id, async () => "other side progresses")).resolves.toBe("other side progresses");
    control.finish();
    await expect(Promise.all([first, retry])).resolves.toEqual([receipt, receipt]);
    expect(control.calls()).toBe(1);
    await expect(f.persistence.listRoundSubmissions(f.match.id, "evaluation-round")).resolves.toHaveLength(1);
  });

  const changedIdentities: Array<[string, Partial<EvaluationSubmission>]> = [
    ["Match", { matchId: "other-match" }], ["Round", { roundId: "other-round" }],
    ["side", { sideId: "right" }], ["Submission", { submissionId: "other-submission" }],
    ["Problem", { problemVersionId: "other-problem" }], ["language", { language: "C" }],
    ["source", { sourceHash: "other-hash" }], ["document revision", { documentRevision: 2 }],
  ];

  it.each(changedIdentities)("rejects a changed %s on an in-flight identity without disturbing its owner", async (_, change) => {
    const control = controlledJudge();
    const f = await evaluationFixture(control.judge);
    const workflow = new EvaluationOrchestrator(f.options);
    const first = workflow.submit(f.match.id, async () => f.request());
    await control.started;
    await expect(workflow.submit(f.match.id, async () => f.request(change))).rejects.toBeInstanceOf(DuplicateError);
    control.finish();
    await expect(first).resolves.toEqual(receipt);
    expect(control.calls()).toBe(1);
  });

  it.each(changedIdentities)("rejects a changed %s on a durable identity", async (_, change) => {
    const f = await evaluationFixture();
    await f.persistence.recordSubmission({ ...f.record, status: "completed" });
    const workflow = new EvaluationOrchestrator(f.options);
    await expect(workflow.submit(f.match.id, async () => f.request(change))).rejects.toBeInstanceOf(DuplicateError);
    await expect(f.persistence.findSubmissionByEvaluationId("evaluation-1")).resolves.toMatchObject({ status: "completed", sourceHash: "source-hash" });
  });

  it("returns the original durable receipt after process restart without accepting or judging again", async () => {
    const f = await evaluationFixture({ runVisible: async () => [], evaluateSealed: async () => { throw new Error("must not rejudge"); } });
    await f.persistence.recordSubmission({ ...f.record, status: "completed" });
    const workflow = new EvaluationOrchestrator(f.options);
    await expect(workflow.submit(f.match.id, async () => f.request({
      acceptPending: async () => { throw new Error("must not accept again"); },
    }))).resolves.toEqual(receipt);
  });

  it("replays the original judge error to attached callers and later retries", async () => {
    const control = controlledJudge();
    const f = await evaluationFixture(control.judge);
    const workflow = new EvaluationOrchestrator(f.options);
    const first = workflow.submit(f.match.id, async () => f.request());
    first.catch(() => {});
    await control.started;
    const retry = workflow.submit(f.match.id, async () => f.request());
    retry.catch(() => {});
    await f.options.host.withMatchLock(f.match.id, async () => {});
    const failure = new JudgeInfraError("judge unavailable");
    control.fail(failure);
    await expect(first).rejects.toBe(failure);
    await expect(retry).rejects.toBe(failure);
    await expect(workflow.submit(f.match.id, async () => f.request())).rejects.toBe(failure);
    expect(control.calls()).toBe(1);
    await expect(f.persistence.findSubmissionByEvaluationId("evaluation-1")).resolves.toMatchObject({ status: "failed" });
  });

  it("settles an attached caller when pending acceptance fails before persistence", async () => {
    const f = await evaluationFixture();
    const accepted = deferred<void>();
    const entered = deferred<void>();
    const retryPrepared = deferred<void>();
    let command = 0;
    // Independent command contexts let this test cover attachment while a write is pending.
    f.options.host.withMatchLock = async <T>(_: string, work: () => Promise<T>): Promise<T> => {
      const number = ++command;
      const value = await work();
      if (number === 2) retryPrepared.resolve();
      return value;
    };
    const workflow = new EvaluationOrchestrator(f.options);
    const failure = new Error("pending write failed");
    const first = workflow.submit(f.match.id, async () => f.request({ acceptPending: async () => {
      entered.resolve(); await accepted.promise; throw failure;
    } }));
    first.catch(() => {});
    await entered.promise;
    const retry = workflow.submit(f.match.id, async () => f.request());
    retry.catch(() => {});
    await retryPrepared.promise;
    accepted.resolve();
    await expect(first).rejects.toBe(failure);
    await expect(retry).rejects.toBe(failure);
    expect(workflow.forRound(f.match.id, "evaluation-round")).toHaveLength(0);
    await expect(f.persistence.listPendingSubmissions()).resolves.toEqual([]);
    await expect(workflow.submit(f.match.id, async () => f.request())).resolves.toEqual(receipt);
  });

  it("releases local ownership when the command fails after pending acceptance", async () => {
    const f = await evaluationFixture();
    const workflow = new EvaluationOrchestrator(f.options);
    const failure = new Error("final Match write failed");
    f.failNextLockExit(failure);
    await expect(workflow.submit(f.match.id, async () => f.request())).rejects.toBe(failure);
    expect(workflow.forRound(f.match.id, "evaluation-round")).toHaveLength(0);
    await expect(f.persistence.findSubmissionByEvaluationId("evaluation-1")).resolves.toMatchObject({ status: "pending" });
    await expect(workflow.submit(f.match.id, async () => f.request())).resolves.toEqual(receipt);
  });

  it("resumes an existing pending Submission without inserting a new attempt", async () => {
    const f = await evaluationFixture();
    await f.persistence.recordSubmission(f.record);
    const workflow = new EvaluationOrchestrator(f.options);
    await expect(workflow.submit(f.match.id, async () => f.request())).resolves.toEqual(receipt);
    await expect(f.persistence.listRoundSubmissions(f.match.id, "evaluation-round")).resolves.toHaveLength(1);
    await expect(f.persistence.loadMatch(f.match.id)).resolves.toMatchObject({ rounds: [{ attempts: { left: 1 } }] });
  });

  it("settles attached callers when the claim-owned verdict commit fails", async () => {
    const failure = new Error("verdict commit failed");
    const control = controlledJudge();
    const f = await evaluationFixture(control.judge, (store) => {
      store.commitClaimedEvaluation = async () => { throw failure; };
      return store;
    });
    const workflow = new EvaluationOrchestrator(f.options);
    const first = workflow.submit(f.match.id, async () => f.request());
    first.catch(() => {});
    await control.started;
    const retry = workflow.submit(f.match.id, async () => f.request());
    retry.catch(() => {});
    await f.options.host.withMatchLock(f.match.id, async () => {});
    control.finish();
    await expect(first).rejects.toBe(failure);
    await expect(retry).rejects.toBe(failure);
    expect(workflow.forRound(f.match.id, "evaluation-round")).toHaveLength(0);
    await expect(f.persistence.loadMatch(f.match.id)).resolves.toMatchObject({ rounds: [{ attempts: {} }] });
  });
});
