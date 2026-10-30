import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserAuthClient } from '../src/client.js';

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const unauthorized = () => json({ message: 'Expired' }, 401);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Two linked BroadcastChannel fakes: postMessage on one delivers to the other.
function linkedChannels() {
  const ends = [];
  const make = () => {
    const listeners = new Set();
    const channel = {
      posted: [],
      received: [],
      postMessage(message) {
        channel.posted.push(message);
        for (const other of ends)
          if (other !== channel) other.deliver(message);
      },
      addEventListener(type, fn) {
        if (type === 'message') listeners.add(fn);
      },
      removeEventListener(type, fn) {
        if (type === 'message') listeners.delete(fn);
      },
      deliver(message) {
        channel.received.push(message);
        for (const fn of [...listeners]) fn({ data: message });
      },
      close() {},
    };
    ends.push(channel);
    return channel;
  };
  return [make(), make()];
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

const ME = { id: 'user-1', username: 'player' };
const TOKENS = (n) => ({ accessToken: `access-${n}` });

function makeClient(fetchImpl, locks = serialLocks(), channels = linkedChannels()) {
  return {
    client: createBrowserAuthClient({
      apiBase: 'https://auth.test',
      fetchImpl,
      locks,
      channel: channels[0],
      clock: Date,
    }),
    peer: channels[1],
  };
}

test('createBrowserAuthClient requires Web Locks and a BroadcastChannel', () => {
  const fetchImpl = async () => json(TOKENS(1));
  assert.throws(
    () => createBrowserAuthClient({ apiBase: '', fetchImpl, channel: linkedChannels()[0] }),
    /Locks/,
  );
  assert.throws(
    () => createBrowserAuthClient({ apiBase: '', fetchImpl, locks: serialLocks() }),
    /BroadcastChannel/,
  );
});

test('client exposes the shared browser-auth interface', () => {
  const { client } = makeClient(async () => json(TOKENS(1)));
  assert.deepEqual(
    Object.keys(client).sort(),
    ['dispose', 'fetch', 'getAccessToken', 'getSnapshot', 'login', 'logout', 'restore', 'subscribe'].sort(),
  );
  assert.equal(client.getSnapshot().status, 'loading');
  assert.equal(client.getAccessToken(), null);
  client.dispose();
});

test('restore with no cookie goes anonymous without retaining anything', async () => {
  const fetchImpl = scriptFetch((url) =>
    url.endsWith('/auth/refresh') ? unauthorized() : json(ME),
  );
  const { client } = makeClient(fetchImpl);
  const snapshot = await client.restore().catch((error) => error);
  assert.equal(client.getSnapshot().status, 'anonymous');
  assert.equal(client.getAccessToken(), null);
  assert.match(String(snapshot?.code ?? snapshot?.status ?? 'anonymous'), /401|anonymous/);
  client.dispose();
});

test('login authenticates, loads the profile, and broadcasts signed-in', async () => {
  const fetchImpl = scriptFetch((url) =>
    url.endsWith('/auth/login') ? json(TOKENS(1)) : json(ME),
  );
  const { client, peer } = makeClient(fetchImpl);
  const seen = [];
  client.subscribe((snapshot) => seen.push(snapshot.status));
  const snapshot = await client.login('login', { username: 'p', password: 'long-enough-password' });
  assert.equal(snapshot.status, 'authenticated');
  assert.deepEqual(snapshot.profile, ME);
  assert.equal(client.getAccessToken(), 'access-1');
  assert.deepEqual(peer.received, ['signed-in']);
  assert.ok(seen.includes('authenticated'));
  const loginCall = fetchImpl.calls.find((call) => call.url.endsWith('/auth/login'));
  assert.equal(loginCall.options.credentials, 'include');
  assert.equal(loginCall.options.headers['X-Requested-With'], 'XMLHttpRequest');
  client.dispose();
});

test('restore after logout does not revive the session', async () => {
  const ready = Promise.withResolvers();
  const finish = Promise.withResolvers();
  const fetchImpl = scriptFetch((url) => {
    if (url.endsWith('/auth/refresh')) {
      ready.resolve();
      return finish.promise.then(() => json(TOKENS(2)));
    }
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return json(ME);
  });
  const { client } = makeClient(fetchImpl);
  const pending = client.restore();
  await ready.promise;
  const leaving = client.logout();
  assert.equal(client.getAccessToken(), null);
  assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith('/auth/logout')).length, 0);
  finish.resolve();
  await leaving;
  await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
  assert.equal(client.getAccessToken(), null);
  assert.equal(client.getSnapshot().status, 'anonymous');
  client.dispose();
});

