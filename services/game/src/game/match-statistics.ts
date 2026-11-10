import type { MatchRecord } from "arena-game-engine";

export type MatchOutcome = "win" | "loss" | "draw";

export interface CompletedMatchSummary {
  matchId: string;
  mode: MatchRecord["mode"];
  outcome: MatchOutcome;
  opponentUserIds: string[];
  score: { for: number; against: number };
  playedAt: string;
}

export interface PlayerStatistics {
  userId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  progression: PlayerProgression;
}

export interface CodeArenaAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface PlayerProgression {
  level: number;
  xp: number;
  xpToNextLevel: number;
  rankTitle: string;
  achievements: CodeArenaAchievement[];
}

export interface LeaderboardEntry extends PlayerStatistics {
  rank: number;
}

function totalForSide(match: MatchRecord, sideId: string): number {
  return match.rounds.reduce((total, round) => total + (round.counted[sideId]?.score ?? 0), 0);
}

function completedAt(match: MatchRecord): number {
  if (match.forfeit) return match.forfeit.at;
  return match.rounds.reduce((latest, round) => Math.max(latest, round.reveal?.publishedAt ?? 0), match.startedAt);
}

export function summarizeCompletedMatch(match: MatchRecord, userId: string): CompletedMatchSummary | null {
  if (match.roundPhase !== "MATCH_COMPLETE") return null;
  const participant = match.participants.find((entry) => entry.userId === userId);
  if (!participant) return null;

  const opponentSide = match.participants.find((entry) => entry.sideId !== participant.sideId)?.sideId;
  const scoreFor = totalForSide(match, participant.sideId);
  const scoreAgainst = opponentSide ? totalForSide(match, opponentSide) : 0;
  const outcome: MatchOutcome = match.forfeit
    ? (match.forfeit.winner === participant.sideId ? "win" : "loss")
    : scoreFor > scoreAgainst ? "win" : scoreFor < scoreAgainst ? "loss" : "draw";

  return {
    matchId: match.id,
    mode: match.mode,
    outcome,
    opponentUserIds: [...new Set(match.participants
      .filter((entry) => entry.sideId !== participant.sideId && !entry.anonymized)
      .map((entry) => entry.userId))],
    score: { for: scoreFor, against: scoreAgainst },
    playedAt: new Date(completedAt(match)).toISOString(),
  };
}

export function calculateProgression(results: CompletedMatchSummary[]): PlayerProgression {
  const sorted = [...results].sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt));

  let xp = 0;
  for (const match of sorted) {
    xp += 50;
    if (match.outcome === "win") xp += 100;
    else if (match.outcome === "draw") xp += 25;
  }

  const level = Math.floor(xp / 100) + 1;
  const xpToNextLevel = (level * 100) - xp;

  const rankTitles = [
    "Novice",
    "Apprentice",
    "Coder",
    "Algorithmist",
    "Grandmaster",
  ];
  const rankTitle = rankTitles[Math.min(level - 1, rankTitles.length - 1)];

  const firstMatch = sorted[0];
  const firstWin = sorted.find((m) => m.outcome === "win");
  const fifthMatch = sorted[4];
  const thirdWin = sorted.filter((m) => m.outcome === "win")[2];
  const first2v2 = sorted.find((m) => m.mode === "2v2");
  const centuryMatch = sorted.find((m) => m.score.for >= 100);

  const achievements: CodeArenaAchievement[] = [
    {
      id: "first_blood",
      title: "First Duel",
      description: "Complete your first Code Arena match.",
      icon: "⚔️",
      unlocked: Boolean(firstMatch),
      unlockedAt: firstMatch?.playedAt ?? null,
    },
    {
      id: "first_win",
      title: "Victory Call",
      description: "Win a Code Arena match.",
      icon: "🏆",
      unlocked: Boolean(firstWin),
      unlockedAt: firstWin?.playedAt ?? null,
    },
    {
      id: "veteran",
      title: "Arena Veteran",
      description: "Complete at least 5 arena matches.",
      icon: "🎖️",
      unlocked: Boolean(fifthMatch),
      unlockedAt: fifthMatch?.playedAt ?? null,
    },
    {
      id: "champion",
      title: "Arena Champion",
      description: "Win at least 3 arena matches.",
      icon: "👑",
      unlocked: Boolean(thirdWin),
      unlockedAt: thirdWin?.playedAt ?? null,
    },
    {
      id: "coop_tactician",
      title: "Duo Tactician",
      description: "Complete a 2v2 collaborative team match.",
      icon: "🤝",
      unlocked: Boolean(first2v2),
      unlockedAt: first2v2?.playedAt ?? null,
    },
    {
      id: "century_scorer",
      title: "Century Scorer",
      description: "Score 100 points or more in a match.",
      icon: "💯",
      unlocked: Boolean(centuryMatch),
      unlockedAt: centuryMatch?.playedAt ?? null,
    },
  ];

  return {
    level,
    xp,
    xpToNextLevel,
    rankTitle,
    achievements,
  };
}

export function statisticsForUser(userId: string, matches: MatchRecord[]): PlayerStatistics {
  const results = matches
    .map((match) => summarizeCompletedMatch(match, userId))
    .filter((summary): summary is CompletedMatchSummary => summary !== null);
  const wins = results.filter((summary) => summary.outcome === "win").length;
  const losses = results.filter((summary) => summary.outcome === "loss").length;
  const draws = results.length - wins - losses;
  return {
    userId,
    matchesPlayed: results.length,
    wins,
    losses,
    draws,
    winRate: results.length === 0 ? 0 : wins / results.length,
    progression: calculateProgression(results),
  };
}

export function buildLeaderboard(matches: MatchRecord[]): LeaderboardEntry[] {
  const users = new Set(matches.flatMap((match) => match.participants
    .filter((participant) => !participant.anonymized)
    .map((participant) => participant.userId)));
  const players = [...users].map((userId) => statisticsForUser(userId, matches));
  players.sort((left, right) =>
    right.wins - left.wins ||
    right.winRate - left.winRate ||
    right.matchesPlayed - left.matchesPlayed ||
    left.userId.localeCompare(right.userId),
  );
  return players.map((player, index) => ({ ...player, rank: index + 1 }));
}
