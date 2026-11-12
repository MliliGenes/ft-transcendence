import { isUUID } from 'class-validator';
import { isRoomCode } from '../chat/game-notification-format.js';

/**
 * Chat's copy of the Game service lifecycle contract.
 *
 * The Game service owns match state and publishes authoritative events on the
 * `game.events` exchange. Chat validates every payload before acting on it:
 * an event that does not match this contract is discarded, never guessed at.
 */
export const GAME_EVENT_TYPES = {
  MATCH_STARTED: 'game.match.started',
  MATCH_ENDED: 'game.match.ended',
  CHALLENGE_CANCELLED: 'game.challenge.cancelled',
} as const;

export type GameEventType =
  (typeof GAME_EVENT_TYPES)[keyof typeof GAME_EVENT_TYPES];

export type GameMatchMode = '1v1' | '2v2';

export interface GameEventBase {
  eventId: string;
  eventType: GameEventType;
  occurredAt: string;
}

export interface GameEventParticipant {
  userId: string;
  sideId: string;
}

export interface MatchStartedData {
  matchId: string;
  mode: GameMatchMode;
  roomCode: string | null;
  participants: GameEventParticipant[];
}

export interface MatchEndedParticipant extends GameEventParticipant {
  outcome: 'win' | 'loss' | 'draw';
  score: number;
}

export interface MatchEndedData {
  matchId: string;
  mode: GameMatchMode;
  participants: MatchEndedParticipant[];
  forfeit: {
    winnerSideId: string;
    loserSideId: string;
    reason: 'leave' | 'grace-expired' | 'surrender';
  } | null;
  endedBecause: 'completed' | 'deadline' | 'forfeit';
}

export interface ChallengeCancelledData {
  roomCode: string;
  reason: 'room-closed' | 'expired';
  participantUserIds: string[];
}

export type GameEvent =
  | (GameEventBase & { eventType: typeof GAME_EVENT_TYPES.MATCH_STARTED; data: MatchStartedData })
  | (GameEventBase & { eventType: typeof GAME_EVENT_TYPES.MATCH_ENDED; data: MatchEndedData })
  | (GameEventBase & { eventType: typeof GAME_EVENT_TYPES.CHALLENGE_CANCELLED; data: ChallengeCancelledData });

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

function isMatchMode(value: unknown): value is GameMatchMode {
  return value === '1v1' || value === '2v2';
}

function parseParticipants(value: unknown): GameEventParticipant[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const participants: GameEventParticipant[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) return null;
    const { userId, sideId } = entry;
    if (!isIdentifier(userId) || !isIdentifier(sideId)) return null;
    participants.push({ userId, sideId });
  }
  return participants;
}

function parseMatchStarted(data: Record<string, unknown>): MatchStartedData | null {
  const { matchId, mode, roomCode } = data;
  if (!isIdentifier(matchId) || !isMatchMode(mode)) return null;
  if (!(roomCode === null || isRoomCode(roomCode))) return null;
  const participants = parseParticipants(data.participants);
  if (!participants) return null;
  return { matchId, mode, roomCode, participants };
}

function parseMatchEnded(data: Record<string, unknown>): MatchEndedData | null {
  const { matchId, mode } = data;
  if (!isIdentifier(matchId) || !isMatchMode(mode)) return null;
  if (!Array.isArray(data.participants) || data.participants.length === 0) {
    return null;
  }
  const participants: MatchEndedParticipant[] = [];
  for (const entry of data.participants) {
    if (!isPlainObject(entry)) return null;
    const { userId, sideId, outcome, score } = entry;
    if (!isIdentifier(userId) || !isIdentifier(sideId)) return null;
    if (outcome !== 'win' && outcome !== 'loss' && outcome !== 'draw') return null;
    if (typeof score !== 'number' || !Number.isFinite(score)) return null;
    participants.push({ userId, sideId, outcome, score });
  }

  let forfeit: MatchEndedData['forfeit'] = null;
  if (data.forfeit !== null && data.forfeit !== undefined) {
    if (!isPlainObject(data.forfeit)) return null;
    const { winnerSideId, loserSideId, reason } = data.forfeit;
    if (!isIdentifier(winnerSideId) || !isIdentifier(loserSideId)) return null;
    if (reason !== 'leave' && reason !== 'grace-expired' && reason !== 'surrender') return null;
    forfeit = { winnerSideId, loserSideId, reason };
  }

  const { endedBecause } = data;
  if (
    endedBecause !== 'completed' &&
    endedBecause !== 'deadline' &&
    endedBecause !== 'forfeit'
  ) {
    return null;
  }

  return { matchId, mode, participants, forfeit, endedBecause };
}

function parseChallengeCancelled(
  data: Record<string, unknown>,
): ChallengeCancelledData | null {
  const { roomCode, reason } = data;
  if (!isRoomCode(roomCode)) return null;
  if (reason !== 'room-closed' && reason !== 'expired') return null;
  if (
    !Array.isArray(data.participantUserIds) ||
    !data.participantUserIds.every(isIdentifier)
  ) {
    return null;
  }
  return {
    roomCode,
    reason,
    participantUserIds: data.participantUserIds.map(String),
  };
}

/** Validate one broker payload. Returns null when the event is not usable. */
export function parseGameEvent(value: unknown): GameEvent | null {
  if (!isPlainObject(value)) return null;
  const { eventId, eventType, occurredAt } = value;
  if (typeof eventId !== 'string' || !isUUID(eventId, '4')) return null;
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) {
    return null;
  }
  if (!isPlainObject(value.data)) return null;

  const base = { eventId, occurredAt };

  if (eventType === GAME_EVENT_TYPES.MATCH_STARTED) {
    const data = parseMatchStarted(value.data);
    return data ? { ...base, eventType: GAME_EVENT_TYPES.MATCH_STARTED, data } : null;
  }
  if (eventType === GAME_EVENT_TYPES.MATCH_ENDED) {
    const data = parseMatchEnded(value.data);
    return data ? { ...base, eventType: GAME_EVENT_TYPES.MATCH_ENDED, data } : null;
  }
  if (eventType === GAME_EVENT_TYPES.CHALLENGE_CANCELLED) {
    const data = parseChallengeCancelled(value.data);
    return data
      ? { ...base, eventType: GAME_EVENT_TYPES.CHALLENGE_CANCELLED, data }
      : null;
  }
  return null;
}
