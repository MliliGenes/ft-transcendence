import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserAuthClient } from '../src/client.js';

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const unauthorized = () => json({ message: 'Expired' }, 401);

function serialLocks() {
  let tail = Promise.resolve();
  return {
    request: (_name, fn) => {
      const promise = tail.then(fn);
      tail = promise.catch(() => {});
      return promise;
    },
  };
}

function fakeChannel() {
  const listeners = new Set();
  return {
    postMessage() {},
    addEventListener(type, fn) {
      if (type === 'message') listeners.add(fn);
    },
    removeEventListener(type, fn) {
      if (type === 'message') listeners.delete(fn);
    },
    close() {},
  };
}

function scriptFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options, calls.length);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const ME = { id: 'user-1' };
const TOKENS = (n) => ({ accessToken: `access-${n}` });

async function loggedIn(handler) {
  const fetchImpl = scriptFetch((url, options, count) => {
    if (url.endsWith('/auth/login')) return json(TOKENS(1));
    if (url.endsWith('/accounts/me')) return json(ME);
    return handler(url, options, count);
  });
  const client = createBrowserAuthClient({
    apiBase: '',
    fetchImpl,
    locks: serialLocks(),
    channel: fakeChannel(),
    clock: Date,
  });
  await client.login('login', {});
  const callsBefore = fetchImpl.calls.length;
  return { client, fetchImpl, callsBefore };
}

test('default fetch never replays a failed mutation', async () => {
  const { client, fetchImpl, callsBefore } = await loggedIn(() => json({ message: 'boom' }, 500));
  await assert.rejects(client.fetch('/accounts/me/password', { method: 'PATCH', json: {} }), (e) => e.status === 500);
  assert.equal(fetchImpl.calls.length - callsBefore, 1);
  assert.equal(client.getAccessToken(), 'access-1');
  client.dispose();
});

test('default fetch never retries a lost safe read', async () => {
  const { client, fetchImpl, callsBefore } = await loggedIn(() => {
    throw new TypeError('offline');
  });
  await assert.rejects(client.fetch('/accounts/search'), (e) => e.code === 'UNAVAILABLE');
  assert.equal(fetchImpl.calls.length - callsBefore, 1);
  client.dispose();
});

test('retrySafeRead retries a safe read exactly once', async () => {
  const { client, fetchImpl, callsBefore } = await loggedIn((url, _options, count) => {
    if (url.endsWith('/accounts/me')) return json(ME);
    return count <= 3 ? json({ message: 'boom' }, 500) : json(ME);
  });
  const profile = await client.fetch('/accounts/search', { retrySafeRead: true });
  assert.deepEqual(profile, ME);
  assert.equal(fetchImpl.calls.length - callsBefore, 2);
  client.dispose();
});

test('retrySafeRead never replays mutations', async () => {
  const { client, fetchImpl, callsBefore } = await loggedIn(() => json({ message: 'boom' }, 500));
  await assert.rejects(
    client.fetch('/accounts/me/password', { method: 'PATCH', json: {}, retrySafeRead: true }),
    (e) => e.status === 500,
  );
  assert.equal(fetchImpl.calls.length - callsBefore, 1);
  client.dispose();
});

test('401 renews once and retries with the fresh token', async () => {
  const { client, fetchImpl, callsBefore } = await loggedIn((url, options) => {
    if (url.endsWith('/auth/refresh')) return json(TOKENS(2));
    return options.headers?.Authorization === 'Bearer access-2' ? json(ME) : unauthorized();
  });
  const profile = await client.fetch('/accounts/search');
  assert.deepEqual(profile, ME);
  const refreshes = fetchImpl.calls.filter((call) => call.url.endsWith('/auth/refresh')).length;
  assert.equal(refreshes, 1);
  assert.equal(client.getAccessToken(), 'access-2');
  assert.equal(fetchImpl.calls.length - callsBefore, 3);
  client.dispose();
});

test('cookie endpoints carry X-Requested-With but safe reads do not', async () => {
  const { client, fetchImpl } = await loggedIn(async () => json({ ok: true }));
  await client.fetch('/accounts/me');
  await client.login('login', {});
  const read = fetchImpl.calls.find((call) => call.url.endsWith('/accounts/me') && call.options.method !== 'POST');
  const login = fetchImpl.calls.find((call) => call.url.endsWith('/auth/login'));
  assert.equal(read.options.headers['X-Requested-With'], undefined);
  assert.equal(login.options.headers['X-Requested-With'], 'XMLHttpRequest');
  client.dispose();
});
