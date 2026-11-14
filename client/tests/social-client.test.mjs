import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/auth/client')
      return nextResolve(
        new URL('../lib/auth/client.ts', import.meta.url).href,
        context,
      );
    return nextResolve(specifier, context);
  },
});
const { socialApi } = await import('../lib/social/client.ts');
const { chatApi } = await import('../lib/chat/client.ts');
hooks.deregister();

test('social actions use authenticated requests and the correct resource IDs', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, ...init });
    return new Response(null, { status: 204 });
  });
  await socialApi.removeFriendship('friendship-id', 'test-token');
  await socialApi.blockUser('user/id', 'test-token');
  await socialApi.unblockUser('user/id', 'test-token');
  assert.deepEqual(
    calls.map(({ url, method }) => [url, method]),
    [
      ['/api/social/friendships/friendship-id', 'DELETE'],
      ['/api/social/blocks/user%2Fid', 'POST'],
      ['/api/social/blocks/user%2Fid', 'DELETE'],
    ],
  );
  for (const call of calls) {
    assert.equal(call.headers.Authorization, 'Bearer test-token');
    assert.equal(call.credentials, 'include');
    assert.equal(call.cache, 'no-store');
  }
});

test('friends retain the relationship ID needed for removal', async (t) => {
  const friend = {
    id: 'user-b',
    friendshipId: 'relationship-ab',
    username: 'friend',
  };
  t.mock.method(globalThis, 'fetch', async (url) =>
    Response.json(url.endsWith('/friendships') ? [friend] : []),
  );
  assert.deepEqual(await socialApi.getFriendshipState('test-token'), {
    friends: [friend],
    incoming: [],
    outgoing: [],
  });
});

test('opening a DM sends the target user and returns the existing conversation', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, '/api/chat/conversations/dm');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(init.body), { userId: 'friend-id' });
    return Response.json({ id: 'existing-conversation' });
  });
  assert.equal(
    (await chatApi.openDm('friend-id', 'test-token')).id,
    'existing-conversation',
  );
});

test('denied social and DM actions surface errors instead of reporting success', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 403 }),
  );
  for (const action of [
    () => socialApi.removeFriendship('someone-elses-friendship', 'test-token'),
    () => socialApi.blockUser('self', 'test-token'),
    () => chatApi.openDm('blocked-user', 'test-token'),
  ])
    await assert.rejects(action, (error) => error.status === 403);
});
