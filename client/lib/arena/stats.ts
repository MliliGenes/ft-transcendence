export type CodeArenaOutcome = "win" | "loss" | "draw";

export type CodeArenaMatchSummary = {
  matchId: string;
  mode: "1v1" | "2v2";
  outcome: CodeArenaOutcome;
  opponentUserIds: string[];
  score: { for: number; against: number };
  playedAt: string;
};

export type CodeArenaAchievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type CodeArenaProgression = {
  level: number;
  xp: number;
  xpToNextLevel: number;
  rankTitle: string;
  achievements: CodeArenaAchievement[];
};

export type CodeArenaPlayerStats = {
  userId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  progression?: CodeArenaProgression;
};

export type CodeArenaLeaderboardEntry = CodeArenaPlayerStats & { rank: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function parseMatch(value: unknown): CodeArenaMatchSummary {
  if (!isRecord(value) || typeof value.matchId !== "string" || (value.mode !== "1v1" && value.mode !== "2v2")
    || (value.outcome !== "win" && value.outcome !== "loss" && value.outcome !== "draw")
    || !Array.isArray(value.opponentUserIds) || !value.opponentUserIds.every((id) => typeof id === "string")
    || !isRecord(value.score) || !isCount(value.score.for) || !isCount(value.score.against)
    || typeof value.playedAt !== "string" || !Number.isFinite(Date.parse(value.playedAt))) {
    throw new Error("Game service returned invalid match history.");
  }
  return value as unknown as CodeArenaMatchSummary;
}

function parseStats(value: unknown): CodeArenaPlayerStats {
  if (!isRecord(value) || typeof value.userId !== "string" || !isCount(value.matchesPlayed)
    || !isCount(value.wins) || !isCount(value.losses) || !isCount(value.draws)
    || typeof value.winRate !== "number" || !Number.isFinite(value.winRate) || value.winRate < 0 || value.winRate > 1
    || value.wins + value.losses + value.draws !== value.matchesPlayed) {
    throw new Error("Game service returned invalid player statistics.");
  }
  return value as unknown as CodeArenaPlayerStats;
}

function parseLeaderboardEntry(value: unknown): CodeArenaLeaderboardEntry {
  const stats = parseStats(value);
  if (!isRecord(value) || !isCount(value.rank) || value.rank < 1) {
    throw new Error("Game service returned an invalid leaderboard.");
  }
  return { ...stats, rank: value.rank };
}

async function request<T>(path: string, accessToken: string, parse: (value: unknown) => T): Promise<T> {
  if (!accessToken) throw new Error("Sign in to view Code Arena records.");
  let response: Response;
  try {
    response = await fetch(`/api/game${path}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error("Unable to reach Code Arena. Check your connection and try again.");
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("Code Arena returned an invalid response.");
  }
  if (!response.ok) {
    const message = isRecord(value) && typeof value.message === "string"
      ? value.message
      : isRecord(value) && typeof value.error === "string" ? value.error : "Unable to load Code Arena records.";
    throw new Error(message);
  }
  return parse(value);
}

export const arenaStatsApi = {
  userMatches: (userId: string, accessToken: string) =>
    request(`/users/${encodeURIComponent(userId)}/matches`, accessToken, (value) => {
      if (!isRecord(value) || !Array.isArray(value.matches)) throw new Error("Game service returned invalid match history.");
      return { matches: value.matches.map(parseMatch) };
    }),
  userStats: (userId: string, accessToken: string) =>
    request(`/users/${encodeURIComponent(userId)}/stats`, accessToken, parseStats),
  leaderboard: (accessToken: string) =>
    request("/leaderboard", accessToken, (value) => {
      if (!isRecord(value) || !Array.isArray(value.players)) throw new Error("Game service returned an invalid leaderboard.");
      return { players: value.players.map(parseLeaderboardEntry) };
    }),
};
