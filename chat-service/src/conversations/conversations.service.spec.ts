import { DatabaseService } from '../database/database.service.js';
import { UserServiceClient } from '../users/user-service.client.js';
import { UserProjectionService } from '../users/user-projection.service.js';
import { ConversationsService } from './conversations.service.js';

it('bounds per-user writes and allows requests again after the window expires', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const database = {
    conversation: {
      createMany: vi.fn(async () => ({ count: 0 })),
      findUniqueOrThrow: vi.fn(async () => ({ id: 'existing-dm' })),
    },
  } as unknown as DatabaseService;
  const users = {
    ensureUsers: vi.fn(async () => []),
  } as unknown as UserProjectionService;
  const source = {
    assertUnblocked: vi.fn(async () => {}),
  } as unknown as UserServiceClient;
  const service = new ConversationsService(database, users, source);
  try {
    for (let i = 0; i < 60; i++) await service.openDm('alice', 'bob');
    await expect(service.openDm('alice', 'bob')).rejects.toMatchObject({
      status: 429,
    });
    expect(source.assertUnblocked).toHaveBeenCalledTimes(60);
    expect(users.ensureUsers).toHaveBeenLastCalledWith(['bob'], true);
    await expect(service.openDm('charlie', 'bob')).resolves.toEqual({
      id: 'existing-dm',
    });
    now.mockReturnValue(61001);
    await expect(service.openDm('alice', 'bob')).resolves.toEqual({
      id: 'existing-dm',
    });
  } finally {
    now.mockRestore();
  }
});
