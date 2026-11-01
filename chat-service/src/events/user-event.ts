import { isUUID } from 'class-validator';

type UserProfileData = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type UserEvent =
  | {
      eventId: string;
      eventType: 'user.created' | 'user.updated';
      version: string;
      occurredAt: string;
      data: UserProfileData;
    }
  | {
      eventId: string;
      eventType: 'user.deleted';
      version: string;
      occurredAt: string;
      data: { userId: string };
    };

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function parseUserEvent(value: unknown): UserEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Record<string, unknown>;
  if (
    !isUUID(event.eventId, '4') ||
    !isDate(event.version) ||
    !isDate(event.occurredAt) ||
    !event.data ||
    typeof event.data !== 'object'
  )
    return null;

  const data = event.data as Record<string, unknown>;
  if (!isUUID(data.userId, '4')) return null;
  if (event.eventType === 'user.deleted') return event as UserEvent;
  if (
    (event.eventType !== 'user.created' && event.eventType !== 'user.updated') ||
    typeof data.username !== 'string' ||
    (data.displayName !== null && typeof data.displayName !== 'string') ||
    (data.avatarUrl !== null && typeof data.avatarUrl !== 'string')
  )
    return null;
  return event as UserEvent;
}
