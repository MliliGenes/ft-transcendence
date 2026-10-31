import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { LobbyClient, PrivateRoomMember, RoomWithMembers } from "../arena/lobby.js";
import { LobbySession } from "../arena/lobby-session.js";
import type { MatchMode } from "../arena/types.js";

function LobbyHeader({
  userId,
  mode,
  hasRoom,
  onSelectMode,
}: {
  userId: string;
  mode: MatchMode;
  hasRoom: boolean;
  onSelectMode: (m: MatchMode) => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">Code Arena Lobby</h1>
        <p className="font-mono text-xs text-neutral-500">
          Player: <span className="text-neutral-800">{userId}</span>
        </p>
      </div>

      <div className="flex gap-1 rounded border border-neutral-200 bg-neutral-50 p-1" role="group" aria-label="Game Mode">
        {(["1v1", "2v2"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={hasRoom}
            aria-pressed={mode === m}
            className={`rounded px-3 py-1 font-mono text-xs font-medium transition-colors ${
              mode === m
                ? "bg-teal-700 text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
            }`}
            onClick={() => onSelectMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomTopBar({
  code,
  mode,
  isAllReady,
  onCopy,
  copied,
}: {
  code: string;
  mode: MatchMode;
  isAllReady: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">Invite Code</span>
          <span className="rounded bg-neutral-100 px-2.5 py-0.5 font-mono text-base font-bold text-neutral-900">
            {code}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="rounded border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs text-neutral-600 hover:bg-neutral-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Share this code with other players to invite them</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded border border-neutral-300 px-2 py-0.5 font-mono text-xs text-neutral-600">
          {mode} Mode
        </span>
        <span
          className={`rounded px-2 py-0.5 font-mono text-xs ${
            isAllReady ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {isAllReady ? "All Players Ready" : "Waiting for Players"}
        </span>
      </div>
    </div>
  );
}

function RoomMemberCard({
  member,
  userId,
  ownerUserId,
}: {
  member: PrivateRoomMember;
  userId: string;
  ownerUserId: string;
}) {
  const isYou = member.userId === userId;
  const isHost = member.userId === ownerUserId;

  return (
    <div className="flex items-center justify-between rounded border border-neutral-200 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-medium text-neutral-900">
          {member.userId} {isYou && "(You)"}
        </span>
        {isHost && (
          <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs text-neutral-700">
            Host
          </span>
        )}
      </div>
      <span
        className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${
          member.ready ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {member.ready ? "READY" : "NOT READY"}
      </span>
    </div>
  );
}

function RoomSidePanel({
  sideId,
  label,
  members,
  sideCap,
  userId,
  ownerUserId,
  mySideId,
  onSwitchSide,
}: {
  sideId: "left" | "right";
  label: string;
  members: PrivateRoomMember[];
  sideCap: number;
  userId: string;
  ownerUserId: string;
  mySideId?: string;
  onSwitchSide: (side: "left" | "right") => void;
}) {
  const canSwitch = mySideId !== sideId && members.length < sideCap;
  const openSlotsCount = Math.max(0, sideCap - members.length);

  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-700">
          {label} ({members.length}/{sideCap})
        </h3>
        {canSwitch && (
          <button
            type="button"
            onClick={() => onSwitchSide(sideId)}
            className="font-mono text-xs text-teal-700 hover:underline"
          >
            Switch Here
          </button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((m) => (
          <RoomMemberCard key={m.userId} member={m} userId={userId} ownerUserId={ownerUserId} />
        ))}
        {Array.from({ length: openSlotsCount }).map((_, i) => (
          <div
            key={`empty-${sideId}-${i}`}
            className="flex items-center justify-center rounded border border-dashed border-neutral-300 p-2.5 font-mono text-xs text-neutral-400"
          >
            Open Slot
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomFooterControls({
  isHost,
  canHostStart,
  isSidesFull,
  targetSideCap,
  myMember,
  onLeave,
  onToggleReady,
  onStart,
}: {
  isHost: boolean;
  canHostStart: boolean;
  isSidesFull: boolean;
  targetSideCap: number;
  myMember?: PrivateRoomMember;
  onLeave: () => void;
  onToggleReady: () => void;
  onStart: () => void;
}) {
  const hostHelpText = !isSidesFull
    ? `Both sides must be full (${targetSideCap} each) before match can start.`
    : "All players must click 'Ready Up' before match can start.";

  return (
    <div className="border-t border-neutral-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onLeave}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 font-mono text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Leave Room
        </button>

        <div className="flex items-center gap-3">
          {myMember && (
            <button
              type="button"
              onClick={onToggleReady}
              className={`rounded px-4 py-1.5 font-mono text-xs font-medium transition-colors ${
                myMember.ready
                  ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  : "bg-teal-700 text-white hover:bg-teal-600"
              }`}
            >
              {myMember.ready ? "Cancel Ready" : "Ready Up"}
            </button>
          )}

          {isHost ? (
            <button
              type="button"
              disabled={!canHostStart}
              onClick={onStart}
              className={`rounded px-4 py-1.5 font-mono text-xs font-bold transition-colors ${
                canHostStart
                  ? "bg-teal-700 text-white hover:bg-teal-600"
                  : "cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400"
              }`}
            >
              Start Match
            </button>
          ) : (
            <span className="font-mono text-xs text-neutral-500">Waiting for host to start…</span>
          )}
        </div>
      </div>

      {isHost && !canHostStart && (
        <p className="mt-3 text-right font-mono text-xs text-neutral-500">{hostHelpText}</p>
      )}
    </div>
  );
}

function PrivateRoomView({
  roomData,
  userId,
  copied,
  onCopy,
  onSwitchSide,
  onLeave,
  onToggleReady,
  onStart,
}: {
  roomData: RoomWithMembers;
  userId: string;
  copied: boolean;
  onCopy: () => void;
  onSwitchSide: (side: "left" | "right") => void;
  onLeave: () => void;
  onToggleReady: () => void;
  onStart: () => void;
}) {
  const isHost = roomData.room.ownerUserId === userId;
  const myMember = roomData.members.find((m: PrivateRoomMember) => m.userId === userId);
  const leftMembers = roomData.members.filter((m: PrivateRoomMember) => m.sideId === "left");
  const rightMembers = roomData.members.filter((m: PrivateRoomMember) => m.sideId === "right");
  const targetSideCap = roomData.room.mode === "1v1" ? 1 : 2;
  const targetTotalCap = roomData.room.mode === "1v1" ? 2 : 4;
  const isSidesFull = leftMembers.length === targetSideCap && rightMembers.length === targetSideCap;
  const isAllReady = roomData.members.length === targetTotalCap && roomData.members.every((m: PrivateRoomMember) => m.ready);
  const canHostStart = isHost && isSidesFull && isAllReady;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <RoomTopBar
        code={roomData.room.code}
        mode={roomData.room.mode}
        isAllReady={isAllReady}
        onCopy={onCopy}
        copied={copied}
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RoomSidePanel
          sideId="left"
          label="Left Side"
          members={leftMembers}
          sideCap={targetSideCap}
          userId={userId}
          ownerUserId={roomData.room.ownerUserId}
          mySideId={myMember?.sideId}
          onSwitchSide={onSwitchSide}
        />
        <RoomSidePanel
          sideId="right"
          label="Right Side"
          members={rightMembers}
          sideCap={targetSideCap}
          userId={userId}
          ownerUserId={roomData.room.ownerUserId}
          mySideId={myMember?.sideId}
          onSwitchSide={onSwitchSide}
        />
      </div>
      <RoomFooterControls
        isHost={isHost}
        canHostStart={canHostStart}
        isSidesFull={isSidesFull}
        targetSideCap={targetSideCap}
        myMember={myMember}
        onLeave={onLeave}
        onToggleReady={onToggleReady}
        onStart={onStart}
      />
    </div>
  );
}

function RoomEntryCard({
  mode,
  inviteInput,
  onInviteChange,
  onCreateRoom,
  onJoinRoom,
}: {
  mode: MatchMode;
  inviteInput: string;
  onInviteChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (e: React.FormEvent) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <div className="mb-2 inline-block rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-medium text-neutral-700">
          Invitation Code
        </div>
        <h2 className="text-base font-semibold text-neutral-900">Private Custom Room</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Create a private room to play with friends, pick teams, and start when everyone is ready.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={onCreateRoom}
          className="w-full rounded border border-neutral-300 bg-white px-4 py-2 font-mono text-xs font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Create {mode} Room
        </button>

        <form onSubmit={onJoinRoom} className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            placeholder="INVITE CODE"
            value={inviteInput}
            onChange={(e) => onInviteChange(e.target.value.toUpperCase())}
            className="w-full rounded border border-neutral-300 px-3 py-1.5 font-mono text-xs uppercase placeholder:text-neutral-400 focus:border-teal-700 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inviteInput.trim()}
            className="rounded bg-neutral-800 px-3 py-1.5 font-mono text-xs font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}

function LobbyFooter() {
  return (
    <footer className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500 flex justify-between items-center">
      <span>Code Arena</span>
      <nav className="flex gap-4" aria-label="Legal">
        <a href="/privacy" className="underline hover:text-neutral-700">Privacy Policy</a>
        <a href="/terms" className="underline hover:text-neutral-700">Terms of Service</a>
      </nav>
    </footer>
  );
}

export function LobbyPage({
  client,
  userId,
  onMatchFound,
  initialMode = "1v1",
}: {
  client: LobbyClient;
  userId: string;
  onMatchFound: (matchId: string) => void;
  initialMode?: MatchMode;
}) {
  const session = useMemo(() => new LobbySession(client, onMatchFound, initialMode), [client, initialMode, onMatchFound]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { mode, roomData, error } = state;
  const [inviteInput, setInviteInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void session.start();
    return () => session.stop();
  }, [session]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteInput.trim();
    if (!trimmed) return;
    if (await session.joinRoom(trimmed)) setInviteInput("");
  };

  const handleToggleReady = () => {
    if (!roomData) return;
    const myMember = roomData.members.find((m) => m.userId === userId);
    if (myMember) void session.setReady(!myMember.ready);
  };

  const copyCode = () => {
    if (!roomData) return;
    navigator.clipboard?.writeText(roomData.room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LobbyHeader
        userId={userId}
        mode={mode}
        hasRoom={Boolean(roomData)}
        onSelectMode={(m) => session.setMode(m)}
      />

      {error && (
        <div role="alert" className="mb-6 rounded border border-red-700 bg-white p-3 font-mono text-xs text-red-700">
          {error}
        </div>
      )}

      {roomData ? (
        <PrivateRoomView
          roomData={roomData}
          userId={userId}
          copied={copied}
          onCopy={copyCode}
          onSwitchSide={(targetSide) => void session.setSide(targetSide)}
          onLeave={() => void session.leaveRoom()}
          onToggleReady={handleToggleReady}
          onStart={() => void session.startRoom()}
        />
      ) : (
        <RoomEntryCard
          mode={mode}
          inviteInput={inviteInput}
          onInviteChange={setInviteInput}
          onCreateRoom={() => void session.createRoom()}
          onJoinRoom={handleJoinRoom}
        />
      )}

      <LobbyFooter />
    </div>
  );
}
