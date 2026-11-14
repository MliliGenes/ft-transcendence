import { describe, expect, it } from 'vitest';
import { InMemoryLobbyStore } from '../src/lobby.js';

describe('lobby account erasure', () => {
  it('removes queue entries and transfers an open room from its deleted owner', async () => {
    const lobby = new InMemoryLobbyStore();
    await lobby.joinQueue('deleted-queued-user', '1v1');
    const created = await lobby.createPrivateRoom('deleted-owner', '1v1');
    await lobby.joinPrivateRoom('surviving-user', created.room.code);

    await lobby.eraseUser('deleted-queued-user');
    await lobby.eraseUser('deleted-owner');

    expect(await lobby.queueStatus('deleted-queued-user')).toBeNull();
    await expect(
      lobby.getRoomWithMembers(created.room.id),
    ).resolves.toMatchObject({
      room: { ownerUserId: 'surviving-user', status: 'open' },
      members: [{ userId: 'surviving-user' }],
    });
    expect(
      JSON.stringify(await lobby.getRoomWithMembers(created.room.id)),
    ).not.toContain('deleted-owner');
  });
});
