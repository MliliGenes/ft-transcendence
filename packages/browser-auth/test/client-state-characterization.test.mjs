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

test('Client state: initial snapshot has expected default shape', () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    storage: memoryStorage(),
  });
  const snapshot = client.getSnapshot();
  assert.equal(snapshot.status, 'loading');
  assert.equal(snapshot.profile, null);
  assert.equal(snapshot.sessionGeneration, 0);
  assert.equal(snapshot.tokenRevision, 0);
  assert.equal(snapshot.logoutPending, false);
  client.dispose();
});

test('Client state: subscribe registers listeners and unsubscribe unregisters them', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  const snapshots1 = [];
  const snapshots2 = [];
  const unsubscribe1 = client.subscribe((s) => snapshots1.push(s.status));
  const unsubscribe2 = client.subscribe((s) => snapshots2.push(s.status));

  await client.login('login', { username: 'u', password: 'p' });
  assert.ok(snapshots1.length >= 2);
  assert.deepEqual(snapshots1, snapshots2);

  unsubscribe1();
  const countBefore = snapshots1.length;
  await client.logout();
  assert.equal(snapshots1.length, countBefore);
  assert.ok(snapshots2.length > countBefore);

  unsubscribe2();
  client.dispose();
});

test('Client state: restore maps 401 to anonymous and returns snapshot without throwing', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async () => json({ error: 'unauthorized' }, 401),
    storage: memoryStorage(),
  });

  const statuses = [];
  client.subscribe((s) => statuses.push(s.status));
  const snapshot = await client.restore();
  assert.equal(snapshot.status, 'anonymous');
  assert.equal(snapshot.profile, null);
  assert.ok(statuses.includes('anonymous'));
  client.dispose();
});

test('Client state: restore maps 500 error to unavailable status and throws ApiError', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async () => json({ error: 'server error' }, 500),
    storage: memoryStorage(),
  });

  const statuses = [];
  client.subscribe((s) => statuses.push(s.status));
  await assert.rejects(
    () => client.restore(),
    (err) => err.status === 500,
  );
  assert.equal(client.getSnapshot().status, 'unavailable');
  assert.ok(statuses.includes('unavailable'));
  client.dispose();
});

test('Client state: restore maps network failure to UNAVAILABLE error code and unavailable status', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    storage: memoryStorage(),
  });

  await assert.rejects(
    () => client.restore(),
    (err) => err.code === 'UNAVAILABLE' && err.message.includes('The service could not be reached'),
  );
  assert.equal(client.getSnapshot().status, 'unavailable');
  client.dispose();
});

test('Client state: login failure transitions to loading then maps error status', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json({ error: 'invalid credentials' }, 401);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  const transitions = [];
  client.subscribe((s) => transitions.push(s.status));
  await assert.rejects(
    () => client.login('login', { username: 'u', password: 'bad' }),
    (err) => err.status === 401,
  );
  assert.deepEqual(transitions, ['loading', 'anonymous']);
  assert.equal(client.getSnapshot().status, 'anonymous');
  client.dispose();
});

test('Client state: fetch 500 while authenticated transitions to unavailable', async () => {
  let authed = true;
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/data')) return json({ error: 'boom' }, 503);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  assert.equal(client.getSnapshot().status, 'authenticated');

  await assert.rejects(
    () => client.fetch('/data'),
    (err) => err.status === 503,
  );
  assert.equal(client.getSnapshot().status, 'unavailable');
  client.dispose();
});

test('Client state: fetch 500 while anonymous does not transition to unavailable', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) return json({ error: 'unauthorized' }, 401);
      if (url.endsWith('/public')) return json({ error: 'down' }, 500);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.restore();
  assert.equal(client.getSnapshot().status, 'anonymous');

  await assert.rejects(
    () => client.fetch('/public', { auth: false }),
    (err) => err.status === 500,
  );
  assert.equal(client.getSnapshot().status, 'anonymous');
  client.dispose();
});

test('Client state: store.clear while authenticated transitions to anonymous and emits', async () => {
  const store = createMemorySession();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    store,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  assert.equal(client.getSnapshot().status, 'authenticated');

  const transitions = [];
  client.subscribe((s) => transitions.push(s.status));
  store.clear();
  assert.equal(client.getSnapshot().status, 'anonymous');
  assert.deepEqual(transitions, ['anonymous']);
  client.dispose();
});

test('Client state: store.clear while unavailable transitions to anonymous and emits', async () => {
  const store = createMemorySession();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    store,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/service')) return json({ error: 'down' }, 502);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  await assert.rejects(() => client.fetch('/service'));
  assert.equal(client.getSnapshot().status, 'unavailable');

  const transitions = [];
  client.subscribe((s) => transitions.push(s.status));
  store.clear();
  assert.equal(client.getSnapshot().status, 'anonymous');
  assert.deepEqual(transitions, ['anonymous']);
  client.dispose();
});

