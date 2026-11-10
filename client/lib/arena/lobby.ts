import { io, type Socket } from "socket.io-client";
import type { MatchMode } from "./types";

export type LobbySideId = "left" | "right";

export interface QueueEntry {
  id: string;
  userId: string;
  mode: MatchMode;
  status: "waiting" | "matched" | "cancelled";
  joinedAt: number;
  matchedMatchId: string | null;
}

export interface PrivateRoom {
  id: string;
  code: string;
  mode: MatchMode;
  ownerUserId: string;
  status: "open" | "matched" | "expired" | "closed";
  createdAt: number;
  expiresAt: number;
  matchId: string | null;
}

export interface PrivateRoomMember {
  roomId: string;
  userId: string;
  sideId: LobbySideId;
  ready: boolean;
  joinedAt: number;
}

export interface RoomWithMembers {
  room: PrivateRoom;
  members: PrivateRoomMember[];
}

export function lobbyMemberName(profile: { displayName?: string | null; username?: string | null } | undefined): string {
  const displayName = profile?.displayName?.trim();
  if (displayName) return displayName;
  const username = profile?.username?.trim();
  return username ? `@${username}` : "Player";
}

export function lobbyMatchPath(room: Pick<PrivateRoom, "status" | "matchId">): string | null {
  if (room.status !== "matched" || !room.matchId) return null;
  return `/play/match/${encodeURIComponent(room.matchId)}`;
}

function headers(userId: string, token?: string): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json",
    "x-dev-user-id": userId,
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export class LobbyClient {
  private socket?: Socket;

  constructor(
    private readonly baseUrl: string,
    private readonly userId: string,
    private readonly token?: string,
    private readonly socketPath?: string,
  ) {}

  async joinQueue(mode: MatchMode): Promise<QueueEntry> {
    const res = await fetch(`${this.baseUrl}/lobby/queue`, {
      method: "POST",
      headers: headers(this.userId, this.token),
      body: JSON.stringify({ mode }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to join queue");
    return json.entry;
  }

  async cancelQueue(): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    const res = await fetch(`${this.baseUrl}/lobby/queue/cancel`, {
      method: "POST",
      headers: headers(this.userId, this.token),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to cancel queue");
    return json;
  }

  async getQueueStatus(): Promise<QueueEntry | null> {
    const res = await fetch(`${this.baseUrl}/lobby/queue/status`, {
      headers: headers(this.userId, this.token),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to get queue status");
    return json.entry;
  }

  async createRoom(mode: MatchMode): Promise<RoomWithMembers> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms`, {
      method: "POST",
      headers: headers(this.userId, this.token),
      body: JSON.stringify({ mode }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to create room");
    return { room: json.room, members: json.members };
  }

  async joinRoom(code: string): Promise<RoomWithMembers> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms/join`, {
      method: "POST",
      headers: headers(this.userId, this.token),
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to join room");
    return { room: json.room, members: json.members };
  }

  async lookupRoom(code: string): Promise<{ status: "open" | "matched" | "expired" | "closed"; room: PrivateRoom | null; members: PrivateRoomMember[] }> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms/lookup/${encodeURIComponent(code)}`, {
      headers: headers(this.userId, this.token),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to lookup room");
    return { status: json.status ?? "expired", room: json.room ?? null, members: json.members ?? [] };
  }

  async getOrJoinRoom(code: string): Promise<RoomWithMembers> {
    const normalizedCode = code.toUpperCase().trim();
    const { room } = await this.getActive();
    if (room?.room.code.toUpperCase() === normalizedCode) return room;
    return this.joinRoom(normalizedCode);
  }

  async getRoom(roomId: string): Promise<RoomWithMembers> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms/${roomId}`, {
      headers: headers(this.userId, this.token),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to get room");
    return { room: json.room, members: json.members };
  }

  async setSide(roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms/${roomId}/side`, {
      method: "POST",
      headers: headers(this.userId, this.token),
      body: JSON.stringify({ sideId }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to change side");
    return { room: json.room, members: json.members };
  }

  async setReady(roomId: string, ready: boolean): Promise<RoomWithMembers> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms/${roomId}/ready`, {
      method: "POST",
      headers: headers(this.userId, this.token),
      body: JSON.stringify({ ready }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to set ready");
    return { room: json.room, members: json.members };
  }

  async leaveRoom(roomId: string): Promise<{ left: boolean; closed: boolean }> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms/${roomId}/leave`, {
      method: "POST",
      headers: headers(this.userId, this.token),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to leave room");
    return json;
  }

  async startRoom(roomId: string): Promise<{ matchId: string }> {
    const res = await fetch(`${this.baseUrl}/lobby/rooms/${roomId}/start`, {
      method: "POST",
      headers: headers(this.userId, this.token),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to start room");
    return { matchId: json.matchId };
  }

  async getActive(): Promise<{ queue: QueueEntry | null; room: RoomWithMembers | null }> {
    const res = await fetch(`${this.baseUrl}/lobby/active`, {
      headers: headers(this.userId, this.token),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? "Failed to get active status");
    return { queue: json.queue, room: json.room };
  }

  connectSocket(callbacks: {
    onConnect?: () => void;
    onRoomUpdated?: (data: { roomId: string; room: PrivateRoom; members: PrivateRoomMember[] }) => void;
    onMatchFound?: (data: { roomId: string; matchId: string }) => void;
    onQueueMatched?: (data: { matchId: string }) => void;
  }): () => void {
    if (this.socket) this.socket.disconnect();

    const socketPath = this.socketPath ?? (
      this.baseUrl.includes("/api/game") || !this.baseUrl ? "/api/game/socket.io" : "/socket.io"
    );
    const auth: Record<string, unknown> = { userId: this.userId };
    if (this.token) auth.token = this.token;

    this.socket = io(`${this.baseUrl}/lobby`, {
      path: socketPath,
      auth,
      query: { userId: this.userId },
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    if (callbacks.onConnect) this.socket.on("connect", callbacks.onConnect);
    if (callbacks.onRoomUpdated) this.socket.on("lobby.roomUpdated", callbacks.onRoomUpdated);
    if (callbacks.onMatchFound) this.socket.on("lobby.matchFound", callbacks.onMatchFound);
    if (callbacks.onQueueMatched) this.socket.on("lobby.queueMatched", callbacks.onQueueMatched);

    return () => {
      this.socket?.disconnect();
      this.socket = undefined;
    };
  }

  joinRoomChannel(roomId: string): void {
    this.socket?.emit("lobby:join_room", { roomId });
  }

  leaveRoomChannel(roomId: string): void {
    this.socket?.emit("lobby:leave_room", { roomId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
