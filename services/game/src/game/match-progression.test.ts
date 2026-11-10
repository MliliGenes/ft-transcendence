import { describe, expect, it } from "vitest";
import type { MatchRecord } from "arena-game-engine";
import { statisticsForUser } from "./match-statistics.js";

describe("game progression and achievements", () => {
  function makeMatch(id: string, mode: "1v1" | "2v2", scoreFor: number, scoreAgainst: number, outcome: "win" | "loss" | "draw", timestamp: number): MatchRecord {
    return {
      id,
      mode,
      roundPhase: "MATCH_COMPLETE",
      currentRound: 3,
      totalRounds: 3,
      durationMs: 60000,
      startedAt: timestamp,
      participants: [
        { userId: "player-1", sideId: "left" },
        { userId: "player-2", sideId: "right" },
      ],
      rounds: [
        {
          index: 0,
          problemId: "p1",
          startedAt: timestamp,
          durationMs: 20000,
          counted: { left: { score: scoreFor, testsPassed: 3, totalTests: 3 }, right: { score: scoreAgainst, testsPassed: 1, totalTests: 3 } },
          reveal: { publishedAt: timestamp + 20000, deadline: timestamp + 20000, scores: {} },
        },
      ],
      failures: [],
      revision: 1,
      presence: {},
      offlineSinceMs: {},
    } as unknown as MatchRecord;
  }

  it("calculates progression level, XP, and rank titles accurately", () => {
    // 0 matches
    const stats0 = statisticsForUser("player-1", []);
    expect(stats0.progression.level).toBe(1);
    expect(stats0.progression.xp).toBe(0);
    expect(stats0.progression.rankTitle).toBe("Novice");
    expect(stats0.progression.achievements.every((a) => !a.unlocked)).toBe(true);

    // 1 win: 50 base + 100 win = 150 XP -> Level 2
    const match1 = makeMatch("m1", "1v1", 100, 25, "win", 1000);
    const stats1 = statisticsForUser("player-1", [match1]);
    expect(stats1.progression.xp).toBe(150);
    expect(stats1.progression.level).toBe(2);
    expect(stats1.progression.rankTitle).toBe("Apprentice");
    expect(stats1.progression.xpToNextLevel).toBe(50);

    const firstBlood = stats1.progression.achievements.find((a) => a.id === "first_blood");
    const firstWin = stats1.progression.achievements.find((a) => a.id === "first_win");
    const century = stats1.progression.achievements.find((a) => a.id === "century_scorer");
    expect(firstBlood?.unlocked).toBe(true);
    expect(firstWin?.unlocked).toBe(true);
    expect(century?.unlocked).toBe(true);
  });

  it("unlocks 2v2 co-op achievement on completed team match", () => {
    const match2v2 = makeMatch("m2", "2v2", 50, 50, "draw", 2000);
    const stats = statisticsForUser("player-1", [match2v2]);
    const coop = stats.progression.achievements.find((a) => a.id === "coop_tactician");
    expect(coop?.unlocked).toBe(true);
  });
});
