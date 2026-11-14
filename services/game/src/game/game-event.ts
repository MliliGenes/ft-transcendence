/**
 * Authoritative game lifecycle events published on the `game.events` exchange.
 *
 * The contract is intentionally narrow: a match id, its mode, the participating
 * accounts and the public outcome. Source submissions, editor snapshots,
 * round problem bodies and hidden test data never appear here — Chat renders
 * these events as short notifications and must not learn anything else.
 *
 * The Chat service owns its own copy of this contract (chat-service/src/events/
 * game-event.ts) and validates every payload it receives, exactly like the
 * User service / Chat service `user.events` pair.
 */
export const GAME_EVENT_TYPES = {
  MATCH_STARTED: 'game.match.started',
  MATCH_ENDED: 'game.match.ended',
  CHALLENGE_CANCELLED: 'game.challenge.cancelled',
} as const;

export type GameEventType =
  (typeof GAME_EVENT_TYPES)[keyof typeof GAME_EVENT_TYPES];

export type GameMatchMode = '1v1' | '2v2';

export interface GameEventParticipant {
  userId: string;
  sideId: string;
}

export interface GameEventBase {
  eventId: string;
  eventType: GameEventType;
  occurredAt: string;
}

export interface MatchStartedData {
  matchId: string;
  mode: GameMatchMode;
  /** Private-room invite code the match was started from; null for queue matches. */
  roomCode: string | null;
  participants: GameEventParticipant[];
}

export interface MatchEndedParticipant extends GameEventParticipant {
  outcome: 'win' | 'loss' | 'draw';
  /** Public total for this participant's side. Never a hidden test result. */
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
  /** Accounts that were in the room when the challenge was cancelled. */
  participantUserIds: string[];
}

export type GameEvent =
  | (GameEventBase & {
      eventType: typeof GAME_EVENT_TYPES.MATCH_STARTED;
      data: MatchStartedData;
    })
  | (GameEventBase & {
      eventType: typeof GAME_EVENT_TYPES.MATCH_ENDED;
      data: MatchEndedData;
    })
  | (GameEventBase & {
      eventType: typeof GAME_EVENT_TYPES.CHALLENGE_CANCELLED;
      data: ChallengeCancelledData;
    });

export function isGameEventType(value: unknown): value is GameEventType {
  return (
    value === GAME_EVENT_TYPES.MATCH_STARTED ||
    value === GAME_EVENT_TYPES.MATCH_ENDED ||
    value === GAME_EVENT_TYPES.CHALLENGE_CANCELLED
  );
}