test('outage during restore retains the previous session as unavailable', async () => {
  const fetchImpl = scriptFetch((url) => {
    if (url.endsWith('/auth/login')) return json(TOKENS(1));
    if (url.endsWith('/accounts/me')) return json(ME);
    throw new TypeError('offline');
  });
  const { client } = makeClient(fetchImpl);
  await client.login('login', {});
  await assert.rejects(client.restore(true), (error) => error.code === 'UNAVAILABLE');
  assert.equal(client.getSnapshot().status, 'unavailable');
  assert.equal(client.getAccessToken(), 'access-1');
  client.dispose();
});

test('renew outage retains the token instead of mapping to SESSION_EXPIRED', async () => {
  const fetchImpl = scriptFetch((url, options) => {
    if (url.endsWith('/auth/login')) return json(TOKENS(1));
    if (url.endsWith('/accounts/me')) return json(ME);
    if (url.endsWith('/auth/refresh')) throw new TypeError('response lost');
    return options.headers?.Authorization === 'Bearer access-1'
      ? unauthorized()
      : json({ ok: true });
  });
  const { client } = makeClient(fetchImpl);
  await client.login('login', {});
  await assert.rejects(client.fetch('/accounts/search'), (error) => error.code === 'UNAVAILABLE');
  assert.equal(client.getAccessToken(), 'access-1');
  assert.equal(client.getSnapshot().status, 'unavailable');
  client.dispose();
});

test('confirmed 401 renewal ends the session as anonymous', async () => {
  const fetchImpl = scriptFetch((url) => {
    if (url.endsWith('/auth/login')) return json(TOKENS(1));
    if (url.endsWith('/accounts/me')) {
      return fetchImpl.calls.some((call) => call.url.endsWith('/auth/refresh'))
        ? unauthorized()
        : json(ME);
    }
    if (url.endsWith('/auth/refresh')) return unauthorized();
    return unauthorized();
  });
  const { client } = makeClient(fetchImpl);
  await client.login('login', {});
  await assert.rejects(client.fetch('/accounts/search'), (error) => error.code === 'SESSION_EXPIRED');
  assert.equal(client.getAccessToken(), null);
  assert.equal(client.getSnapshot().status, 'anonymous');
  client.dispose();
});

test('concurrent login serializes behind restore and supersedes its stale result', async () => {
  const release = Promise.withResolvers();
  const fetchImpl = scriptFetch((url) => {
    if (url.endsWith('/auth/refresh')) return release.promise.then(() => json(TOKENS(9)));
    if (url.endsWith('/auth/login')) return json(TOKENS(2));
    return json(ME);
  });
  const { client } = makeClient(fetchImpl);
  const stale = assert.rejects(client.restore(true), (error) => error.code === 'SESSION_CHANGED');
  await wait(5);
  const logged = client.login('login', {});
  release.resolve();
  await stale;
  const snapshot = await logged;
  assert.equal(snapshot.status, 'authenticated');
  assert.equal(client.getAccessToken(), 'access-2');
  client.dispose();
});

