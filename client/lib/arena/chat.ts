import { io, type Socket } from 'socket.io-client';
import type { ArenaConnectionOptions } from './types';

export const TEAM_PINGS = [
  'CHECK_EDGE_CASE',
  'RUN_THIS_INPUT',
  'REVIEW_COMPLEXITY',
  'READY',
] as const;

export type TeamPing = (typeof TEAM_PINGS)[number];

export const TEAM_PING_LABELS: Record<TeamPing, string> = {
  CHECK_EDGE_CASE: 'Check edge case',
  RUN_THIS_INPUT: 'Run this input',
  REVIEW_COMPLEXITY: 'Review complexity',
  READY: 'Ready?',
};

export interface TeamChatMessage {
  id: string;
  matchId: string;
  sideId: string;
  senderUserId: string;
  text: string;
  timestamp: number;
  type: 'text';
}

export interface TeamChatPing {
  id: string;
  matchId: string;
  sideId: string;
  senderUserId: string;
  ping: TeamPing;
  timestamp: number;
  type: 'ping';
}

export type TeamChatEntry = TeamChatMessage | TeamChatPing;

export interface TeamChatAuthContext {
  matchId: string;
  sideId: string;
  userId: string;
  displayName: string;
  roomId: string;
  active: boolean;
  phase: string;
  isMateOnline: boolean;
}

export type TeamChatClientOptions = ArenaConnectionOptions;

export type TeamChatStatus =
  'connecting' | 'connected' | 'disconnected' | 'error';

export class TeamChatClient {
  private socket: Socket | null = null;
  private entries: TeamChatEntry[] = [];
  private seenIds = new Set<string>();
  private state: TeamChatStatus = 'connecting';
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

  replaceHistory(entries: TeamChatEntry[]): void {
    this.entries = [...entries];
    this.seenIds = new Set(entries.map((entry) => entry.id));
    this.notify();
  }

  setAuthorizedForTest(ctx: TeamChatAuthContext): void {
    this.authContext = ctx;
    this.state = 'connected';
    this.notify();
  }

  connect(): Promise<void> {
    if (this.socket && this.socket.connected) return Promise.resolve();

    this.state = 'connecting';
    this.lastError = null;
    this.notify();

    const socketPath =
      this.options.socketPath ??
      (this.options.baseUrl.includes('/api/game')
        ? '/api/game/socket.io'
        : '/socket.io');
    const auth: Record<string, unknown> = {
      userId: this.options.userId,
      matchId: this.options.matchId,
    };
    if (this.options.token) auth.token = this.options.token;

    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      this.socket = io(`${this.options.baseUrl}/chat`, {
        path: socketPath,
        auth,
        query: { userId: this.options.userId, matchId: this.options.matchId },
        transports: ['websocket', 'polling'],
        forceNew: true,
      });

      this.socket.once('authorized', (ctx: TeamChatAuthContext) => {
        this.authContext = ctx;
        this.state = 'connected';
        this.lastError = null;
        if (!resolved) {
          resolved = true;
          resolve();
        }
        this.notify();
      });

      this.socket.on('history', (history: TeamChatEntry[]) => {
        if (Array.isArray(history)) {
          this.replaceHistory(history);
        }
      });

      this.socket.on('message', (msg: TeamChatMessage) => {
        this.applyIncomingEntry(msg);
      });

      this.socket.on('ping', (ping: TeamChatPing) => {
        this.applyIncomingEntry(ping);
      });

      this.socket.on('connect_error', (err: Error) => {
        this.state = 'error';
        this.lastError = err.message || 'chat connection error';
        if (!resolved) {
          resolved = true;
          reject(err);
        }
        this.notify();
      });

      this.socket.on('disconnect', () => {
        this.state = 'disconnected';
        this.notify();
      });
    });
  }

  async sendMessage(text: string, clientMessageId?: string): Promise<string> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Chat is disconnected');
    }
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Empty message');

    return new Promise<string>((resolve, reject) => {
      this.socket!.emit(
        'message',
        { text: trimmed, clientMessageId },
        (res: { ok: boolean; id?: string; error?: string }) => {
          if (res && res.ok && res.id) {
            resolve(res.id);
          } else {
            reject(new Error(res?.error ?? 'failed to send message'));
          }
        },
      );
    });
  }

  async sendPing(ping: TeamPing): Promise<string> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Chat is disconnected');
    }

    return new Promise<string>((resolve, reject) => {
      this.socket!.emit(
        'ping',
        { ping },
        (res: { ok: boolean; id?: string; error?: string }) => {
          if (res && res.ok && res.id) {
            resolve(res.id);
          } else {
            reject(new Error(res?.error ?? 'failed to send ping'));
          }
        },
      );
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.state = 'disconnected';
    this.notify();
  }
}
