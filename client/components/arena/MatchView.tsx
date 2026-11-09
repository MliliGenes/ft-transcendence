"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SocketArenaTransport } from "@/lib/arena/socket";
import { ArenaWorkspace } from "@/components/arena/ArenaWorkspace";

export function MatchView({ matchId }: { matchId: string }) {
  const { session, isRestoring } = useAuth();
  const userId = session?.user?.id ?? "guest-user";
  const token = session?.accessToken;

  const transport = useMemo(() => {
    if (isRestoring || !token) return null;
    return new SocketArenaTransport({
      baseUrl: "",
      userId,
      matchId,
      token,
      socketPath: "/api/game/socket.io",
    });
  }, [matchId, userId, token, isRestoring]);

  useEffect(() => {
    return () => {
      transport?.disconnect();
    };
  }, [transport]);

  if (isRestoring || !transport) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
          Loading match arena…
        </p>
      </div>
    );
  }

  return <ArenaWorkspace transport={transport} />;
}
