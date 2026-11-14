import { describe, expect, it } from 'vitest';
import { parseDeletedUserId } from './user-events.consumer.js';

describe('user deletion event parser', () => {
  it('accepts only a bounded, timestamped user.deleted event', () => {
    expect(
      parseDeletedUserId({
        eventId: 'event-1',
        eventType: 'user.deleted',
        version: '2026-11-10T00:00:00.000Z',
        occurredAt: '2026-11-10T00:00:00.000Z',
        data: { userId: 'deleted-user' },
      }),
    ).toBe('deleted-user');

    expect(
      parseDeletedUserId({
        eventId: 'event-2',
        eventType: 'user.deleted',
        version: '2026-11-10T00:00:00.000Z',
        occurredAt: 'invalid-time',
        data: { userId: 'deleted-user' },
      }),
    ).toBeUndefined();
    expect(
      parseDeletedUserId({
        eventType: 'user.updated',
        data: { userId: 'deleted-user' },
      }),
    ).toBeUndefined();
  });
});