test('Client state: dispose terminates listeners and emissions', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  let emitted = 0;
  client.subscribe(() => { emitted++; });
  client.dispose();

  await assert.rejects(
    () => client.login('login', { username: 'u', password: 'p' }),
    (err) => err.message.includes('disposed'),
  );
  assert.equal(emitted, 0);
});

test('Client state: token rotation emits snapshot and broadcasts TOKEN_RENEWED', async () => {
  let refreshCount = 1;
  const channel = mockChannel();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel,
    fetchImpl: async (url, options) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/auth/refresh')) return json(TOKENS(++refreshCount));
      return options.headers?.Authorization === 'Bearer token-1'
        ? json({ error: 'unauthorized' }, 401)
        : json({ data: 'ok' });
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  const revisions = [];
  client.subscribe((s) => revisions.push(s.tokenRevision));

  await client.fetch('/data', { retrySafeRead: true });
  assert.ok(revisions.includes(2));
  assert.ok(channel.posted.includes('token-renewed'));
  client.dispose();
});

test('Client state: store subscriber ignores notifications with identical tokenRevision', () => {
  let storeListener;
  let currentSession = { accessToken: 'tok-1', sessionGeneration: 1, tokenRevision: 1 };
  const customStore = {
    read: () => currentSession,
    generation: () => currentSession?.sessionGeneration ?? 1,
    subscribe: (fn) => { storeListener = fn; return () => {}; },
    clear: () => { currentSession = null; storeListener?.(null); },
  };
  const channel = mockChannel();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel,
    store: customStore,
    storage: memoryStorage(),
  });

  let emissionCount = 0;
  client.subscribe(() => { emissionCount++; });

  // First notification with new revision
  currentSession = { accessToken: 'tok-2', sessionGeneration: 1, tokenRevision: 2 };
  storeListener(currentSession);
  assert.equal(emissionCount, 1);
  assert.equal(channel.posted.length, 1);

  // Duplicate notification with same revision
  storeListener(currentSession);
  assert.equal(emissionCount, 1);
  assert.equal(channel.posted.length, 1);

  client.dispose();
});

test('Client state: throwing subscriber on restore success propagates error and leaves status authenticated', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  const boom = new Error('subscriber boom on restore');
  client.subscribe((snapshot) => {
    if (snapshot.status === 'authenticated') throw boom;
  });

  await assert.rejects(
    () => client.restore(true),
    (err) => err === boom,
  );
  assert.equal(client.getSnapshot().status, 'authenticated');
  client.dispose();
});

test('Client state: throwing subscriber on login success propagates error and leaves status authenticated', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  const boom = new Error('subscriber boom on login');
  client.subscribe((snapshot) => {
    if (snapshot.status === 'authenticated') throw boom;
  });

  await assert.rejects(
    () => client.login('login', { username: 'u', password: 'p' }),
    (err) => err === boom,
  );
  assert.equal(client.getSnapshot().status, 'authenticated');
  client.dispose();
});

test('Client state: snapshot during control broadcast reflects updated state before emit', async () => {
  let statusDuringLoginBroadcast = null;
  let statusDuringLogoutBroadcast = null;
  let client;

  const channel = {
    posted: [],
    listeners: new Set(),
    postMessage(msg) {
      this.posted.push(msg);
      if (msg === 'signed-in') {
        statusDuringLoginBroadcast = client.getSnapshot().status;
      } else if (msg === 'signed-out') {
        statusDuringLogoutBroadcast = client.getSnapshot().status;
      }
    },
    addEventListener(type, fn) { if (type === 'message') this.listeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'message') this.listeners.delete(fn); },
  };

  client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      if (url.endsWith('/auth/logout')) return json({ ok: true });
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  await client.login('login', { username: 'u', password: 'p' });
  assert.equal(statusDuringLoginBroadcast, 'authenticated');

  await client.logout();
  assert.equal(statusDuringLogoutBroadcast, 'anonymous');

  client.dispose();
});

test('Client state: unsubscribe function is idempotent and does not throw when called repeatedly', async () => {
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    locks: serialLocks(),
    channel: mockChannel(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      if (url.endsWith('/accounts/me')) return json(ME);
      return json({}, 404);
    },
    storage: memoryStorage(),
  });

  let calls = 0;
  const unsubscribe = client.subscribe(() => { calls++; });
  await client.login('login', { username: 'u', password: 'p' });
  assert.ok(calls > 0);

  const recordedCalls = calls;
  assert.doesNotThrow(() => unsubscribe());
  assert.doesNotThrow(() => unsubscribe());
  assert.doesNotThrow(() => unsubscribe());

  await client.logout();
  assert.equal(calls, recordedCalls);
  client.dispose();
});

