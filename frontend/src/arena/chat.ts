import { io, type Socket } from "socket.io-client";
import {
  type TeamChatAuthContext,
  type TeamChatEntry,
  type TeamChatMessage,
  type TeamChatPing,
  type TeamPing,
  TEAM_PINGS,
  TEAM_PING_LABELS,
} from "arena-model";

export type { TeamChatEntry, TeamChatMessage, TeamChatPing, TeamPing };
export { TEAM_PINGS, TEAM_PING_LABELS };

export interface TeamChatClientOptions {
  baseUrl: string;
  userId: string;
  matchId: string;
  getAccessToken?: () => string | null;
  onAuthExpired?: () => Promise<unknown>;
}

export type TeamChatStatus = "connecting" | "connected" | "disconnected" | "error";

class UnconfirmedChatError extends Error {}

function generateClientMessageId(clientMessageId?: string): string {
  if (clientMessageId) return clientMessageId;
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function unconfirmedError(event: "message" | "ping"): UnconfirmedChatError {
  const message = event === "message"
    ? "Message confirmation was lost. Retry to confirm delivery."
    : "Ping confirmation was lost. Please try again.";
  return new UnconfirmedChatError(message);
}

/**
 * TeamChatClient (ticket 16):
 * Connects to the /chat namespace on the game server.
 * Manages team-scoped text messages, quick pings, reconnect idempotency,
 * and message deduplication.
 */
export class TeamChatClient {
  private socket: Socket | null = null;
  private lifetime: AbortController | null = null;
  private connecting: Promise<void> | null = null;
  private readonly unconfirmed = new Map<string, { text: string; id: string; pending?: Promise<string> }>();
  private entries: TeamChatEntry[] = [];
  private seenIds = new Set<string>();
  private state: TeamChatStatus = "connecting";
  private lastError: string | null = null;
  private authContext: TeamChatAuthContext | null = null;
  private readonly subscribers = new Set<() => void>();

  constructor(readonly options: TeamChatClientOptions) {}

  get status(): TeamChatStatus {
    return this.state;
  }

  get error(): string | null {
    return this.lastError;
  }

  get context(): TeamChatAuthContext | null {
    return this.authContext;
  }

  getMessages(): TeamChatEntry[] {
    return [...this.entries];
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    for (const sub of this.subscribers) {
      try {
        sub();
      } catch {
        // Safe dispatch
      }
    }
  }

  applyIncomingEntry(entry: TeamChatEntry): void {
    if (this.seenIds.has(entry.id)) return;
    this.seenIds.add(entry.id);
    this.entries.push(entry);
    this.notify();
  }

  /** @internal test helper */
  setAuthorizedForTest(ctx: TeamChatAuthContext): void {
    this.authContext = ctx;
    this.state = "connected";
    this.notify();
  }

  private isSocketActive(socket: Socket, lifetime: AbortController): boolean {
    return this.socket === socket && !lifetime.signal.aborted;
  }

  private createSocket(): Socket {
    const token = this.options.getAccessToken?.();
    const auth = token
      ? { accessToken: token, matchId: this.options.matchId }
      : { userId: this.options.userId, matchId: this.options.matchId };
    return io(`${this.options.baseUrl}/chat`, {
      auth,
      transports: ["websocket"],
      forceNew: true,
      autoConnect: false,
    });
  }

  private bindSocketListeners(socket: Socket, lifetime: AbortController): void {
    const active = () => this.isSocketActive(socket, lifetime);
    socket.on("connect", () => {
      if (active()) {
        this.state = "connecting";
        this.notify();
      }
    });
    socket.on("authorized", (ctx: TeamChatAuthContext) => {
      if (active()) {
        this.authContext = ctx;
        this.state = "connected";
        this.lastError = null;
        this.notify();
      }
    });
    this.bindIncomingEntryListeners(socket, active);
    this.bindSocketErrorListeners(socket, active);
  }

  private bindIncomingEntryListeners(socket: Socket, active: () => boolean): void {
    socket.on("history", (history: TeamChatEntry[]) => {
      if (active() && Array.isArray(history)) {
        for (const item of history) this.applyIncomingEntry(item);
      }
    });
    socket.on("message", (msg: TeamChatMessage) => {
      if (active()) this.applyIncomingEntry(msg);
    });
    socket.on("ping", (ping: TeamChatPing) => {
      if (active()) this.applyIncomingEntry(ping);
    });
  }

  private bindSocketErrorListeners(socket: Socket, active: () => boolean): void {
    socket.on("connect_error", (error: Error) => {
      if (active()) {
        this.state = "error";
        this.lastError = error.message || "Chat connection failed";
        this.notify();
      }
    });
    socket.on("disconnect", () => {
      if (active()) {
        this.authContext = null;
        this.state = "disconnected";
        this.notify();
      }
    });
  }

  private awaitAuthorization(socket: Socket, lifetime: AbortController): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        socket.off("authorized", authorized);
        socket.off("connect_error", failed);
        socket.off("disconnect", denied);
        lifetime.signal.removeEventListener("abort", cancelled);
        if (error) reject(error);
        else resolve();
      };
      const authorized = () => finish();
      const failed = (error: Error) => {
        if (!socket.active) finish(error);
      };
      const denied = () => finish(new Error("Chat room refused"));
      const cancelled = () => finish(new Error("Chat connection cancelled"));
      const timer = setTimeout(() => finish(new Error("Chat connection timed out")), 10_000);

      socket.once("authorized", authorized);
      socket.on("connect_error", failed);
      socket.once("disconnect", denied);
      lifetime.signal.addEventListener("abort", cancelled, { once: true });
    });
  }

  connect(): Promise<void> {
    if (this.connecting) return this.connecting;
    if (this.state === "connected" && this.socket?.connected) return Promise.resolve();
    this.stopSocket();
    const lifetime = new AbortController();
    this.lifetime = lifetime;
    this.state = "connecting";
    this.lastError = null;
    this.notify();

    const socket = this.createSocket();
    this.socket = socket;
    this.bindSocketListeners(socket, lifetime);

    const connecting = this.awaitAuthorization(socket, lifetime)
      .catch((error: Error) => {
        if (this.isSocketActive(socket, lifetime)) {
          this.stopSocket();
          this.state = "error";
          this.lastError = error.message;
          this.notify();
        }
        throw error;
      })
      .finally(() => {
        if (this.connecting === connecting) this.connecting = null;
      });

    this.connecting = connecting;
    socket.connect();
    return connecting;
  }

  private getOrCreateUnconfirmed(
    key: string,
    trimmed: string,
    clientMessageId?: string,
  ): { text: string; id: string; pending?: Promise<string> } {
    const existing = this.unconfirmed.get(key);
    if (existing) {
      if (existing.text !== trimmed) throw new Error("Message identifier already used");
      return existing;
    }
    // Keep uncertain delivery identities bounded without forgetting a retry key.
    if (this.unconfirmed.size >= 100) {
      throw new Error("Retry an unconfirmed message before sending more");
    }
    const record = { text: trimmed, id: generateClientMessageId(clientMessageId) };
    this.unconfirmed.set(key, record);
    return record;
  }

  private dispatchUnconfirmedMessage(
    key: string,
    record: { text: string; id: string; pending?: Promise<string> },
  ): Promise<string> {
    const pending = this.send("message", { text: record.text, clientMessageId: record.id })
      .then(
        (id) => {
          this.unconfirmed.delete(key);
          return id;
        },
        (error: Error) => {
          if (!(error instanceof UnconfirmedChatError)) this.unconfirmed.delete(key);
          throw error;
        },
      )
      .finally(() => {
        if (this.unconfirmed.get(key) === record) record.pending = undefined;
      });
    record.pending = pending;
    return pending;
  }

  sendMessage(text: string, clientMessageId?: string): Promise<string> {
    if (this.state !== "connected" || !this.socket?.connected) {
      return Promise.reject(new Error("Chat is disconnected"));
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return Promise.reject(new Error("Empty message"));
    }
    const key = clientMessageId ? `id:${clientMessageId}` : `text:${trimmed}`;
    try {
      const record = this.getOrCreateUnconfirmed(key, trimmed, clientMessageId);
      if (record.pending) return record.pending;
      return this.dispatchUnconfirmedMessage(key, record);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  sendPing(ping: TeamPing): Promise<string> {
    return this.send("ping", { ping });
  }

  private isSendable(socket: Socket | null, signal?: AbortSignal): boolean {
    if (!socket || !socket.connected) return false;
    if (this.state !== "connected") return false;
    if (!signal || signal.aborted) return false;
    return true;
  }

  private handleSendAck(
    event: "message" | "ping",
    socket: Socket,
    signal: AbortSignal,
    error: Error | null,
    res: { ok: boolean; id?: string; error?: string } | undefined,
    resolve: (id: string) => void,
    reject: (error: Error) => void,
  ): void {
    if (error || signal.aborted || this.socket !== socket) {
      reject(unconfirmedError(event));
      return;
    }
    if (res?.ok && res.id) {
      resolve(res.id);
      return;
    }
    reject(new Error(res?.error ?? `Failed to send ${event}`));
  }

  private send(event: "message" | "ping", payload: unknown): Promise<string> {
    const socket = this.socket;
    const signal = this.lifetime ? this.lifetime.signal : undefined;
    if (!this.isSendable(socket, signal) || !socket || !signal) {
      return Promise.reject(new Error("Chat is disconnected"));
    }
    return new Promise<string>((resolve, reject) => {
      const cancelled = () => reject(unconfirmedError(event));
      signal.addEventListener("abort", cancelled, { once: true });
      socket.timeout(5_000).emit(event, payload, (error: Error | null, res?: { ok: boolean; id?: string; error?: string }) => {
        signal.removeEventListener("abort", cancelled);
        this.handleSendAck(event, socket, signal, error, res, resolve, reject);
      });
    });
  }

  private stopSocket(): void {
    this.lifetime?.abort();
    this.lifetime = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connecting = null;
  }

  /**
   * Explicit renewal: a fresh socket on the same client — retry identities,
   * history, and dedup state are kept; the server re-sends the baseline.
   */
  renewSocket(): Promise<void> {
    this.stopSocket();
    return this.connect();
  }

  disconnect(): void {
    this.stopSocket();
    this.authContext = null;
    this.state = "disconnected";
    this.notify();
  }
}
