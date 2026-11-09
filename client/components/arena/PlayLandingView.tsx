"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCode, IconDeviceGamepad2, IconPlus, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LobbyClient } from "@/lib/arena/lobby";
import { Button } from "@/components/ui/button";

export function PlayLandingView() {
  const router = useRouter();
  const { session } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id ?? "guest-user";
  const token = session?.accessToken;

  async function handleCreate(mode: "1v1" | "2v2") {
    setLoading(true);
    setError(null);
    try {
      const client = new LobbyClient("", userId, token);
      const { room } = await client.createRoom(mode);
      router.push(`/play/lobby/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lobby");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const client = new LobbyClient("", userId, token);
      const { room } = await client.joinRoom(joinCode.trim().toUpperCase());
      router.push(`/play/lobby/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join lobby");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded bg-primary/10 text-primary">
            <IconDeviceGamepad2 className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Play — Code Arena</h1>
            <p className="text-sm text-muted-foreground">
              Competitive multiplayer programming battles. Solve problems, check tests, and evaluate under time pressure.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded border border-border bg-card p-6 text-card-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
            <IconPlus className="size-5 text-primary" />
            <span>Create a Match Lobby</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Host a private lobby with a 6-character room code. Share the code with classmates or invite them directly in chat.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleCreate("1v1")}
              disabled={loading}
              className="w-full justify-start text-sm"
            >
              <IconCode className="size-4 mr-2" />
              <span>Create 1v1 Duel</span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleCreate("2v2")}
              disabled={loading}
              className="w-full justify-start text-sm"
            >
              <IconUsers className="size-4 mr-2" />
              <span>Create 2v2 Team Battle (Collaborative)</span>
            </Button>
          </div>
        </div>

        <div className="rounded border border-border bg-card p-6 text-card-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
            <IconUserPlus className="size-5 text-primary" />
            <span>Join with Code</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Enter the 6-character room code received from your friend or chat invitation.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="join-code" className="block text-xs font-medium text-muted-foreground mb-1">
                Lobby Code
              </label>
              <input
                id="join-code"
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB12CD"
                disabled={loading}
                className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-base uppercase tracking-wider text-foreground placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button type="submit" disabled={loading || joinCode.length < 4} className="w-full">
              <span>Join Lobby</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
