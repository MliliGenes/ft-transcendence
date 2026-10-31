import { randomUUID } from "node:crypto";
import {
  isTeamPing,
  type TeamChatEntry,
  type TeamChatMessage,
  type TeamChatPing,
} from "arena-model";

export const MAX_HISTORY_PER_ROOM = 25;
export const MAX_TEXT_LENGTH = 500;
export const MSG_RATE_WINDOW_MS = 2000;
export const MSG_RATE_LIMIT = 5;
export const PING_RATE_WINDOW_MS = 3000;
export const PING_RATE_LIMIT = 3;

export interface TeamChatAck {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface TeamChatResult<T extends TeamChatEntry> {
  ack: TeamChatAck;
  entry?: T;
}

export interface TeamChatContext {
  active: boolean;
  roomId?: string;
  sideId?: string;
}

export type ResolveChatContextFn = (userId: string, matchId: string) => Promise<TeamChatContext>;

export interface AcceptMessageInput {
  connectionId: string;
  userId: string;
  matchId: string;
  sideId: string;
  roomId: string;
  text: unknown;
  clientMessageId?: unknown;
}

export interface AcceptPingInput {
  connectionId: string;
  userId: string;
  matchId: string;
  sideId: string;
  roomId: string;
  ping: unknown;
}

export interface TeamChatOptions {
  resolveContext: ResolveChatContextFn;
  clock?: () => number;
  generateId?: () => string;
  maxHistoryPerRoom?: number;
  maxTextLength?: number;
  msgRateWindowMs?: number;
  msgRateLimit?: number;
  pingRateWindowMs?: number;
  pingRateLimit?: number;
}

export class TeamChat {
  private readonly resolveContext: ResolveChatContextFn;
  private readonly clock: () => number;
  private readonly generateId: () => string;
  private readonly maxHistoryPerRoom: number;
  private readonly maxTextLength: number;
  private readonly msgRateWindowMs: number;
  private readonly msgRateLimit: number;
  private readonly pingRateWindowMs: number;
  private readonly pingRateLimit: number;

  private readonly history = new Map<string, TeamChatEntry[]>();
  private readonly clientMsgAcks = new Map<string, { id: string; timestamp: number }>();
  private readonly msgTimestamps = new Map<string, number[]>();
  private readonly pingTimestamps = new Map<string, number[]>();

  constructor(options: TeamChatOptions) {
    this.resolveContext = options.resolveContext;
    this.clock = options.clock ?? (() => Date.now());
    this.generateId = options.generateId ?? (() => randomUUID());
    this.maxHistoryPerRoom = options.maxHistoryPerRoom ?? MAX_HISTORY_PER_ROOM;
    this.maxTextLength = options.maxTextLength ?? MAX_TEXT_LENGTH;
    this.msgRateWindowMs = options.msgRateWindowMs ?? MSG_RATE_WINDOW_MS;
    this.msgRateLimit = options.msgRateLimit ?? MSG_RATE_LIMIT;
    this.pingRateWindowMs = options.pingRateWindowMs ?? PING_RATE_WINDOW_MS;
    this.pingRateLimit = options.pingRateLimit ?? PING_RATE_LIMIT;
  }

  private checkRateLimit(map: Map<string, number[]>, id: string, windowMs: number, maxAllowed: number): boolean {
    const now = this.clock();
    const timestamps = map.get(id) ?? [];
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length >= maxAllowed) return false;
    valid.push(now);
    map.set(id, valid);
    return true;
  }

  private recordHistory(roomId: string, entry: TeamChatEntry): void {
    let list = this.history.get(roomId);
    if (!list) {
      list = [];
      this.history.set(roomId, list);
    }
    list.push(entry);
    if (list.length > this.maxHistoryPerRoom) {
      list.shift();
    }
  }

  getRecentHistory(roomId: string): TeamChatEntry[] {
    return [...(this.history.get(roomId) ?? [])];
  }

  releaseConnection(connectionId: string): void {
    this.msgTimestamps.delete(connectionId);
    this.pingTimestamps.delete(connectionId);
  }

