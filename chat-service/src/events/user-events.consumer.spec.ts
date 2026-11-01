import { describe, expect, it, vi } from 'vitest';
import { parseUserEvent, type UserEvent } from './user-event.js';
import { UserEventsConsumer } from './user-events.consumer.js';

const profileEvent: UserEvent = {
  eventId: '5ad6f29f-e5dd-41c8-9144-cf2634ed62df',
  eventType: 'user.updated',
  version: '2026-11-01T05:00:00.000Z',
  occurredAt: '2026-11-01T05:00:01.000Z',
  data: {
    userId: '4a13e0f8-8632-489a-b85a-552d886b41ea',
    username: 'saad',
    displayName: 'Saad',
    avatarUrl: null,
  },
};

describe('user event projection', () => {
  it('rejects malformed event contracts', () => {
    expect(parseUserEvent({ ...profileEvent, version: 'invalid' })).toBeNull();
    expect(parseUserEvent(profileEvent)).toEqual(profileEvent);
  });

  it('updates only an older projection and does not insert after an update', async () => {
    const chatUser = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn(),
    };
    const consumer = new UserEventsConsumer({} as never, {
      chatUser,
    } as never);

    await consumer.applyEvent(profileEvent);

    expect(chatUser.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: profileEvent.data.userId,
          sourceUpdatedAt: { lt: new Date(profileEvent.version) },
        },
      }),
    );
    expect(chatUser.createMany).not.toHaveBeenCalled();
  });

  it('inserts a missing projection idempotently', async () => {
    const chatUser = {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const consumer = new UserEventsConsumer({} as never, {
      chatUser,
    } as never);

    await consumer.applyEvent(profileEvent);

    expect(chatUser.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: profileEvent.data.userId,
        username: 'saad',
        sourceUpdatedAt: new Date(profileEvent.version),
        deletedAt: null,
      }),
      skipDuplicates: true,
    });
  });
});
