"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { accountApi, type PublicAccount } from "@/lib/accounts/client";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { arenaStatsApi, type CodeArenaMatchSummary } from "@/lib/arena/stats";

const historyKey = (userId: string) => ["game", "matches", userId] as const;
const statsKey = (userId: string) => ["game", "stats", userId] as const;

export function CodeArenaProfile({ userId }: { userId: string }) {
  const { session, isRestoring, requestWithSession } = useAuth();
  const matches = useQuery({
    queryKey: historyKey(userId),
    queryFn: () => requestWithSession((token) => arenaStatsApi.userMatches(userId, token)),
    enabled: Boolean(session && !isRestoring),
    retry: false,
    staleTime: 30_000,
  });
  const stats = useQuery({
    queryKey: statsKey(userId),
    queryFn: () => requestWithSession((token) => arenaStatsApi.userStats(userId, token)),
    enabled: Boolean(session && !isRestoring),
    retry: false,
    staleTime: 30_000,
  });

  const opponentIds = [...new Set(matches.data?.matches.flatMap((match) => match.opponentUserIds) ?? [])];
  const opponentQueries = useQueries({
    queries: opponentIds.map((opponentId) => ({
      queryKey: ["accounts", "public", opponentId],
      queryFn: () => accountApi.getPublic(opponentId),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const opponents = new Map<string, PublicAccount>();
  opponentIds.forEach((opponentId, index) => {
    const account = opponentQueries[index]?.data;
    if (account) opponents.set(opponentId, account);
  });

  if (isRestoring || (session && (matches.isPending || stats.isPending))) {
    return <div role="status" className="grid gap-4 py-6"><span className="sr-only">Loading Code Arena activity…</span><div className="h-24 animate-pulse bg-muted" /><div className="h-48 animate-pulse bg-muted" /></div>;
  }
  if (!session) {
    return <section className="bg-card px-5 py-10 text-center"><h2 className="text-lg font-semibold">Code Arena activity</h2><p className="mt-2 text-sm text-muted-foreground">Log in to view match records.</p><Link href="/login" className={cn(buttonVariants(), "mt-4 min-h-11")}>Log in</Link></section>;
  }

  return <section className="grid gap-5 py-5" aria-labelledby="code-arena-profile-title">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-nook-accent-text">Code Arena</p>
      <h2 id="code-arena-profile-title" className="mt-1 text-xl font-semibold">Match record</h2>
      <p className="mt-1 text-sm text-muted-foreground">Recent completed duels and team matches.</p>
    </header>

    {stats.isError
      ? <section className="bg-card p-4"><p role="alert" className="text-sm text-destructive">Could not load Code Arena statistics.</p><Button variant="outline" className="mt-3 min-h-10" onClick={() => void stats.refetch()}>Try again</Button></section>
      : stats.data && <>
        <dl className="grid grid-cols-3 gap-px bg-border">
          <Stat label="Played" value={stats.data.matchesPlayed.toLocaleString()} />
          <Stat label="Wins" value={stats.data.wins.toLocaleString()} />
          <Stat label="Win rate" value={`${Math.round(stats.data.winRate * 100)}%`} />
        </dl>

        {stats.data.progression && (
          <div className="border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Progression</span>
                <h3 className="text-base font-semibold">Level {stats.data.progression.level} · {stats.data.progression.rankTitle}</h3>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{stats.data.progression.xp} XP total · {stats.data.progression.xpToNextLevel} XP to next level</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, ((100 - stats.data.progression.xpToNextLevel) / 100) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {stats.data.progression?.achievements && (
          <section className="bg-card p-4" aria-labelledby="code-arena-achievements-title">
            <h3 id="code-arena-achievements-title" className="text-sm font-semibold mb-3">Achievements & Badges</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {stats.data.progression.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`flex items-start gap-2.5 rounded border p-2.5 transition-colors ${
                    ach.unlocked
                      ? "border-primary/30 bg-primary/5 text-foreground"
                      : "border-border/50 bg-muted/30 opacity-60"
                  }`}
                >
                  <span className="text-xl shrink-0" aria-hidden="true">{ach.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight">{ach.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{ach.description}</p>
                    {ach.unlocked && (
                      <span className="mt-1 inline-block text-[10px] text-primary font-medium">
                        Unlocked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </>}

    <section className="bg-card" aria-labelledby="code-arena-history-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 id="code-arena-history-title" className="font-semibold">Recent matches</h3>
        <Link href="/play" className="text-sm text-nook-accent-text underline underline-offset-2">Open Code Arena</Link>
      </header>
      {matches.isError
        ? <div className="p-5"><p role="alert" className="text-sm text-destructive">Could not load match history.</p><Button variant="outline" className="mt-3 min-h-10" onClick={() => void matches.refetch()}>Try again</Button></div>
        : matches.data?.matches.length === 0
          ? <div className="px-5 py-10 text-center"><p className="font-medium">No completed matches yet</p><p className="mt-1 text-sm text-muted-foreground">Play a duel to start building a record.</p><Link href="/play" className={cn(buttonVariants({ variant: "outline" }), "mt-4 min-h-10")}>Go to Code Arena</Link></div>
          : matches.data && <MatchHistory matches={matches.data.matches} opponents={opponents} />}
    </section>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-card px-3 py-4 sm:px-5"><dt className="truncate text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>;
}

function MatchHistory({ matches, opponents }: { matches: CodeArenaMatchSummary[]; opponents: Map<string, PublicAccount> }) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
      <thead><tr className="border-b border-border text-xs text-muted-foreground"><th scope="col" className="px-4 py-3 font-medium">Result</th><th scope="col" className="px-4 py-3 font-medium">Mode</th><th scope="col" className="px-4 py-3 font-medium">Opponent</th><th scope="col" className="px-4 py-3 font-medium">Score</th><th scope="col" className="px-4 py-3 font-medium">Date</th></tr></thead>
      <tbody>{matches.map((match) => <tr key={match.matchId} className="border-b border-border/70 last:border-0">
        <td className="px-4 py-3"><span className={`font-semibold capitalize ${match.outcome === "win" ? "text-success" : match.outcome === "loss" ? "text-destructive" : "text-muted-foreground"}`}>{match.outcome}</span></td>
        <td className="px-4 py-3 font-mono text-xs uppercase text-muted-foreground">{match.mode}</td>
        <td className="px-4 py-3">{match.opponentUserIds.length ? match.opponentUserIds.map((opponentId) => {
          const opponent = opponents.get(opponentId);
          const name = opponent ? accountDisplayName(opponent) : "Player";
          return <Link key={opponentId} href={`/profile/${encodeURIComponent(opponentId)}`} className="mr-2 text-nook-accent-text hover:underline">{name}</Link>;
        }) : <span className="text-muted-foreground">Unknown</span>}</td>
        <td className="px-4 py-3 font-mono tabular-nums">{match.score.for}–{match.score.against}</td>
        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(match.playedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export function CodeArenaSidebar() {
  return <section className="bg-card p-5" aria-labelledby="game-activity-title">
    <h2 id="game-activity-title" className="flex items-center gap-2 text-sm font-semibold"><IconDeviceGamepad2 size={17} className="text-primary" aria-hidden="true" />Code Arena</h2>
    <p className="mt-3 text-sm text-muted-foreground">Start a duel, join a private lobby, or review the leaderboard.</p>
    <div className="mt-4 flex flex-wrap gap-2"><Link href="/play" className={cn(buttonVariants({ variant: "outline" }), "min-h-10")}>Play</Link><Link href="/play/leaderboard" className={cn(buttonVariants({ variant: "ghost" }), "min-h-10")}>Leaderboard</Link></div>
  </section>;
}
