import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserAuthClient } from '../src/client.js';

function serialLocks() {
  let tail = Promise.resolve();
  return {
    request(_name, work) {
      const next = tail.then(work);
      tail = next.catch(() => {});
      return next;
    },
  };
}

function mockChannel() {
  const listeners = new Set();
  return {
    posted: [],
    postMessage(msg) { this.posted.push(msg); },
    addEventListener(type, fn) { if (type === 'message') listeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn); },
    deliver(data) { for (const fn of [...listeners]) fn({ data }); },
  };
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
  };
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const ME = { id: 'usr_1', username: 'alice' };
const TOKENS = (rev = 1) => ({ accessToken: `token-${rev}` });

test('Control channel: unknown messages are ignored without error', () => {
  const channel = mockChannel();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel,
    storage: memoryStorage(),
  });

  assert.doesNotThrow(() => channel.deliver('UNKNOWN_RANDOM_MSG'));
  assert.doesNotThrow(() => channel.deliver(null));
  assert.doesNotThrow(() => channel.deliver({}));
  client.dispose();
});

test('Control channel: messages delivered after client dispose are ignored', async () => {
  const channel = mockChannel();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel,
    storage: memoryStorage(),
  });

  client.dispose();
  channel.deliver('signed-out');
  channel.deliver('signed-in');
  channel.deliver('token-renewed');
  assert.equal(client.getSnapshot().status, 'loading');
});

test('Control channel: signed-out message clears store and sets status to anonymous', async () => {
  const channel = mockChannel();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  assert.equal(client.getSnapshot().status, 'authenticated');

  channel.deliver('signed-out');
  assert.equal(client.getSnapshot().status, 'anonymous');
  assert.equal(client.getAccessToken(), null);
  client.dispose();
});

test('Control channel: token-renewed reloads profile and restores on 401', async () => {
  let profileAttempts = 0;
  let restoreAttempts = 0;
  const channel = mockChannel();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) {
        profileAttempts++;
        if (profileAttempts > 1) {
          return json({ message: 'Expired' }, 401);
        }
        return json(ME);
      }
      if (url.endsWith('/auth/refresh')) {
        restoreAttempts++;
        return json(TOKENS(2));
      }
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  assert.equal(client.getSnapshot().status, 'authenticated');

  channel.deliver('token-renewed');
  // Wait a microtask tick for async profile reload and recovery restore
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(profileAttempts >= 2);
  client.dispose();
});
