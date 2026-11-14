"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { SocketArenaTransport } from "@/lib/arena/socket";
import { ArenaWorkspace } from "@/components/arena/ArenaWorkspace";
import { Button } from "@/components/ui/button";
import type { AuthenticatedRequest } from "@/lib/auth/client";

export function MatchView({ matchId }: { matchId: string }) {
  const { session, isRestoring, requestWithSession } = useAuth();

  if (isRestoring) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
          Loading match arena…
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-xl font-bold text-foreground">Sign in required</h1>
        <p className="mb-6 text-xs text-muted-foreground">
          Log in to enter this match arena.
        </p>
        <Button render={<Link href={`/login?returnTo=/play/match/${encodeURIComponent(matchId)}`} />}>
          Log in
        </Button>
      </main>
    );
  }

  return (
    <AuthenticatedMatch
      key={`${matchId}:${session.user.id}`}
      matchId={matchId}
      userId={session.user.id}
      accessToken={session.accessToken}
      requestWithSession={requestWithSession}
    />
  );
}

function AuthenticatedMatch({
  matchId,
  userId,
  accessToken,
  requestWithSession,
}: {
  matchId: string;
  userId: string;
  accessToken: string;
  requestWithSession: AuthenticatedRequest;
}) {
  const [transport] = useState(() => new SocketArenaTransport({
    baseUrl: "",
    userId,
    matchId,
    token: accessToken,
    socketPath: "/api/game/socket.io",
    requestWithSession,
  }));

  useEffect(() => {
    transport.setAccessToken(accessToken);
  }, [accessToken, transport]);

  useEffect(() => () => transport.disconnect(), [transport]);

  return <ArenaWorkspace transport={transport} />;
}
