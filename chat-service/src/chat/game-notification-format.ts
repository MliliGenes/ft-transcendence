/**
 * Canonical text format for Code Arena lifecycle notifications.
 *
 * Notifications are ordinary chat messages written by the system account, so
 * the format has to survive plain-text rendering while remaining unambiguous
 * for the client. The client parses the same shape (client/lib/arena/
 * game-notifications.ts); both sides are covered by tests.
 */
export const GAME_NOTIFICATION_HEADER = '🎮 Code Arena';

export const GAME_NOTIFICATION_TYPES = {
  MATCH_STARTED: 'match-started',
  MATCH_RESULT: 'match-result',
  CHALLENGE_CANCELLED: 'challenge-cancelled',
} as const;

export type GameNotificationType =
  (typeof GAME_NOTIFICATION_TYPES)[keyof typeof GAME_NOTIFICATION_TYPES];

/** Room codes are the six-character private-room invite codes. */
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function isRoomCode(value: unknown): value is string {
  return typeof value === 'string' && ROOM_CODE_PATTERN.test(value);
}

/** Keep a notification summary on one line so the format stays parseable. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function formatGameNotification(
  type: GameNotificationType,
  summary: string,
  matchId?: string | null,
): string {
  const lines = [GAME_NOTIFICATION_HEADER, `${type} · ${singleLine(summary)}`];
  if (matchId) lines.push(`[View match](/play/match/${matchId})`);
  return lines.join('\n');
}
