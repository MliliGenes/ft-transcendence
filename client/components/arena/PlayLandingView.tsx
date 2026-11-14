'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconCode,
  IconDeviceGamepad2,
  IconPlus,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LobbyClient, type PrivateRoom } from '@/lib/arena/lobby';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PlayLandingView() {
  const router = useRouter();
  const { session, requestWithSession } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<PrivateRoom | null>(null);

  const userId = session?.user?.id ?? 'guest-user';
  const token = session?.accessToken;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const client = new LobbyClient(
      '',
      userId,
      token,
      undefined,
      requestWithSession,
    );
    client
      .getActive()
      .then(({ room }) => {
        if (!cancelled && room) {
          setActiveRoom(room.room);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, token, requestWithSession]);

  async function handleLeaveActiveRoom() {
    if (!activeRoom || !token) return;
    try {
      const client = new LobbyClient(
        '',
        userId,
        token,
        undefined,
        requestWithSession,
      );
      await client.leaveRoom(activeRoom.id);
      setActiveRoom(null);
    } catch {
      // ignore
    }
  }

  async function handleCreate(mode: '1v1' | '2v2') {
    setLoading(true);
    setError(null);
    try {
      const client = new LobbyClient(
        '',
        userId,
        token,
        undefined,
        requestWithSession,
      );
      const { room } = await client.createRoom(mode);
      router.push(`/play/lobby/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lobby');
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
      const client = new LobbyClient(
        '',
        userId,
        token,
        undefined,
        requestWithSession,
      );
      const { room } = await client.joinRoom(joinCode.trim().toUpperCase());
      router.push(`/play/lobby/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join lobby');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-none bg-primary/10 text-primary">
            <IconDeviceGamepad2 className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Play — Code Arena
            </h1>
            <p className="text-sm text-muted-foreground">
              Competitive multiplayer programming battles. Solve problems, check
              tests, and evaluate under time pressure.
            </p>
          </div>
        </div>
        <Link
          href="/play/leaderboard"
          className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
        >
          Leaderboard
        </Link>
      </div>

      {activeRoom && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-none border border-primary/40 bg-primary/10 p-4 text-xs font-medium text-foreground">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-primary">Active Lobby:</span>
            <span className="font-mono text-sm tracking-wider font-bold tabular-nums">
              {activeRoom.code}
            </span>
            <span className="text-muted-foreground">({activeRoom.mode})</span>
            {activeRoom.matchId && (
              <span className="rounded-none bg-success/20 px-2 py-0.5 text-[11px] font-semibold text-success">
                Match In Progress
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() =>
                router.push(
                  activeRoom.matchId
                    ? `/play/match/${activeRoom.matchId}`
                    : `/play/lobby/${activeRoom.code}`,
                )
              }
            >
              {activeRoom.matchId ? 'Rejoin Active Match' : 'Resume Lobby'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleLeaveActiveRoom}>
              Leave
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-none border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-none border border-border bg-card p-6 text-card-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
            <IconPlus className="size-5 text-primary" />
            <span>Create a Match Lobby</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Host a private lobby with a 6-character room code. Share the code
            with classmates or invite them directly in chat.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleCreate('1v1')}
              disabled={loading}
              className="w-full justify-start text-sm"
            >
              <IconCode className="size-4 mr-2" />
              <span>Create 1v1 Duel</span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleCreate('2v2')}
              disabled={loading}
              className="w-full justify-start text-sm"
            >
              <IconUsers className="size-4 mr-2" />
              <span>Create 2v2 Team Battle (Collaborative)</span>
            </Button>
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6 text-card-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
            <IconUserPlus className="size-5 text-primary" />
            <span>Join with Code</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Enter the 6-character room code received from your friend or chat
            invitation.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label
                htmlFor="join-code"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
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
                className="w-full rounded-none border border-border bg-background px-3 py-2 font-mono text-base uppercase tracking-wider text-foreground placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || joinCode.length < 4}
              className="w-full"
            >
              <span>Join Lobby</span>
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-8 rounded-none border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconCode className="size-4 text-primary" />
            <span>Active Matches & Session Overview</span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            {activeRoom ? '1 active session' : '0 active sessions'}
          </span>
        </div>
        {activeRoom ? (
          <div className="flex items-center justify-between py-2 text-xs">
            <div>
              <span className="font-semibold text-foreground">
                {activeRoom.mode.toUpperCase()} Arena Match
              </span>
              <span className="ml-2 font-mono text-muted-foreground">
                Room: {activeRoom.code}
              </span>
            </div>
            <span className="font-mono text-success text-[11px]">Active</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-2">
            No active match in progress. Create a 1v1 duel or 2v2 team battle
            above to start coding!
          </p>
        )}
      </div>
    </div>
  );
}
