import { io, type Socket } from "socket.io-client";
import type { MatchMode } from "./types.js";

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

export class LobbyClient {
  private socket?: Socket;
  private readonly apiBase: string;
  private readonly socketBase: string;
  private readonly devUserId: string | null;
  private readonly getAccessToken: (() => string | null) | null;
  private readonly onAuthExpired: (() => Promise<unknown>) | null;

  constructor(baseUrl: string, userId: string);
  constructor(options: { apiBase: string; socketBase: string; getAccessToken: () => string | null; onAuthExpired: () => Promise<unknown> });
  constructor(
    baseUrlOrOptions: string | { apiBase: string; socketBase: string; getAccessToken: () => string | null; onAuthExpired: () => Promise<unknown> },
    userId?: string,
  ) {
    if (typeof baseUrlOrOptions === "string") {
      this.apiBase = baseUrlOrOptions;
      this.socketBase = baseUrlOrOptions;
      this.devUserId = userId ?? null;
      this.getAccessToken = null;
      this.onAuthExpired = null;
    } else {
      this.apiBase = baseUrlOrOptions.apiBase;
      this.socketBase = baseUrlOrOptions.socketBase;
      this.devUserId = null;
      this.getAccessToken = baseUrlOrOptions.getAccessToken;
      this.onAuthExpired = baseUrlOrOptions.onAuthExpired;
    }
  }

  private headers(): Record<string, string> {
    const token = this.getAccessToken?.();
    return {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : this.devUserId ? { "x-dev-user-id": this.devUserId } : {}),
    };
  }

  /** Single safe retry on 401-after-renew; mutations are never replayed. */
  private async call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const send = async (): Promise<Response> =>
      fetch(`${this.apiBase}${path}`, {
        method: init?.method,
        headers: this.headers(),
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
    let res = await send();
    if (res.status === 401 && this.onAuthExpired) {
      await this.onAuthExpired();
      res = await send();
    }
    const json = (await res.json()) as (T & { error?: string }) | null;
    if (!res.ok || (json && typeof json.error === "string")) throw new Error(json?.error ?? `Lobby request failed (${res.status})`);
    return json as T;
  }

  async joinQueue(mode: MatchMode): Promise<QueueEntry> {
    const json = await this.call<{ entry: QueueEntry }>("/lobby/queue", { method: "POST", body: { mode } });
    return json.entry;
  }

  async cancelQueue(): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    return this.call("/lobby/queue/cancel", { method: "POST" });
  }

  async getQueueStatus(): Promise<QueueEntry | null> {
    const json = await this.call<{ entry: QueueEntry | null }>("/lobby/queue/status");
    return json.entry;
  }

  async createRoom(mode: MatchMode): Promise<RoomWithMembers> {
    const json = await this.call<RoomWithMembers>("/lobby/rooms", { method: "POST", body: { mode } });
    return { room: json.room, members: json.members };
  }

  async joinRoom(code: string): Promise<RoomWithMembers> {
    const json = await this.call<RoomWithMembers>("/lobby/rooms/join", { method: "POST", body: { code } });
    return { room: json.room, members: json.members };
  }

  async getRoom(roomId: string): Promise<RoomWithMembers> {
    const json = await this.call<RoomWithMembers>(`/lobby/rooms/${roomId}`);
    return { room: json.room, members: json.members };
  }

  async setSide(roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    const json = await this.call<RoomWithMembers>(`/lobby/rooms/${roomId}/side`, { method: "POST", body: { sideId } });
    return { room: json.room, members: json.members };
  }

  async setReady(roomId: string, ready: boolean): Promise<RoomWithMembers> {
    const json = await this.call<RoomWithMembers>(`/lobby/rooms/${roomId}/ready`, { method: "POST", body: { ready } });
    return { room: json.room, members: json.members };
  }

  async leaveRoom(roomId: string): Promise<{ left: boolean; closed: boolean }> {
    return this.call(`/lobby/rooms/${roomId}/leave`, { method: "POST" });
  }

  async startRoom(roomId: string): Promise<{ matchId: string }> {
    const json = await this.call<{ matchId: string }>(`/lobby/rooms/${roomId}/start`, { method: "POST" });
    return { matchId: json.matchId };
  }

  async getActive(): Promise<{ queue: QueueEntry | null; room: RoomWithMembers | null }> {
    const json = await this.call<{ queue: QueueEntry | null; room: RoomWithMembers | null }>("/lobby/active");
    return { queue: json.queue, room: json.room };
  }

  connectSocket(callbacks: {
    onConnect?: () => void;
    onRoomUpdated?: (data: { roomId: string; room: PrivateRoom; members: PrivateRoomMember[] }) => void;
    onMatchFound?: (data: { roomId: string; matchId: string }) => void;
    onQueueMatched?: (data: { matchId: string }) => void;
  }): () => void {
    if (this.socket) this.socket.disconnect();

    const token = this.getAccessToken?.();
    this.socket = io(`${this.socketBase}/lobby`, {
      auth: token ? { accessToken: token } : { userId: this.devUserId },
      transports: ["websocket"],
      reconnection: true,
    });

    if (callbacks.onConnect) this.socket.on("connect", callbacks.onConnect);

    if (callbacks.onRoomUpdated) {
      this.socket.on("lobby.roomUpdated", callbacks.onRoomUpdated);
    }
    if (callbacks.onMatchFound) {
      this.socket.on("lobby.matchFound", callbacks.onMatchFound);
    }
    if (callbacks.onQueueMatched) {
      this.socket.on("lobby.queueMatched", callbacks.onQueueMatched);
    }

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