  private resolveAckKey(roomId: string, userId: string, rawClientMsgId?: unknown): string | undefined {
    const clientMessageId = typeof rawClientMsgId === "string" ? rawClientMsgId.trim().slice(0, 64) : undefined;
    return clientMessageId ? `${roomId}:${userId}:${clientMessageId}` : undefined;
  }

  private rememberAck(ackKey: string | undefined, id: string, timestamp: number): void {
    if (!ackKey) return;
    this.clientMsgAcks.set(ackKey, { id, timestamp });
    if (this.clientMsgAcks.size > 200) {
      const oldest = this.clientMsgAcks.keys().next().value;
      if (oldest) this.clientMsgAcks.delete(oldest);
    }
  }

  private validateMessageText(text: unknown): { ok: true; text: string } | { ok: false; error: string } {
    if (typeof text !== "string") {
      return { ok: false, error: "invalid message payload" };
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return { ok: false, error: "empty message" };
    }
    if (trimmed.length > this.maxTextLength) {
      return { ok: false, error: `message exceeds ${this.maxTextLength} characters` };
    }
    return { ok: true, text: trimmed };
  }

  private async verifyActiveContext(userId: string, matchId: string, disabledReason: string): Promise<string | undefined> {
    try {
      const context = await this.resolveContext(userId, matchId);
      if (!context.active) return disabledReason;
      return undefined;
    } catch {
      return "match unavailable";
    }
  }

  async acceptMessage(input: AcceptMessageInput): Promise<TeamChatResult<TeamChatMessage>> {
    const { connectionId, userId, matchId, sideId, roomId, text, clientMessageId: rawClientMsgId } = input;
    const ackKey = this.resolveAckKey(roomId, userId, rawClientMsgId);

    // Check duplicate retry before rate limiting so retries don't consume rate tokens
    if (ackKey && this.clientMsgAcks.has(ackKey)) {
      return { ack: { ok: true, id: this.clientMsgAcks.get(ackKey)!.id } };
    }

    if (!this.checkRateLimit(this.msgTimestamps, connectionId, this.msgRateWindowMs, this.msgRateLimit)) {
      return { ack: { ok: false, error: "rate limit exceeded: too many messages" } };
    }

    const inactiveError = await this.verifyActiveContext(userId, matchId, "chat is disabled after match complete");
    if (inactiveError) return { ack: { ok: false, error: inactiveError } };

    const textValidation = this.validateMessageText(text);
    if (!textValidation.ok) return { ack: { ok: false, error: textValidation.error } };

    // Re-check after async context resolution to protect against concurrent duplicate retries
    if (ackKey && this.clientMsgAcks.has(ackKey)) {
      return { ack: { ok: true, id: this.clientMsgAcks.get(ackKey)!.id } };
    }

    const msg: TeamChatMessage = {
      id: this.generateId(),
      matchId,
      sideId,
      senderUserId: userId,
      text: textValidation.text,
      timestamp: this.clock(),
      type: "text",
    };

    this.rememberAck(ackKey, msg.id, msg.timestamp);
    this.recordHistory(roomId, msg);
    return { ack: { ok: true, id: msg.id }, entry: msg };
  }

  async acceptPing(input: AcceptPingInput): Promise<TeamChatResult<TeamChatPing>> {
    const { connectionId, userId, matchId, sideId, roomId, ping } = input;

    if (!this.checkRateLimit(this.pingTimestamps, connectionId, this.pingRateWindowMs, this.pingRateLimit)) {
      return { ack: { ok: false, error: "rate limit exceeded: too many pings" } };
    }

    const inactiveError = await this.verifyActiveContext(userId, matchId, "match is complete; pings disabled");
    if (inactiveError) return { ack: { ok: false, error: inactiveError } };

    if (!isTeamPing(ping)) {
      return { ack: { ok: false, error: "invalid ping type" } };
    }

    const pingMsg: TeamChatPing = {
      id: this.generateId(),
      matchId,
      sideId,
      senderUserId: userId,
      ping,
      timestamp: this.clock(),
      type: "ping",
    };

    this.recordHistory(roomId, pingMsg);
    return { ack: { ok: true, id: pingMsg.id }, entry: pingMsg };
  }
}