test('logout clears locally and closes sockets immediately, then serializes server logout', async () => {
  const releaseLogout = Promise.withResolvers();
  const fetchImpl = scriptFetch((url) => {
    if (url.endsWith('/auth/login')) return json(TOKENS(1));
    if (url.endsWith('/accounts/me')) return json(ME);
    if (url.endsWith('/auth/logout')) return releaseLogout.promise.then(() => new Response(null, { status: 204 }));
    throw new Error(`unexpected ${url}`);
  });
  const [channelA, channelB] = linkedChannels();
  const locks = serialLocks();
  const a = createBrowserAuthClient({ apiBase: '', fetchImpl, locks, channel: channelA, clock: Date });
  const b = createBrowserAuthClient({ apiBase: '', fetchImpl, locks, channel: channelB, clock: Date });
  await a.login('login', {});
  // Sockets registered through subscription close on the anonymous transition.
  let closedA = 0;
  let closedB = 0;
  a.subscribe((snapshot) => {
    if (snapshot.status === 'anonymous') closedA++;
  });
  b.subscribe((snapshot) => {
    if (snapshot.status === 'anonymous') closedB++;
  });
  const pending = a.logout();
  assert.equal(a.getAccessToken(), null);
  assert.ok(closedA >= 1);
  assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith('/auth/logout')).length, 0);
  releaseLogout.resolve();
  const receipt = await pending;
  assert.deepEqual(receipt, { serverConfirmed: true });
  assert.deepEqual(channelA.posted.at(-1), 'signed-out');
  await wait(5);
  assert.equal(b.getSnapshot().status, 'anonymous');
  assert.equal(closedB, 1);
  // No mutation is replayed by logout: exactly one server call happened.
  assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith('/auth/logout')).length, 1);
  a.dispose();
  b.dispose();
});

test('failed server logout sets logout-pending and blocks bootstrap until login', async () => {
  const fetchImpl = scriptFetch((url) => {
    if (url.endsWith('/auth/login')) return json(TOKENS(1));
    if (url.endsWith('/accounts/me')) return json(ME);
    if (url.endsWith('/auth/logout')) throw new TypeError('offline');
    throw new Error(`unexpected ${url}`);
  });
  const { client } = makeClient(fetchImpl);
  await client.login('login', {});
  const receipt = await client.logout();
  assert.deepEqual(receipt, { serverConfirmed: false });
  assert.equal(client.getSnapshot().logoutPending, true);
  await assert.rejects(client.restore(), (error) => error.code === 'LOGOUT_PENDING');
  const snapshot = await client.login('login', {});
  assert.equal(snapshot.status, 'authenticated');
  assert.equal(client.getSnapshot().logoutPending, false);
  client.dispose();
});

test('token rotation bumps tokenRevision so sidecars can renew explicitly', async () => {
  let refresh = 1;
  const fetchImpl = scriptFetch((url, options) => {
    if (url.endsWith('/auth/login')) return json(TOKENS(1));
    if (url.endsWith('/accounts/me')) return json(ME);
    if (url.endsWith('/auth/refresh')) return json(TOKENS(++refresh));
    return options.headers?.Authorization === 'Bearer access-1' ? unauthorized() : json({ ok: true });
  });
  const { client } = makeClient(fetchImpl);
  await client.login('login', {});
  const before = client.getSnapshot();
  await client.fetch('/accounts/search', { retrySafeRead: true });
  const after = client.getSnapshot();
  assert.equal(after.sessionGeneration, before.sessionGeneration);
  assert.ok(after.tokenRevision > before.tokenRevision);
  assert.equal(client.getAccessToken(), 'access-2');
  client.dispose();
});

test('storage getItem failure on restore propagates fail-closed without network call', async () => {
  let networkCalls = 0;
  const faultStorage = {
    getItem() { throw new Error('SecurityError: storage read blocked'); },
    setItem() {},
    removeItem() {},
  };
  const [channelA] = linkedChannels();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    fetchImpl: async () => { networkCalls++; return json(TOKENS(1)); },
    locks: serialLocks(),
    channel: channelA,
    storage: faultStorage,
  });
  await assert.rejects(
    client.restore(),
    (error) => error.message === 'SecurityError: storage read blocked',
  );
  assert.equal(networkCalls, 0);
  client.dispose();
});

