"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconPlayerPlay,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LobbyClient, type RoomWithMembers } from "@/lib/arena/lobby";
import { Button } from "@/components/ui/button";

export function LobbyView({ code }: { code: string }) {
  const normalizedCode = code.toUpperCase();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? "guest-user";
  const token = session?.accessToken;

  const [lobbyData, setLobbyData] = useState<RoomWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let client: LobbyClient | null = new LobbyClient("", userId, token);
    let active = true;

    async function init() {
      try {
        const data = await client!.joinRoom(normalizedCode);
        if (active) {
          setLobbyData(data);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load lobby");
          setLoading(false);
        }
      }
    }

    void init();

    const disconnectSocket = client.connectSocket({
      onRoomUpdated: (updated) => {
        if (active) {
          setLobbyData({ room: updated.room, members: updated.members });
        }
      },
      onMatchFound: ({ matchId }) => {
        router.push(`/play/match/${matchId}`);
      },
    });

    return () => {
      active = false;
      disconnectSocket();
      client?.disconnect();
      client = null;
    };
  }, [normalizedCode, userId, token, router]);

  async function handleToggleReady() {
    if (!lobbyData) return;
    const currentMember = lobbyData.members.find((m) => m.userId === userId);
    const client = new LobbyClient("", userId, token);
    const updated = await client.setReady(lobbyData.room.id, !currentMember?.ready);
    setLobbyData(updated);
  }

  async function handleSwitchSide() {
    if (!lobbyData) return;
    const currentMember = lobbyData.members.find((m) => m.userId === userId);
    const nextSide = currentMember?.sideId === "left" ? "right" : "left";
    const client = new LobbyClient("", userId, token);
    const updated = await client.setSide(lobbyData.room.id, nextSide);
    setLobbyData(updated);
  }

  async function handleStart() {
    if (!lobbyData) return;
    const client = new LobbyClient("", userId, token);
    const { matchId } = await client.startRoom(lobbyData.room.id);
    router.push(`/play/match/${matchId}`);
  }

  async function handleLeave() {
    if (lobbyData) {
      const client = new LobbyClient("", userId, token);
      await client.leaveRoom(lobbyData.room.id).catch(() => {});
    }
    router.push("/play");
  }

  function handleCopy() {
    navigator.clipboard.writeText(normalizedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground animate-pulse">
        Connecting to lobby {normalizedCode}…
      </div>
    );
  }

  if (error || !lobbyData) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-danger mb-2">Lobby Error</h2>
        <p className="text-xs text-muted-foreground mb-6">{error ?? "Room not found or expired."}</p>
        <Button onClick={() => router.push("/play")}>Back to Play</Button>
      </div>
    );
  }

  const { room, members } = lobbyData;
  const isOwner = room.ownerUserId === userId;
  const currentMember = members.find((m) => m.userId === userId);
  const leftMembers = members.filter((m) => m.sideId === "left");
  const rightMembers = members.filter((m) => m.sideId === "right");
  const allReady = members.length >= (room.mode === "2v2" ? 4 : 2) && members.every((m) => m.ready);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Match Lobby</h1>
            <span className="rounded bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary uppercase">
              {room.mode}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Invite Code: <strong className="font-mono text-base font-bold text-foreground">{normalizedCode}</strong></span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <IconCopy className="size-3" />
              <span>{copied ? "Copied!" : "Copy Code"}</span>
            </button>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLeave} className="text-muted-foreground hover:text-destructive">
          <IconArrowLeft className="size-4 mr-1" />
          <span>Leave Lobby</span>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="rounded border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <span className="font-semibold text-foreground">Team Alpha</span>
            <span className="text-xs text-muted-foreground">{leftMembers.length} / {room.mode === "2v2" ? 2 : 1}</span>
          </div>
          <div className="space-y-2">
            {leftMembers.map((m) => (
              <div key={m.userId} className="flex items-center justify-between rounded bg-secondary/40 p-2.5 text-xs">
                <span className="font-medium text-foreground">
                  {m.userId} {m.userId === userId && <span className="text-primary">(You)</span>}
                </span>
                <span className={`inline-flex items-center gap-1 font-semibold ${m.ready ? "text-success" : "text-muted-foreground"}`}>
                  {m.ready && <IconCheck className="size-3.5" />}
                  <span>{m.ready ? "Ready" : "Waiting"}</span>
                </span>
              </div>
            ))}
            {leftMembers.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground italic">No players on Team Alpha</p>
            )}
          </div>
        </div>

        <div className="rounded border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <span className="font-semibold text-foreground">Team Beta</span>
            <span className="text-xs text-muted-foreground">{rightMembers.length} / {room.mode === "2v2" ? 2 : 1}</span>
          </div>
          <div className="space-y-2">
            {rightMembers.map((m) => (
              <div key={m.userId} className="flex items-center justify-between rounded bg-secondary/40 p-2.5 text-xs">
                <span className="font-medium text-foreground">
                  {m.userId} {m.userId === userId && <span className="text-primary">(You)</span>}
                </span>
                <span className={`inline-flex items-center gap-1 font-semibold ${m.ready ? "text-success" : "text-muted-foreground"}`}>
                  {m.ready && <IconCheck className="size-3.5" />}
                  <span>{m.ready ? "Ready" : "Waiting"}</span>
                </span>
              </div>
            ))}
            {rightMembers.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground italic">No players on Team Beta</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleSwitchSide}>
            <IconSwitchHorizontal className="size-4 mr-1.5" />
            <span>Switch Team</span>
          </Button>

          <Button
            variant={currentMember?.ready ? "secondary" : "default"}
            size="sm"
            onClick={handleToggleReady}
          >
            <IconCheck className={`size-4 mr-1.5 ${currentMember?.ready ? "text-success" : ""}`} />
            <span>{currentMember?.ready ? "Ready (Click to Cancel)" : "Mark Ready"}</span>
          </Button>
        </div>

        {isOwner && (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={!allReady}
            className="bg-primary text-primary-foreground font-semibold"
          >
            <IconPlayerPlay className="size-4 mr-1.5" />
            <span>{allReady ? "Start Match" : "Waiting for all players to ready up…"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
