import type { MatchMode } from "arena-model";
import type { MatchRecord } from "../records.js";
import {
  type ILobbyStore,
  type LobbySideId,
  type PrivateRoom,
  type PrivateRoomMember,
  type QueueEntry,
  type RoomWithMembers,
  LobbyError,
  selectProblems,
} from "./lobby-types.js";
import { RateLimitedError } from "../engine.js";

export type CreateMatchCallback = (
  input: {
    mode: MatchMode;
    participants: Array<{ userId: string; sideId: string }>;
    problemVersionIds: string[];
  },
  save?: (match: MatchRecord) => Promise<void>,
) => Promise<string>;

export type LobbyEvent = "lobby.roomUpdated" | "lobby.matchFound" | "lobby.queueMatched";

export type LobbyEventListener = (event: LobbyEvent, payload: unknown) => void;

export interface LobbyOptions {
  store: ILobbyStore;
  createMatch: CreateMatchCallback;
  availableProblems?: string[];
  clock?: () => number;
  rateLimitWindowMs?: number;
  maxActionsPerWindow?: number;
}

export class Lobby {
  private readonly store: ILobbyStore;
  private readonly createMatch: CreateMatchCallback;
  private readonly availableProblems: string[];
  private readonly clock: () => number;
  private readonly rateLimitWindowMs: number;
  private readonly maxActionsPerWindow: number;
  private readonly listeners = new Set<LobbyEventListener>();
  private readonly userActionTimes = new Map<string, number[]>();

  constructor(options: LobbyOptions) {
    this.store = options.store;
    this.createMatch = options.createMatch;
    this.availableProblems = options.availableProblems ?? ["even-ledger", "double-it"];
    this.clock = options.clock ?? (() => Date.now());
    this.rateLimitWindowMs = options.rateLimitWindowMs ?? 10000;
    this.maxActionsPerWindow = options.maxActionsPerWindow ?? 15;
  }

  on(listener: LobbyEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: LobbyEvent, payload: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, payload);
      } catch (error) {
        console.error(`[lobby] live hint listener failed for ${event}:`, error);
      }
    }
  }

  private checkRateLimit(userId: string): void {
    const now = this.clock();
    let list = this.userActionTimes.get(userId);
    if (!list) {
      list = [];
      this.userActionTimes.set(userId, list);
    }
    const recent = list.filter((t) => now - t < this.rateLimitWindowMs);
    if (recent.length >= this.maxActionsPerWindow) {
      throw new RateLimitedError("too many lobby requests; please slow down");
    }
    recent.push(now);
    this.userActionTimes.set(userId, recent);
  }

  async joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry> {
    this.checkRateLimit(userId);
    const entry = await this.store.joinQueue(userId, mode);
    try {
      await this.triggerMatchmaking(mode);
    } catch (error) {
      console.error("[lobby] failed to trigger matchmaking after joinQueue:", error);
    }
    try {
      return (await this.store.queueStatus(userId)) ?? entry;
    } catch (error) {
      console.error("[lobby] failed to refresh queue status after joinQueue:", error);
      return entry;
    }
  }

  async cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    this.checkRateLimit(userId);
    return this.store.cancelQueue(userId);
  }

  async queueStatus(userId: string): Promise<QueueEntry | null> {
    return this.store.queueStatus(userId);
  }

  async triggerMatchmaking(mode: MatchMode): Promise<{ matchId: string; entries: QueueEntry[] } | null> {
    const problems = selectProblems(this.availableProblems, 3);
    const result = await this.store.tryMatch(mode, problems, this.createMatch);
    if (result) {
      try {
        this.emit("lobby.queueMatched", {
          matchId: result.matchId,
          userIds: result.entries.map((e) => e.userId),
        });
      } catch (error) {
        console.error("[lobby] failed to broadcast queueMatched hint:", error);
      }
    }
    return result;
  }

  async createPrivateRoom(userId: string, mode: MatchMode): Promise<RoomWithMembers> {
    this.checkRateLimit(userId);
    return this.store.createPrivateRoom(userId, mode);
  }

  async joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }> {
    this.checkRateLimit(userId);
    const res = await this.store.joinPrivateRoom(userId, inviteCode);
    try {
      this.emit("lobby.roomUpdated", {
        roomId: res.room.id,
        room: res.room,
        members: res.members,
        audienceUserIds: res.members.map((m) => m.userId),
      });
    } catch (error) {
      console.error("[lobby] failed to broadcast room update after joinPrivateRoom:", error);
    }
    return res;
  }

  async leavePrivateRoom(userId: string, roomId: string): Promise<{ left: boolean; closed: boolean }> {
    this.checkRateLimit(userId);
    const res = await this.store.leavePrivateRoom(userId, roomId);
    if (res.left && res.room && res.members) {
      try {
        this.emit("lobby.roomUpdated", {
          roomId,
          room: res.room,
          members: res.members,
          audienceUserIds: res.audienceUserIds,
        });
      } catch (error) {
        console.error("[lobby] failed to broadcast room update after leavePrivateRoom:", error);
      }
    }
    return { left: res.left, closed: res.closed };
  }

  async setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    this.checkRateLimit(userId);
    const res = await this.store.setRoomMemberSide(userId, roomId, sideId);
    try {
      this.emit("lobby.roomUpdated", {
        roomId,
        room: res.room,
        members: res.members,
        audienceUserIds: res.members.map((m) => m.userId),
      });
    } catch (error) {
      console.error("[lobby] failed to broadcast room update after setRoomMemberSide:", error);
    }
    return res;
  }

  async setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers> {
    this.checkRateLimit(userId);
    const res = await this.store.setRoomMemberReady(userId, roomId, ready);
    try {
      this.emit("lobby.roomUpdated", {
        roomId,
        room: res.room,
        members: res.members,
        audienceUserIds: res.members.map((m) => m.userId),
      });
    } catch (error) {
      console.error("[lobby] failed to broadcast room update after setRoomMemberReady:", error);
    }
    return res;
  }

  async startPrivateRoom(userId: string, roomId: string): Promise<{ matchId: string }> {
    this.checkRateLimit(userId);
    const problems = selectProblems(this.availableProblems, 3);
    const res = await this.store.startPrivateRoom(userId, roomId, problems, this.createMatch);
    try {
      this.emit("lobby.matchFound", {
        roomId,
        matchId: res.matchId,
        userIds: res.userIds,
      });
    } catch (error) {
      console.error("[lobby] failed to broadcast matchFound hint after startPrivateRoom:", error);
    }
    return { matchId: res.matchId };
  }

  async getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null> {
    return this.store.getRoomWithMembers(roomId);
  }

  async getRoomByCode(code: string): Promise<RoomWithMembers | null> {
    return this.store.getRoomByCode(code);
  }

  async userActiveRoom(userId: string): Promise<RoomWithMembers | null> {
    return this.store.userActiveRoom(userId);
  }

  async roomForMember(userId: string, roomId: string): Promise<RoomWithMembers> {
    const result = await this.store.getRoomWithMembers(roomId);
    if (!result) throw new LobbyError("room not found", 404);
    if (!result.members.some((member) => member.userId === userId)) {
      throw new LobbyError("not a member of this room", 403);
    }
    return result;
  }
}
