"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AccountAvatar } from "@/components/app/account-avatar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { accountApi, type PublicAccount } from "@/lib/accounts/client";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { accountImageSource } from "@/lib/accounts/images";
import { arenaStatsApi } from "@/lib/arena/stats";

export function LeaderboardView() {
  const { session, isRestoring, requestWithSession } = useAuth();
  const leaderboard = useQuery({
    queryKey: ["game", "leaderboard"],
    queryFn: () => requestWithSession((token) => arenaStatsApi.leaderboard(token)),
    enabled: Boolean(session && !isRestoring),
    retry: false,
    staleTime: 30_000,
  });
  const players = leaderboard.data?.players ?? [];
  const accountQueries = useQueries({
    queries: players.map((player) => ({
      queryKey: ["accounts", "public", player.userId],
      queryFn: () => accountApi.getPublic(player.userId),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const accounts = new Map<string, PublicAccount>();
  players.forEach((player, index) => {
    const account = accountQueries[index]?.data;
    if (account) accounts.set(player.userId, account);
  });

  if (isRestoring || (session && leaderboard.isPending)) {
    return <div role="status" className="mx-auto max-w-4xl px-4 py-10"><span className="sr-only">Loading leaderboard…</span><div className="h-12 animate-pulse bg-muted" /><div className="mt-5 h-96 animate-pulse bg-muted" /></div>;
  }
  if (!session) {
    return <main className="mx-auto max-w-4xl px-4 py-16 text-center"><h1 className="text-2xl font-semibold">Code Arena leaderboard</h1><p className="mt-2 text-sm text-muted-foreground">Log in to see player standings.</p><Link href="/login" className={cn(buttonVariants(), "mt-5 min-h-11")}>Log in</Link></main>;
  }

  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-nook-accent-text">Code Arena</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Leaderboard</h1><p className="mt-2 text-sm text-muted-foreground">Ranked by wins, then win rate, then matches played.</p></div>
      <Link href="/play" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>Back to Play</Link>
    </header>

    {leaderboard.isError
      ? <section className="bg-card p-6 text-center"><p role="alert" className="text-sm text-destructive">Could not load the leaderboard.</p><Button variant="outline" className="mt-3 min-h-10" onClick={() => void leaderboard.refetch()}>Try again</Button></section>
      : players.length === 0
        ? <section className="bg-card px-5 py-14 text-center"><h2 className="font-semibold">No ranked matches yet</h2><p className="mt-2 text-sm text-muted-foreground">Completed Code Arena matches will appear here.</p><Link href="/play" className={cn(buttonVariants(), "mt-4 min-h-10")}>Start a match</Link></section>
        : <section className="overflow-hidden bg-card" aria-labelledby="leaderboard-table-title">
          <h2 id="leaderboard-table-title" className="sr-only">Code Arena standings</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground"><th scope="col" className="px-4 py-3 font-medium">Rank</th><th scope="col" className="px-4 py-3 font-medium">Player</th><th scope="col" className="px-4 py-3 font-medium">Matches</th><th scope="col" className="px-4 py-3 font-medium">Wins</th><th scope="col" className="px-4 py-3 font-medium">Win rate</th></tr></thead>
              <tbody>{players.map((player) => {
                const account = accounts.get(player.userId);
                const name = account ? accountDisplayName(account) : "Player";
                const rankClass = player.rank === 1 ? "bg-primary text-primary-foreground" : player.rank <= 3 ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground";
                return <tr key={player.userId} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3"><span className={`inline-flex min-w-9 items-center justify-center px-2 py-1 font-mono text-xs font-semibold tabular-nums ${rankClass}`}>#{player.rank}</span></td>
                  <td className="px-4 py-3"><Link href={`/profile/${encodeURIComponent(player.userId)}`} className="flex min-w-0 items-center gap-3 hover:underline"><AccountAvatar source={accountImageSource(account?.avatarUrl ?? null)} seed={player.userId} label={`${name} avatar`} size={36} className="size-9 shrink-0 object-cover" /><span className="min-w-0"><span className="block truncate font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{account?.username ? `@${account.username}` : ""}{player.progression ? ` · Lvl ${player.progression.level} ${player.progression.rankTitle}` : ""}</span></span></Link></td>
                  <td className="px-4 py-3 font-mono tabular-nums">{player.matchesPlayed}</td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">{player.wins}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{Math.round(player.winRate * 100)}%</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>}
  </main>;
}
