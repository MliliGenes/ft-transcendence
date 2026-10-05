import { randomBytes } from "node:crypto";
import type { MatchMode } from "arena-model";
import type { MatchRecord } from "../records.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type QueueStatus = "waiting" | "matched" | "cancelled";
export type PrivateRoomStatus = "open" | "matched" | "expired" | "closed";
export type LobbySideId = "left" | "right";

export interface QueueEntry {
  id: string;
  userId: string;
  mode: MatchMode;
  status: QueueStatus;
  joinedAt: number;
  matchedMatchId: string | null;
  cancelledAt: number | null;
}

export interface PrivateRoom {
  id: string;
  code: string;
  mode: MatchMode;
  ownerUserId: string;
  status: PrivateRoomStatus;
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

export interface LeavePrivateRoomResult {
  left: boolean;
  closed: boolean;
  room?: PrivateRoom;
  members?: PrivateRoomMember[];
  audienceUserIds?: string[];
}

export interface StartPrivateRoomResult {
  matchId: string;
  userIds: string[];
  room?: PrivateRoom;
  members?: PrivateRoomMember[];
}

// ─── Error helpers ──────────────────────────────────────────────────────────

export class LobbyError extends Error {
  constructor(
    message: string,
    readonly code: number = 400,
  ) {
    super(message);
    this.name = "LobbyError";
  }
}

// ─── Invite code ────────────────────────────────────────────────────────────

/** Six characters from a 32-character alphabet (30 bits of entropy). */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[bytes[i]! % chars.length];
  return code;
}

export function capacityFor(mode: MatchMode): number {
  return mode === "1v1" ? 2 : 4;
}

export function perSideCapacity(mode: MatchMode): number {
  return mode === "1v1" ? 1 : 2;
}

// ─── Problem selection ──────────────────────────────────────────────────────

/**
 * ponytail: server-owned problem selection — clients never choose.
 * Picks 3 problem version IDs from the available bank. Deterministic
 * when a seed is provided (tests), otherwise random shuffle.
 */
export function selectProblems(
  available: string[],
  count: number = 3,
  rng: () => number = Math.random,
): string[] {
  if (available.length === 0) throw new LobbyError("no problems in bank");
  const shuffled = [...available].sort(() => rng() - 0.5);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length]!);
  return out;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface ILobbyStore {
  ensureSchema(): Promise<void>;
  joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry>;
  cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }>;
  queueStatus(userId: string): Promise<QueueEntry | null>;
  tryMatch(
    mode: MatchMode,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<{ matchId: string; entries: QueueEntry[] } | null>;
  createPrivateRoom(userId: string, mode: MatchMode, expiryMs?: number): Promise<RoomWithMembers>;
  joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }>;
  leavePrivateRoom(userId: string, roomId: string): Promise<LeavePrivateRoomResult>;
  setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers>;
  setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers>;
  startPrivateRoom(
    userId: string,
    roomId: string,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<StartPrivateRoomResult>;
  getRoomByCode(code: string): Promise<RoomWithMembers | null>;
  getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null>;
  userActiveRoom(userId: string): Promise<RoomWithMembers | null>;
}
