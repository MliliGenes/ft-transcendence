"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconPlayerPlay,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountAvatar } from "@/components/app/account-avatar";
import { LobbyClient, lobbyMatchPath, lobbyMemberName, type PrivateRoomMember, type RoomWithMembers } from "@/lib/arena/lobby";
import { accountApi, type PublicAccount } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";
import { Button } from "@/components/ui/button";

function TeamSlotCard({
  name,
  members,
  maxCapacity,
  currentUserId,
  profiles,
}: {
  name: string;
  members: PrivateRoomMember[];
  maxCapacity: number;
  currentUserId: string;
  profiles: Map<string, PublicAccount>;
}) {
  return (
    <div className="rounded-none border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <span className="font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {members.length} / {maxCapacity}
        </span>
      </div>
      <div className="space-y-2">
        {members.map((m) => {
          const profile = profiles.get(m.userId);
          const displayName = lobbyMemberName(profile);
          return <div key={m.userId} className="flex items-center justify-between gap-3 rounded-none bg-secondary/40 p-2.5 text-xs">
            <span className="flex min-w-0 items-center gap-2.5">
              <AccountAvatar source={accountImageSource(profile?.avatarUrl ?? null)} seed={m.userId} label={`${displayName} avatar`} size={32} className="size-8 shrink-0 object-cover" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{displayName} {m.userId === currentUserId && <span className="text-primary">(You)</span>}</span>
                {profile?.username && <span className="block truncate text-[11px] text-muted-foreground">@{profile.username}</span>}
              </span>
            </span>
            <span className={`inline-flex items-center gap-1 font-semibold ${m.ready ? "text-success" : "text-muted-foreground"}`}>
              {m.ready && <IconCheck className="size-3.5" />}
              <span>{m.ready ? "Ready" : "Waiting"}</span>
            </span>
          </div>;
        })}
        {members.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground italic">No players on {name}</p>
        )}
      </div>
    </div>
  );
}

export function LobbyView({ code }: { code: string }) {
  const normalizedCode = code.toUpperCase();
  const router = useRouter();
  const { session, isRestoring, requestWithSession } = useAuth();
  const userId = session?.user?.id ?? "guest-user";
  const token = session?.accessToken;
  const lobbyKey = `${normalizedCode}:${userId}:${token ?? ""}`;

  const [lobbyData, setLobbyData] = useState<RoomWithMembers | null>(null);
  const [resolvedLobbyKey, setResolvedLobbyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const loading = resolvedLobbyKey !== lobbyKey;
  const lobbyMembers = lobbyData?.members ?? [];
  const memberProfiles = useQueries({
    queries: lobbyMembers.map((member) => ({
      queryKey: ["accounts", "public", member.userId],
      queryFn: () => accountApi.getPublic(member.userId),
      enabled: Boolean(lobbyData),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const profilesById = new Map<string, PublicAccount>();
  lobbyMembers.forEach((member, index) => {
    const profile = memberProfiles[index]?.data;
    if (profile) profilesById.set(member.userId, profile);
  });

  useEffect(() => {
    if (isRestoring) return;
    if (!token) return;

    let client: LobbyClient | null = new LobbyClient("", userId, token, undefined, requestWithSession);
    let active = true;
    let currentRoomId: string | null = null;

    const disconnectSocket = client.connectSocket({
      onConnect: () => {
        if (currentRoomId && client) {
          client.joinRoomChannel(currentRoomId);
        }
      },
      onRoomUpdated: (updated) => {
        if (active) {
          setLobbyData({ room: updated.room, members: updated.members });
        }
      },
      onMatchFound: ({ matchId }) => {
        router.push(`/play/match/${matchId}`);
      },
    });

    async function init() {
      try {
        const data = await client!.getOrJoinRoom(normalizedCode);
        if (active) {
          const matchPath = lobbyMatchPath(data.room);
          if (matchPath) {
            router.replace(matchPath);
            return;
          }
          currentRoomId = data.room.id;
          client!.joinRoomChannel(data.room.id);
          setLobbyData(data);
          setError(null);
          setResolvedLobbyKey(lobbyKey);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load lobby");
          setResolvedLobbyKey(lobbyKey);
        }
      }
    }

    void init();

    const pollInterval = setInterval(async () => {
      if (!currentRoomId || !active || !client) return;
      try {
        const updated = await client.getRoom(currentRoomId);
        if (active) {
          setLobbyData(updated);
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(pollInterval);
      if (currentRoomId) {
        client?.leaveRoomChannel(currentRoomId);
      }
      disconnectSocket();
      client?.disconnect();
      client = null;
    };
  }, [normalizedCode, userId, token, requestWithSession, isRestoring, router, lobbyKey]);

  async function handleToggleReady() {
    if (!lobbyData) return;
    const currentMember = lobbyData.members.find((m) => m.userId === userId);
    const client = new LobbyClient("", userId, token, undefined, requestWithSession);
    const updated = await client.setReady(lobbyData.room.id, !currentMember?.ready);
    setLobbyData(updated);
  }

  async function handleSwitchSide() {
    if (!lobbyData) return;
    const currentMember = lobbyData.members.find((m) => m.userId === userId);
    const nextSide = currentMember?.sideId === "left" ? "right" : "left";
    const client = new LobbyClient("", userId, token, undefined, requestWithSession);
    const updated = await client.setSide(lobbyData.room.id, nextSide);
    setLobbyData(updated);
  }

  async function handleStart() {
    if (!lobbyData) return;
    const client = new LobbyClient("", userId, token, undefined, requestWithSession);
    const { matchId } = await client.startRoom(lobbyData.room.id);
    router.push(`/play/match/${matchId}`);
  }

  async function handleLeave() {
    if (lobbyData) {
      const client = new LobbyClient("", userId, token, undefined, requestWithSession);
      await client.leaveRoom(lobbyData.room.id).catch(() => {});
    }
    router.push("/play");
  }

  function handleCopy() {
    navigator.clipboard.writeText(normalizedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isRestoring || loading && token) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground animate-pulse">
        Connecting to lobby {normalizedCode}…
      </div>
    );
  }

  if (!token) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center"><h2 className="mb-2 text-xl font-bold text-danger">Lobby Error</h2><p className="mb-6 text-xs text-muted-foreground">Please log in to join this lobby.</p><Button onClick={() => router.push("/login")}>Log in</Button></div>;
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

  const capacity = room.mode === "2v2" ? 2 : 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Match Lobby</h1>
            <span className="rounded-none bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary uppercase font-mono">
              {room.mode}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Invite Code: <strong className="font-mono text-base font-bold text-foreground">{normalizedCode}</strong></span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-none bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
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
        <TeamSlotCard
          name="Team Alpha"
          members={leftMembers}
          maxCapacity={capacity}
          currentUserId={userId}
          profiles={profilesById}
        />
        <TeamSlotCard
          name="Team Beta"
          members={rightMembers}
          maxCapacity={capacity}
          currentUserId={userId}
          profiles={profilesById}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-none border border-border bg-card p-4">
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
