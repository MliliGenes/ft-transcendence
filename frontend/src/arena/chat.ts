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
}

export type TeamChatStatus = "connecting" | "connected" | "disconnected" | "error";

class UnconfirmedChatError extends Error {}

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

  connect(): Promise<void> {
    if (this.connecting) return this.connecting;
    if (this.state === "connected" && this.socket?.connected) return Promise.resolve();
    this.stopSocket();
    const lifetime = new AbortController();
    this.lifetime = lifetime;
    this.state = "connecting";
    this.lastError = null;
    this.notify();

    const socket = io(`${this.options.baseUrl}/chat`, {
      auth: { userId: this.options.userId, matchId: this.options.matchId },
      transports: ["websocket"],
      forceNew: true,
      autoConnect: false,
    });
    this.socket = socket;
    const active = () => this.socket === socket && !lifetime.signal.aborted;
    socket.on("connect", () => {
      if (!active()) return;
      this.state = "connecting";
      this.notify();
    });
    // Authorization is a fresh baseline on every reconnect, not just the first join.
    socket.on("authorized", (ctx: TeamChatAuthContext) => {
      if (!active()) return;
      this.authContext = ctx;
      this.state = "connected";
      this.lastError = null;
      this.notify();
    });
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
    socket.on("connect_error", (error: Error) => {
      if (!active()) return;
      this.state = "error";
      this.lastError = error.message || "Chat connection failed";
      this.notify();
    });
    socket.on("disconnect", () => {
      if (!active()) return;
      this.authContext = null;
      this.state = "disconnected";
      this.notify();
    });

    const wait = new Promise<void>((resolve, reject) => {
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
    const connecting = wait.catch((error: Error) => {
      if (active()) {
        this.stopSocket();
        this.state = "error";
        this.lastError = error.message;
        this.notify();
      }
      throw error;
    }).finally(() => {
      if (this.connecting === connecting) this.connecting = null;
    });
    this.connecting = connecting;
    socket.connect();
    return connecting;
  }

  sendMessage(text: string, clientMessageId?: string): Promise<string> {
    if (this.state !== "connected" || !this.socket?.connected) return Promise.reject(new Error("Chat is disconnected"));
    const trimmed = text.trim();
    if (!trimmed) return Promise.reject(new Error("Empty message"));
    const key = clientMessageId ? `id:${clientMessageId}` : `text:${trimmed}`;
    let message = this.unconfirmed.get(key);
    if (message && message.text !== trimmed) return Promise.reject(new Error("Message identifier already used"));
    if (message?.pending) return message.pending;
    if (!message) {
      // Keep uncertain delivery identities bounded without forgetting a retry key.
      if (this.unconfirmed.size >= 100) return Promise.reject(new Error("Retry an unconfirmed message before sending more"));
      const id = clientMessageId ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      message = { text: trimmed, id };
      this.unconfirmed.set(key, message);
    }
    const pending = this.send("message", { text: trimmed, clientMessageId: message.id }).then(
      (id) => {
        this.unconfirmed.delete(key);
        return id;
      },
      (error: Error) => {
        if (!(error instanceof UnconfirmedChatError)) this.unconfirmed.delete(key);
        throw error;
      },
    ).finally(() => {
      if (this.unconfirmed.get(key) === message) message.pending = undefined;
    });
    message.pending = pending;
    return pending;
  }

  sendPing(ping: TeamPing): Promise<string> {
    return this.send("ping", { ping });
  }

  private send(event: "message" | "ping", payload: unknown): Promise<string> {
    const socket = this.socket;
    const signal = this.lifetime?.signal;
    if (!socket?.connected || this.state !== "connected" || !signal || signal.aborted) {
      return Promise.reject(new Error("Chat is disconnected"));
    }
    return new Promise<string>((resolve, reject) => {
      const uncertain = () => new UnconfirmedChatError(
        event === "message" ? "Message confirmation was lost. Retry to confirm delivery." : "Ping confirmation was lost. Please try again.",
      );
      const cancelled = () => reject(uncertain());
      signal.addEventListener("abort", cancelled, { once: true });
      socket.timeout(5_000).emit(event, payload, (error: Error | null, res?: { ok: boolean; id?: string; error?: string }) => {
        signal.removeEventListener("abort", cancelled);
        if (error || signal.aborted || this.socket !== socket) reject(uncertain());
        else if (res?.ok && res.id) resolve(res.id);
        else reject(new Error(res?.error ?? `Failed to send ${event}`));
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

  disconnect(): void {
    this.stopSocket();
    this.authContext = null;
    this.state = "disconnected";
    this.notify();
  }
}
