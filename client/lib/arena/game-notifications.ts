/**
 * Parser for Code Arena lifecycle notifications.
 *
 * The Chat service writes these notifications as ordinary messages with a
 * fixed three-line shape, so the client can render them as a card without
 * asking the server for extra data. The server owns the format; this module
 * mirrors it (chat-service/src/chat/game-notification-format.ts).
 */
export const GAME_NOTIFICATION_HEADER = '🎮 Code Arena';

export const GAME_NOTIFICATION_TYPES = {
  MATCH_STARTED: 'match-started',
  MATCH_RESULT: 'match-result',
  CHALLENGE_CANCELLED: 'challenge-cancelled',
} as const;

export type GameNotificationType =
  (typeof GAME_NOTIFICATION_TYPES)[keyof typeof GAME_NOTIFICATION_TYPES];

export type GameNotification = {
  type: GameNotificationType;
  summary: string;
  matchId: string | null;
};

const TYPE_SEPARATOR = ' · ';
const MATCH_LINK = /^\[View match\]\(\/play\/match\/([0-9a-zA-Z-]{1,64})\)$/;

export function parseGameNotification(
  content: string | null | undefined,
): GameNotification | null {
  if (!content) return null;
  const lines = content.split('\n');
  if (lines[0] !== GAME_NOTIFICATION_HEADER) return null;
  const typeLine = lines[1] ?? '';
  const separator = typeLine.indexOf(TYPE_SEPARATOR);
  if (separator < 0) return null;
  const type = typeLine.slice(0, separator);
  if (
    type !== GAME_NOTIFICATION_TYPES.MATCH_STARTED &&
    type !== GAME_NOTIFICATION_TYPES.MATCH_RESULT &&
    type !== GAME_NOTIFICATION_TYPES.CHALLENGE_CANCELLED
  ) {
    return null;
  }
  const summary = typeLine.slice(separator + TYPE_SEPARATOR.length).trim();
  if (!summary) return null;
  const link = MATCH_LINK.exec(lines[2] ?? '');
  return { type, summary, matchId: link ? (link[1] as string) : null };
}

export function gameNotificationTitle(type: GameNotificationType): string {
  if (type === GAME_NOTIFICATION_TYPES.MATCH_STARTED) return 'Match started';
  if (type === GAME_NOTIFICATION_TYPES.MATCH_RESULT) return 'Match result';
  return 'Challenge cancelled';
}
