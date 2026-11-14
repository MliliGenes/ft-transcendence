import { describe, expect, it } from "vitest";
import type { MatchRecord } from "arena-game-engine";
import {
  buildLeaderboard,
  statisticsForUser,
  summarizeCompletedMatch,
} from "./match-statistics.js";

function makeMatch(options: {
  id: string;
  mode: "1v1" | "2v2";
  roundPhase?: MatchRecord["roundPhase"];
  leftScore: number;
  rightScore: number;
  leftTimeMs?: number;
  rightTimeMs?: number;
  leftAttempts?: number;
  rightAttempts?: number;
  participants: Array<{ userId: string; sideId: string; anonymized?: true }>;
  forfeit?: MatchRecord["forfeit"];
  omitActivities?: boolean;
}): MatchRecord {
  const timestamp = 1_000_000;
  return {
    id: options.id,
    mode: options.mode,
    roundPhase: options.roundPhase ?? "MATCH_COMPLETE",
    currentRound: 1,
    totalRounds: 1,
    durationMs: 60_000,
    startedAt: timestamp,
    participants: options.participants,
    rounds: [
      {
        index: 0,
        problemId: "p1",
        startedAt: timestamp,
        durationMs: 20_000,
        counted: {
          left: {
            score: options.leftScore,
            testsPassed: options.leftScore > 0 ? 3 : 0,
            totalTests: 3,
            scoringTimeMs: options.leftTimeMs ?? 1000,
          },
          right: {
            score: options.rightScore,
            testsPassed: options.rightScore > 0 ? 3 : 0,
            totalTests: 3,
            scoringTimeMs: options.rightTimeMs ?? 1000,
          },
        },
        attempts: {
          left: options.leftAttempts ?? 1,
          right: options.rightAttempts ?? 1,
        },
        activities: options.omitActivities
          ? ({} as any)
          : { left: "coding", right: "coding" },
        reveal: {
          publishedAt: timestamp + 20_000,
          deadline: timestamp + 20_000,
          scores: { left: options.leftScore, right: options.rightScore },
        },
      },
    ],
    failures: [],
    revision: 1,
    presence: {},
    offlineSinceMs: {},
    forfeit: options.forfeit ?? null,
  } as unknown as MatchRecord;
}