test('storage setItem failure on logout propagates fail-closed', async () => {
  let networkCalls = 0;
  const faultStorage = {
    getItem() { return null; },
    setItem() { throw new Error('QuotaExceededError: storage write blocked'); },
    removeItem() {},
  };
  const [channelA] = linkedChannels();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    fetchImpl: async () => { networkCalls++; return new Response(null, { status: 204 }); },
    locks: serialLocks(),
    channel: channelA,
    storage: faultStorage,
  });
  await assert.rejects(
    client.logout(),
    (error) => error.message === 'QuotaExceededError: storage write blocked',
  );
  assert.equal(networkCalls, 0);
  client.dispose();
});

test('storage setItem failure during login acknowledgement rejects with SESSION_CHANGED while intent remains unacknowledged', async () => {
  let acknowledgementAttempts = 0;
  const faultStorage = {
    entries: new Map([['browser-auth:logout-pending', 'active-logout-id']]),
    getItem(key) { return this.entries.get(key) ?? null; },
    setItem(key, value) {
      if (key === 'browser-auth:logout-acknowledged') {
        acknowledgementAttempts++;
        throw new Error('QuotaExceededError: acknowledgement write blocked');
      }
      this.entries.set(key, value);
    },
    removeItem(key) { this.entries.delete(key); },
  };
  const [channelA] = linkedChannels();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    fetchImpl: scriptFetch((url) => {
      if (url.endsWith('/auth/login')) return json(TOKENS(1));
      return json(ME);
    }),
    locks: serialLocks(),
    channel: channelA,
    storage: faultStorage,
  });
  await assert.rejects(
    client.login('login', {}),
    (error) => error.code === 'SESSION_CHANGED',
  );
  assert.equal(acknowledgementAttempts, 1);
  assert.equal(faultStorage.getItem('browser-auth:logout-acknowledged'), null);
  assert.equal(faultStorage.getItem('browser-auth:logout-pending'), 'active-logout-id');
  assert.equal(client.getAccessToken(), TOKENS(1).accessToken);
  const snapshot = client.getSnapshot();
  assert.equal(snapshot.status, 'loading');
  assert.equal(snapshot.logoutPending, true);
  client.dispose();
});

test('per-instance fallback when storage is null keeps independent clients isolated', async () => {
  const [channelA, channelB] = linkedChannels();
  const locks = serialLocks();
  const fetchImplA = scriptFetch((url) => {
    if (url.endsWith('/auth/logout')) throw new TypeError('offline');
    return json(ME);
  });
  const fetchImplB = scriptFetch((url) => {
    if (url.endsWith('/auth/refresh')) return json(TOKENS(1));
    return json(ME);
  });
  const clientA = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    fetchImpl: fetchImplA,
    locks,
    channel: channelA,
    storage: null,
  });
  const clientB = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    fetchImpl: fetchImplB,
    locks,
    channel: channelB,
    storage: null,
  });
  await clientA.logout();
  assert.equal(clientA.getSnapshot().logoutPending, true);
  assert.equal(clientB.getSnapshot().logoutPending, false);
  const snapB = await clientB.restore();
  assert.equal(snapB.status, 'authenticated');
  assert.equal(snapB.logoutPending, false);
  clientA.dispose();
  clientB.dispose();
});

test('per-instance fallback when storage is null blocks restore after failed logout until login', async () => {
  const fetchImpl = scriptFetch((url) => {
    if (url.endsWith('/auth/logout')) throw new TypeError('offline');
    if (url.endsWith('/auth/refresh')) return json(TOKENS(1));
    if (url.endsWith('/auth/login')) return json(TOKENS(2));
    return json(ME);
  });
  const [channelA] = linkedChannels();
  const client = createBrowserAuthClient({
    apiBase: 'https://auth.test',
    fetchImpl,
    locks: serialLocks(),
    channel: channelA,
    storage: null,
  });
  await client.logout();
  assert.equal(client.getSnapshot().logoutPending, true);
  await assert.rejects(
    client.restore(),
    (error) => error.code === 'LOGOUT_PENDING',
  );
  const logged = await client.login('login', {});
  assert.equal(logged.status, 'authenticated');
  assert.equal(client.getSnapshot().logoutPending, false);
  client.dispose();
});
