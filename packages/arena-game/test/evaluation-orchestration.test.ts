import { describe, expect, it } from "vitest";
import { EvaluationInFlightRegistry, EvaluationOrchestrator } from "../src/evaluation-orchestration.js";

describe("evaluation orchestration in-flight ownership", () => {
  it("settles the current owner and leaves other evaluations discoverable by round", async () => {
    const registry = new EvaluationInFlightRegistry();
    const tracked = registry.track("evaluation-1", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "left",
      submissionId: "submission-1",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-1",
      documentRevision: null,
    });
    registry.track("evaluation-2", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "right",
      submissionId: "submission-2",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-2",
      documentRevision: null,
    });

    expect(registry.get("evaluation-1")).toBe(tracked);
    expect(registry.forRound("match-1", "round-1").map(({ evaluationId }) => evaluationId)).toEqual([
      "evaluation-1",
      "evaluation-2",
    ]);

    const completion = tracked.promise;
    registry.settle("evaluation-1", tracked, { ok: true });

    await expect(completion).resolves.toEqual({ ok: true });
    expect(registry.get("evaluation-1")).toBeUndefined();
    expect(registry.forRound("match-1", "round-1").map(({ evaluationId }) => evaluationId)).toEqual(["evaluation-2"]);
  });

  it("does not remove a newer owner when an old owner settles late", async () => {
    const registry = new EvaluationInFlightRegistry();
    const original = registry.track("evaluation-1", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "left",
      submissionId: "submission-1",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-1",
      documentRevision: null,
    });
    const replacement = registry.track("evaluation-1", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "left",
      submissionId: "submission-2",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-2",
      documentRevision: null,
    });

    registry.settle("evaluation-1", original, { ok: false, error: new Error("stale") });

    expect(registry.get("evaluation-1")).toBe(replacement);
    await expect(original.promise).resolves.toMatchObject({ ok: false });
    expect(registry.forRound("match-1", "round-1")).toHaveLength(1);

    registry.settle("evaluation-1", replacement, { ok: true });
    await expect(replacement.promise).resolves.toEqual({ ok: true });
  });
});


import type { PlayerStatus } from "arena-model";
import type { MatchRecord, SubmissionRecord } from "../src/index.js";
import { inMemoryPersistence, type MatchPersistence } from "../src/persistence.js";
import { RoundLifecycle } from "../src/round-lifecycle.js";
import { SPIKE_LIMITS, type GameJudge } from "../src/judge.js";

async function evaluationFixture(judge?: GameJudge) {
  const persistence = inMemoryPersistence();
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
      withMatchLock: async <T>(_: string, work: () => Promise<T>): Promise<T> => work(),
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
  return { persistence, match, record, problem, options };
}

it("commits a verdict using only supported construction and facade command context", async () => {
  const { persistence, match, record, problem, options } = await evaluationFixture();
  await persistence.recordSubmission(record);
  const workflow = new EvaluationOrchestrator(options);
  const tracked = workflow.track(record.evaluationId, {
    matchId: match.id, roundId: record.roundId, sideId: record.sideId,
    submissionId: record.submissionId, problemVersionId: record.problemVersionId,
    language: "Python", sourceHash: record.sourceHash, documentRevision: null,
  });
  await expect(workflow.run({
    ...record, roundNo: 1, hiddenSuiteId: "hidden-v1", language: "Python", driver: "snippet",
    groups: problem.hidden, documentRevision: null, tracked,
  })).resolves.toEqual({ ok: true, round: 1, submissionId: "submission-1", evaluationId: "evaluation-1" });
  await expect(persistence.findSubmissionByEvaluationId("evaluation-1")).resolves.toMatchObject({ status: "completed", score: 100 });
  await expect(persistence.loadMatch(match.id)).resolves.toMatchObject({
    revision: 1, rounds: [{ attempts: { left: 1 }, counted: { left: { score: 100, scoringTimeMs: 100 } } }],
  });
});
