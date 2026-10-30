import { describe, expect, it } from "vitest";
import { RoundLifecycle, type SealedVerdict } from "../src/round-lifecycle.js";
import type { MatchRecord } from "../src/index.js";

function round(roundId: string, activity: "coding" | "locked" = "coding") {
  return {
    roundId,
    problemVersionId: "even-ledger",
    hiddenSuiteId: "hidden-even-ledger",
    counted: {},
    attempts: {},
    activities: { left: activity, right: activity },
    runTests: {},
    reveal: null,
    closing: false,
    cutoffPassed: false,
    superseded: [],
  };
}

function match(): MatchRecord {
  return {
    id: "match-1",
    mode: "1v1",
    roundPhase: "SCORE_REVEAL",
    currentRound: 1,
    totalRounds: 2,
    durationMs: 1_800_000,
    startedAt: 1_000,
    participants: [
      { userId: "left-user", sideId: "left" },
      { userId: "right-user", sideId: "right" },
    ],
    rounds: [round("round-1", "locked"), round("round-2")],
    failures: [],
    revision: 0,
    presence: {},
    offlineSinceMs: {},
    forfeit: null,
  };
}

describe("RoundLifecycle", () => {
  it("prepares Reveal scores and cumulative totals from Match state with supplied groups", () => {
    const lifecycle = new RoundLifecycle();
    const current = match();
    current.currentRound = 2;
    current.rounds[0].counted = {
      left: { score: 70, scoringTimeMs: 100 },
      right: { score: 40, scoringTimeMs: 200 },
    };
    current.rounds[1].counted = { left: { score: 30, scoringTimeMs: 300 } };
    const groups = [{ name: "Basic", weight: 100, earned: 30, earnedBp: 3000 }];
    const input = { groups: { left: groups, right: [] }, publishedAt: 1234 };

    const reveal = lifecycle.createReveal(current, input);

    expect(reveal).toEqual({
      round: 2,
      roundId: "round-2",
      scores: { left: 30, right: 0 },
      groups: { left: groups, right: [] },
      totals: { left: 100, right: 40 },
      publishedAt: 1234,
    });
    current.rounds[1].counted.left!.score = 90;
    input.groups.left = [];
    expect(reveal.scores).toEqual({ left: 30, right: 0 });
    expect(reveal.totals).toEqual({ left: 100, right: 40 });
    expect(reveal.groups.left).toEqual(groups);
  });

  it("scores competitive verdicts and rejects infrastructure verdicts", () => {
    const lifecycle = new RoundLifecycle();
    const verdict: SealedVerdict = {
      groups: [
        {
          name: "Basic",
          weight: 100,
          results: [
            { id: "a", passed: true, status: "accepted", runtimeMs: 1 },
            { id: "b", passed: false, status: "runtime_error", runtimeMs: 2 },
          ],
        },
      ],
    };

    expect(lifecycle.scoreVerdict(verdict)).toMatchObject({
      score: 50,
      scoreBp: 5000,
      testStatuses: ["accepted", "runtime_error"],
      groups: [{ name: "Basic", earned: 50, earnedBp: 5000 }],
    });
    expect(
      lifecycle.scoreVerdict({
        groups: [{ name: "Basic", weight: 100, results: [{ id: "a", passed: false, status: "internal_error", runtimeMs: 0 }] }],
      }),
    ).toBeUndefined();
  });

  it("advances the next round while keeping the facade-independent reset rules", () => {
    const lifecycle = new RoundLifecycle();
    const current = match();
    const plan = lifecycle.advance(current);

    expect(plan).toEqual({ completed: false, previousRoundId: "round-1", activityResets: [] });
    expect(current.roundPhase).toBe("ROUND_INTRO");
    expect(current.currentRound).toBe(2);
    expect(current.rounds[1]).toMatchObject({
      counted: {},
      attempts: {},
      reveal: null,
      closing: false,
      cutoffPassed: false,
      superseded: [],
    });
  });

  it("computes competitive final results with winner and scores", () => {
    const lifecycle = new RoundLifecycle();
    const current = match();
    current.rounds[0].counted = {
      left: { score: 100, scoringTimeMs: 100 },
      right: { score: 80, scoringTimeMs: 200 },
    };
    current.rounds[1].counted = {
      left: { score: 50, scoringTimeMs: 150 },
      right: { score: 50, scoringTimeMs: 120 },
    };
    const final = lifecycle.computeFinal(current);

    expect(final).toEqual({
      scores: { left: 150, right: 130 },
      outcome: "left",
      winner: "left",
      forfeit: null,
    });
  });

  it("computes forfeit final results attributing win to the forfeit winner", () => {
    const lifecycle = new RoundLifecycle();
    const current = match();
    current.rounds[0].counted = {
      left: { score: 60, scoringTimeMs: 100 },
      right: { score: 40, scoringTimeMs: 200 },
    };
    current.forfeit = {
      winner: "right",
      loser: "left",
      at: 1000,
      reason: "grace-expired",
    };
    const final = lifecycle.computeFinal(current);

    expect(final).toEqual({
      scores: { left: 60, right: 40 },
      outcome: "right",
      winner: "right",
      forfeit: {
        winner: "right",
        loser: "left",
        at: 1000,
        reason: "grace-expired",
      },
    });
  });
});
