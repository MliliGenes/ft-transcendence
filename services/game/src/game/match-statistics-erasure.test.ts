import { describe, expect, it } from 'vitest';
import type { MatchRecord } from 'arena-game-engine';
import {
  buildLeaderboard,
  summarizeCompletedMatch,
} from './match-statistics.js';

describe('anonymized match results', () => {
  const match = {
    id: 'match-1',
    mode: '1v1',
    roundPhase: 'MATCH_COMPLETE',
    currentRound: 1,
    totalRounds: 1,
    durationMs: 1000,
    startedAt: 100,
    participants: [
      { userId: 'anonymous-placeholder', sideId: 'left', anonymized: true },
      { userId: 'surviving-user', sideId: 'right' },
    ],
    rounds: [],
    failures: [],
    revision: 1,
    presence: {},
    offlineSinceMs: {},
    forfeit: { winner: 'right', loser: 'left', at: 200, reason: 'leave' },
  } as MatchRecord;

  it("keeps the opponent's result without exposing or ranking an anonymous identity", () => {
    expect(
      summarizeCompletedMatch(match, 'surviving-user')?.opponentUserIds,
    ).toEqual([]);
    expect(buildLeaderboard([match]).map((player) => player.userId)).toEqual([
      'surviving-user',
    ]);
  });
});
