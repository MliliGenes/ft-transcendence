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

function tokenNearExpiry(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 - Date.now() < 30_000;
  } catch { return false; }
}

function isMutationMethod(method?: string): boolean {
  return Boolean(method && method !== "GET" && method !== "HEAD");
}

export class LobbyClient {
  private socket?: Socket;
  private readonly apiBase: string;
  private readonly socketBase: string;
  private readonly devUserId: string | null;
  private readonly getAccessToken: (() => string | null) | null;
  private readonly onAuthExpired: (() => Promise<unknown>) | null;
  private callbacks?: Parameters<LobbyClient["connectSocket"]>[0];
  private lifetime = new AbortController();
  private attachedToken: string | null = null;
  private recovery: Promise<void> | null = null;
  private tokenRenewal: Promise<unknown> | null = null;
  private expiryRecovery: Promise<void> | null = null;
  private ready: Promise<void> = Promise.resolve();

  constructor(baseUrl: string, userId: string);
  constructor(options: { apiBase: string; socketBase: string; getAccessToken: () => string | null; onAuthExpired: () => Promise<unknown> });
  constructor(
    baseUrlOrOptions: string | { apiBase: string; socketBase: string; getAccessToken: () => string | null; onAuthExpired: () => Promise<unknown> },
    userId?: string,
  ) {
    if (typeof baseUrlOrOptions === "string") {
      if (!import.meta.env.DEV) throw new Error("Development Lobby identity is disabled in production");
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

  private authHeader(): Record<string, string> {
    const token = this.getAccessToken ? this.getAccessToken() : null;
    if (token) return { Authorization: `Bearer ${token}` };
    if (import.meta.env.DEV && this.devUserId) return { "x-dev-user-id": this.devUserId };
    return {};
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      ...this.authHeader(),
    };
  }

  private performFetch(path: string, init: { method?: string; body?: unknown } | undefined, lifetime: AbortController): Promise<Response> {
    return fetch(`${this.apiBase}${path}`, {
      method: init?.method,
      headers: this.headers(),
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: lifetime.signal,
    });
  }

  private async handle401(lifetime: AbortController, method?: string): Promise<void> {
    await this.renewAuth();
    this.assertActive(lifetime);
    if (!this.recovery && this.attachedToken !== (this.getAccessToken ? this.getAccessToken() : null)) {
      await this.renewSocket();
    }
    this.assertActive(lifetime);
    if (isMutationMethod(method)) {
      throw new Error("Session renewed. The action was not resent. Check the lobby before retrying.");
    }
  }

  private async parseResponse<T>(res: Response, lifetime: AbortController): Promise<T> {
    const json = (await res.json()) as (T & { error?: string }) | null;
    if (!res.ok || (json && typeof json.error === "string")) {
      throw new Error(json?.error ?? `Lobby request failed (${res.status})`);
    }
    this.assertActive(lifetime);
    return json as T;
  }

  /** Single safe retry on 401-after-renew; mutations are never replayed. */
  private async call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const lifetime = this.lifetime;
    if (isMutationMethod(init?.method)) await this.prepareCommand(lifetime);
    this.assertActive(lifetime);

    let res = await this.performFetch(path, init, lifetime);
    this.assertActive(lifetime);

    if (res.status === 401 && this.onAuthExpired) {
      await this.handle401(lifetime, init?.method);
      res = await this.performFetch(path, init, lifetime);
      this.assertActive(lifetime);
    }

    return this.parseResponse<T>(res, lifetime);
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
    onConnect?: () => void | Promise<void>;
    onRoomUpdated?: (data: { roomId: string; room: PrivateRoom; members: PrivateRoomMember[] }) => void;
    onMatchFound?: (data: { roomId: string; matchId: string }) => void;
    onQueueMatched?: (data: { matchId: string }) => void;
  }): () => void {
    this.disconnect();
    this.lifetime = new AbortController();
    const lifetime = this.lifetime;
    this.callbacks = callbacks;
    this.ready = this.attachSocket(lifetime);
    void this.ready.catch(() => {});
    return () => { if (this.lifetime === lifetime) this.disconnect(); };
  }

  private resetCurrentSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
  }

  /** The same client keeps its callbacks; token rotation replaces only its socket. */
  renewSocket(): Promise<void> {
    if (this.recovery) return this.recovery;
    if (!this.socket || this.lifetime.signal.aborted) return Promise.resolve();
    const lifetime = this.lifetime;
    this.resetCurrentSocket();
    const recovery = this.attachSocket(lifetime).then(async () => {
      // A read during recovery may itself refresh the token. Rejoin with that token too.
      const token = this.getAccessToken ? this.getAccessToken() : null;
      if (this.attachedToken !== token) {
        this.resetCurrentSocket();
        await this.attachSocket(lifetime);
      }
    }).finally(() => {
      if (this.recovery === recovery) this.recovery = null;
    });
    this.ready = recovery;
    this.recovery = recovery;
    return recovery;
  }

  private buildSocket(token: string | null): Socket {
    return io(`${this.socketBase}/lobby`, {
      auth: token ? { accessToken: token } : import.meta.env.DEV && this.devUserId ? { userId: this.devUserId } : {},
      transports: ["websocket"],
      reconnection: true,
      autoConnect: false,
      forceNew: true,
    });
  }

  private isSocketActive(socket: Socket, lifetime: AbortController): boolean {
    return this.socket === socket && this.lifetime === lifetime && !lifetime.signal.aborted;
  }

  private bindSocketEvents(socket: Socket, lifetime: AbortController): void {
    const handlers: Array<[string, ((data: any) => void) | undefined]> = [
      ["lobby.roomUpdated", this.callbacks?.onRoomUpdated],
      ["lobby.matchFound", this.callbacks?.onMatchFound],
      ["lobby.queueMatched", this.callbacks?.onQueueMatched],
    ];
    for (const [event, cb] of handlers) {
      if (cb) {
        socket.on(event, (data: unknown) => {
          if (this.isSocketActive(socket, lifetime)) cb(data);
        });
      }
    }
  }

  private handleSocketConnect(
    socket: Socket,
    lifetime: AbortController,
    resolve: () => void,
    reject: (error: Error) => void,
  ): void {
    if (!this.isSocketActive(socket, lifetime)) return;
    const recovery = Promise.resolve().then(() => this.callbacks?.onConnect?.()).then(() => {
      this.assertActive(lifetime);
      if (!this.isSocketActive(socket, lifetime) || !socket.connected) {
        throw new Error("Lobby disconnected during recovery");
      }
    });
    this.ready = recovery;
    void recovery.then(resolve, reject);
  }

  private handleSocketDisconnect(
    socket: Socket,
    lifetime: AbortController,
    token: string | null,
    reason: string,
    reject: (error: Error) => void,
  ): void {
    if (!this.isSocketActive(socket, lifetime)) return;
    reject(new Error("Lobby disconnected during recovery"));
    if (reason === "io server disconnect" && token) {
      void this.recoverExpiredSocket(lifetime).catch(() => {});
    }
  }

  private bindConnectionLifecycle(
    socket: Socket,
    lifetime: AbortController,
    token: string | null,
  ): Promise<void> {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const ready = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    const timer = setTimeout(() => reject(new Error("Lobby connection timed out")), 10_000);
    const cancelled = () => reject(new Error("Lobby connection cancelled"));
    lifetime.signal.addEventListener("abort", cancelled, { once: true });

    socket.on("connect", () => this.handleSocketConnect(socket, lifetime, resolve, reject));
    socket.on("disconnect", (reason: string) => this.handleSocketDisconnect(socket, lifetime, token, reason, reject));
    socket.on("connect_error", (error: Error) => {
      if (this.isSocketActive(socket, lifetime) && !socket.active) reject(error);
    });

    socket.connect();
    return ready.finally(() => {
      clearTimeout(timer);
      lifetime.signal.removeEventListener("abort", cancelled);
    });
  }

  private attachSocket(lifetime: AbortController): Promise<void> {
    this.assertActive(lifetime);
    const token = this.getAccessToken ? this.getAccessToken() : null;
    this.attachedToken = token;
    const socket = this.buildSocket(token);
    this.socket = socket;
    this.bindSocketEvents(socket, lifetime);
    return this.bindConnectionLifecycle(socket, lifetime, token);
  }

  private async executeExpiryRecovery(lifetime: AbortController): Promise<void> {
    // Trust the server disconnect, not the browser clock's expiry estimate.
    const token = this.getAccessToken ? this.getAccessToken() : null;
    if (token && token === this.attachedToken) await this.renewAuth();
    this.assertActive(lifetime);
    const nextToken = this.getAccessToken ? this.getAccessToken() : null;
    if (!nextToken) throw new Error("Session expired. Please sign in again.");
    if (this.attachedToken !== nextToken) await this.renewSocket();
    if (this.recovery) await this.recovery;
    this.assertActive(lifetime);
  }

  private recoverExpiredSocket(lifetime: AbortController): Promise<void> {
    if (this.expiryRecovery) return this.expiryRecovery;
    const recovery = this.executeExpiryRecovery(lifetime).finally(() => {
      if (this.expiryRecovery === recovery) this.expiryRecovery = null;
    });
    this.expiryRecovery = recovery;
    return recovery;
  }

  private async ensureTokenFresh(lifetime: AbortController): Promise<void> {
    const token = this.getAccessToken ? this.getAccessToken() : null;
    if (tokenNearExpiry(token) && this.onAuthExpired) await this.renewAuth();
    this.assertActive(lifetime);
    if (this.getAccessToken && !this.getAccessToken()) throw new Error("Session expired. Please sign in again.");
  }

  private async ensureSocketSynced(): Promise<void> {
    const token = this.getAccessToken ? this.getAccessToken() : null;
    if (this.socket && this.attachedToken !== token) await this.renewSocket();
  }

  private async prepareCommand(lifetime: AbortController): Promise<void> {
    await this.ready;
    this.assertActive(lifetime);
    await this.ensureTokenFresh(lifetime);
    await this.ensureSocketSynced();
    await this.ready;
    this.assertActive(lifetime);
    if (this.socket && !this.socket.connected) throw new Error("Lobby is disconnected");
  }

  private renewAuth(): Promise<unknown> {
    if (this.tokenRenewal) return this.tokenRenewal;
    const renewal = Promise.resolve().then(() => this.onAuthExpired?.()).finally(() => {
      if (this.tokenRenewal === renewal) this.tokenRenewal = null;
    });
    this.tokenRenewal = renewal;
    return renewal;
  }

  private assertActive(lifetime: AbortController): void {
    if (this.lifetime !== lifetime || lifetime.signal.aborted) throw new Error("Lobby connection cancelled");
  }

  joinRoomChannel(roomId: string): void { this.socket?.emit("lobby:join_room", { roomId }); }
  leaveRoomChannel(roomId: string): void { this.socket?.emit("lobby:leave_room", { roomId }); }

  disconnect(): void {
    this.expiryRecovery = null;
    this.lifetime.abort();
    this.resetCurrentSocket();
    this.socket = undefined;
    this.callbacks = undefined;
    this.recovery = null;
  }
}
