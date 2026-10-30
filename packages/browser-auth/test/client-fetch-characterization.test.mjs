import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserAuthClient, createMemorySession } from '../src/client.js';

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

test('Client fetch: calling fetch when client is disposed throws disposed error immediately', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    storage: memoryStorage(),
  });

  client.dispose();

  await assert.rejects(
    () => client.fetch('/data'),
    (err) => {
      assert.equal(err.message, 'The auth client is disposed.');
      return true;
    },
  );
});

test('Client fetch: disposing client while request is in flight remaps rejection to SESSION_CHANGED', async () => {
  let resolveRequest;
  const inFlightPromise = new Promise((resolve) => {
    resolveRequest = resolve;
  });

  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/slow')) {
        await inFlightPromise;
        return json({}, 500);
      }
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });

  const fetchPromise = client.fetch('/slow');
  // Dispose while request is in flight
  client.dispose();
  resolveRequest();

  await assert.rejects(
    fetchPromise,
    (err) => {
      assert.equal(err.code, 'SESSION_CHANGED');
      assert.equal(err.status, 401);
      return true;
    },
  );
});

test('Client fetch: SESSION_CHANGED error thrown by api.request propagates directly', async () => {
  const store = createMemorySession();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    store,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/changing')) {
        // Bump generation while in flight to trigger changedSession in api
        store.clear();
        return json({ ok: true });
      }
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });

  await assert.rejects(
    () => client.fetch('/changing'),
    (err) => {
      assert.equal(err.code, 'SESSION_CHANGED');
      return true;
    },
  );

  client.dispose();
});

test('Client fetch: own-expiry transitions status to anonymous without throwing changedSession', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/auth/refresh')) return json(TOKENS(2));
      if (url.endsWith('/replayed-401')) {
        return json({ message: 'Still expired' }, 401);
      }
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  assert.equal(client.getSnapshot().status, 'authenticated');

  await assert.rejects(
    () => client.fetch('/replayed-401', { retrySafeRead: true }),
    (err) => {
      assert.equal(err.code, 'SESSION_EXPIRED');
      return true;
    },
  );

  assert.equal(client.getSnapshot().status, 'anonymous');
  client.dispose();
});

test('Client fetch: network failure during fetch while authenticated transitions status to unavailable', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/network-fail')) {
        throw new TypeError('Failed to fetch');
      }
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  assert.equal(client.getSnapshot().status, 'authenticated');

  await assert.rejects(
    () => client.fetch('/network-fail'),
    (err) => {
      assert.equal(err.code, 'UNAVAILABLE');
      return true;
    },
  );

  assert.equal(client.getSnapshot().status, 'unavailable');
  client.dispose();
});