describe("authoritative match outcome tiebreaks and history consistency", () => {
  it("1v1 tiebreak 1: equal scores decided by lower scoring time agree across viewpoints and stats", () => {
    const match = makeMatch({
      id: "match-1v1-time",
      mode: "1v1",
      leftScore: 100,
      rightScore: 100,
      leftTimeMs: 1000,
      rightTimeMs: 2000,
      leftAttempts: 1,
      rightAttempts: 1,
      participants: [
        { userId: "player-alpha", sideId: "left" },
        { userId: "player-beta", sideId: "right" },
      ],
    });

    const summaryAlpha = summarizeCompletedMatch(match, "player-alpha");
    const summaryBeta = summarizeCompletedMatch(match, "player-beta");

    expect(summaryAlpha?.outcome).toBe("win");
    expect(summaryBeta?.outcome).toBe("loss");

    const statsAlpha = statisticsForUser("player-alpha", [match]);
    expect(statsAlpha.wins).toBe(1);
    expect(statsAlpha.draws).toBe(0);
    expect(statsAlpha.losses).toBe(0);
    expect(statsAlpha.progression.xp).toBe(150);
    expect(statsAlpha.progression.level).toBe(2);
    expect(statsAlpha.progression.achievements.find((a) => a.id === "first_win")?.unlocked).toBe(true);

    const statsBeta = statisticsForUser("player-beta", [match]);
    expect(statsBeta.wins).toBe(0);
    expect(statsBeta.losses).toBe(1);
    expect(statsBeta.draws).toBe(0);
    expect(statsBeta.progression.xp).toBe(50);
    expect(statsBeta.progression.achievements.find((a) => a.id === "first_win")?.unlocked).toBe(false);

    const leaderboard = buildLeaderboard([match]);
    expect(leaderboard[0]?.userId).toBe("player-alpha");
    expect(leaderboard[1]?.userId).toBe("player-beta");
  });

  it("1v1 tiebreak 2: equal scores and times decided by fewer submissions", () => {
    const match = makeMatch({
      id: "match-1v1-attempts",
      mode: "1v1",
      leftScore: 100,
      rightScore: 100,
      leftTimeMs: 1500,
      rightTimeMs: 1500,
      leftAttempts: 2,
      rightAttempts: 1,
      participants: [
        { userId: "player-alpha", sideId: "left" },
        { userId: "player-beta", sideId: "right" },
      ],
    });

    const summaryAlpha = summarizeCompletedMatch(match, "player-alpha");
    const summaryBeta = summarizeCompletedMatch(match, "player-beta");

    expect(summaryAlpha?.outcome).toBe("loss");
    expect(summaryBeta?.outcome).toBe("win");

    const statsBeta = statisticsForUser("player-beta", [match]);
    expect(statsBeta.wins).toBe(1);
    expect(statsBeta.progression.xp).toBe(150);
  });

  it("2v2 tiebreak: all teammates agree on win or loss outcome", () => {
    const match = makeMatch({
      id: "match-2v2-tiebreak",
      mode: "2v2",
      leftScore: 100,
      rightScore: 100,
      leftTimeMs: 1000,
      rightTimeMs: 2000,
      leftAttempts: 1,
      rightAttempts: 1,
      participants: [
        { userId: "team-a1", sideId: "left" },
        { userId: "team-a2", sideId: "left" },
        { userId: "team-b1", sideId: "right" },
        { userId: "team-b2", sideId: "right" },
      ],
    });

    expect(summarizeCompletedMatch(match, "team-a1")?.outcome).toBe("win");
    expect(summarizeCompletedMatch(match, "team-a2")?.outcome).toBe("win");
    expect(summarizeCompletedMatch(match, "team-b1")?.outcome).toBe("loss");
    expect(summarizeCompletedMatch(match, "team-b2")?.outcome).toBe("loss");

    const statsA1 = statisticsForUser("team-a1", [match]);
    expect(statsA1.wins).toBe(1);
    expect(statsA1.progression.achievements.find((a) => a.id === "coop_tactician")?.unlocked).toBe(true);
    expect(statsA1.progression.achievements.find((a) => a.id === "first_win")?.unlocked).toBe(true);

    const statsB1 = statisticsForUser("team-b1", [match]);
    expect(statsB1.wins).toBe(0);
    expect(statsB1.losses).toBe(1);
    expect(statsB1.progression.achievements.find((a) => a.id === "coop_tactician")?.unlocked).toBe(true);
    expect(statsB1.progression.achievements.find((a) => a.id === "first_win")?.unlocked).toBe(false);
  });

  it("preserves genuine exact draw when all tiebreakers match", () => {
    const match = makeMatch({
      id: "match-exact-draw",
      mode: "1v1",
      leftScore: 100,
      rightScore: 100,
      leftTimeMs: 1000,
      rightTimeMs: 1000,
      leftAttempts: 1,
      rightAttempts: 1,
      participants: [
        { userId: "player-alpha", sideId: "left" },
        { userId: "player-beta", sideId: "right" },
      ],
    });

    expect(summarizeCompletedMatch(match, "player-alpha")?.outcome).toBe("draw");
    expect(summarizeCompletedMatch(match, "player-beta")?.outcome).toBe("draw");

    const statsAlpha = statisticsForUser("player-alpha", [match]);
    expect(statsAlpha.wins).toBe(0);
    expect(statsAlpha.draws).toBe(1);
    expect(statsAlpha.losses).toBe(0);
    expect(statsAlpha.progression.xp).toBe(75);
  });

  it("preserves forfeit outcome even if forfeiting side has higher score", () => {
    const match = makeMatch({
      id: "match-forfeit-lead",
      mode: "1v1",
      leftScore: 100,
      rightScore: 25,
      participants: [
        { userId: "player-alpha", sideId: "left" },
        { userId: "player-beta", sideId: "right" },
      ],
      forfeit: { winner: "right", loser: "left", at: 1_020_000, reason: "leave" },
    });

    const summaryAlpha = summarizeCompletedMatch(match, "player-alpha");
    const summaryBeta = summarizeCompletedMatch(match, "player-beta");

    expect(summaryAlpha?.outcome).toBe("loss");
    expect(summaryAlpha?.score).toEqual({ for: 100, against: 25 });

    expect(summaryBeta?.outcome).toBe("win");
    expect(summaryBeta?.score).toEqual({ for: 25, against: 100 });
  });

  it("excludes noncompleted and nonparticipant matches from summary", () => {
    const inProgressMatch = makeMatch({
      id: "match-in-progress",
      mode: "1v1",
      roundPhase: "CODING",
      leftScore: 50,
      rightScore: 0,
      participants: [
        { userId: "player-alpha", sideId: "left" },
        { userId: "player-beta", sideId: "right" },
      ],
    });

    expect(summarizeCompletedMatch(inProgressMatch, "player-alpha")).toBeNull();

    const completedMatch = makeMatch({
      id: "match-complete",
      mode: "1v1",
      leftScore: 50,
      rightScore: 0,
      participants: [
        { userId: "player-alpha", sideId: "left" },
        { userId: "player-beta", sideId: "right" },
      ],
    });

    expect(summarizeCompletedMatch(completedMatch, "spectator-user")).toBeNull();
  });

  it("correctly summarizes synthetic/partial fixtures where round activities are omitted via participant fallback", () => {
    const fixtureMatch = makeMatch({
      id: "match-fixture-no-activities",
      mode: "1v1",
      leftScore: 100,
      rightScore: 100,
      leftTimeMs: 800,
      rightTimeMs: 1200,
      leftAttempts: 1,
      rightAttempts: 1,
      participants: [
        { userId: "player-alpha", sideId: "left" },
        { userId: "player-beta", sideId: "right" },
      ],
      omitActivities: true,
    });

    expect(summarizeCompletedMatch(fixtureMatch, "player-alpha")?.outcome).toBe("win");
    expect(summarizeCompletedMatch(fixtureMatch, "player-beta")?.outcome).toBe("loss");
  });

  it("supports arbitrary non-left/right side IDs for summary and forfeit outcomes", () => {
    const arbitrarySideMatch: MatchRecord = {
      id: "match-arbitrary-sides",
      mode: "1v1",
      roundPhase: "MATCH_COMPLETE",
      currentRound: 1,
      totalRounds: 1,
      durationMs: 60000,
      startedAt: 1000000,
      participants: [
        { userId: "user-red", sideId: "team-red" },
        { userId: "user-blue", sideId: "team-blue" },
      ],
      rounds: [
        {
          index: 0,
          problemId: "p1",
          startedAt: 1000000,
          durationMs: 20000,
          counted: {
            "team-red": { score: 100, scoringTimeMs: 900 },
            "team-blue": { score: 100, scoringTimeMs: 1500 },
          },
          attempts: { "team-red": 1, "team-blue": 1 },
          activities: { "team-red": "coding", "team-blue": "coding" },
          reveal: {
            publishedAt: 1020000,
            deadline: 1020000,
            scores: { "team-red": 100, "team-blue": 100 },
          },
        },
      ],
      failures: [],
      revision: 1,
      presence: {},
      offlineSinceMs: {},
      forfeit: null,
    } as unknown as MatchRecord;

    const summaryRed = summarizeCompletedMatch(arbitrarySideMatch, "user-red");
    const summaryBlue = summarizeCompletedMatch(arbitrarySideMatch, "user-blue");
    expect(summaryRed?.outcome).toBe("win");
    expect(summaryBlue?.outcome).toBe("loss");

    // Forfeit override with arbitrary side IDs
    const forfeitMatch: MatchRecord = {
      ...arbitrarySideMatch,
      forfeit: { winner: "team-blue", loser: "team-red", at: 1010000, reason: "leave" },
    };
    expect(summarizeCompletedMatch(forfeitMatch, "user-red")?.outcome).toBe("loss");
    expect(summarizeCompletedMatch(forfeitMatch, "user-blue")?.outcome).toBe("win");
  });

  it("fails explicitly when match record has unresolvable sides", () => {
    const invalidMatch: MatchRecord = {
      id: "match-invalid",
      mode: "1v1",
      roundPhase: "MATCH_COMPLETE",
      currentRound: 1,
      totalRounds: 1,
      durationMs: 60000,
      startedAt: 1000000,
      participants: [],
      rounds: [
        {
          index: 0,
          problemId: "p1",
          startedAt: 1000000,
          durationMs: 20000,
          counted: {},
          attempts: {},
          activities: {},
          reveal: null,
        },
      ],
      failures: [],
      revision: 1,
      presence: {},
      offlineSinceMs: {},
      forfeit: null,
    } as unknown as MatchRecord;

    expect(() => summarizeCompletedMatch({ ...invalidMatch, participants: [{ userId: "u1", sideId: "solo" }] }, "u1"))
      .toThrow(/Cannot determine match sides/);
  });
});
