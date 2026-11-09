"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SocketArenaTransport } from "@/lib/arena/socket";
import { ArenaWorkspace } from "@/components/arena/ArenaWorkspace";

export function MatchView({ matchId }: { matchId: string }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? "guest-user";
  const token = session?.accessToken;

  const transport = useMemo(() => {
    return new SocketArenaTransport({
      baseUrl: "",
      userId,
      matchId,
      token,
      socketPath: "/api/game/socket.io",
    });
  }, [matchId, userId, token]);

  useEffect(() => {
    return () => {
      transport.disconnect();
    };
  }, [transport]);

  return <ArenaWorkspace transport={transport} />;
}
