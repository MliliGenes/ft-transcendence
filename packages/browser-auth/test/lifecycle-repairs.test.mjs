import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserAuthClient, createMemorySession } from '../src/client.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const tokens = (id) => ({ accessToken: `access-${id}` });
const me = (id) => ({ id, username: id });
const tick = () => new Promise((resolve) => setImmediate(resolve));
function serialLocks() {
  let tail = Promise.resolve();
  return { request(_name, work) { const next = tail.then(work); tail = next.catch(() => {}); return next; } };
}
function channel() {
  const listeners = new Set();
  return { posted: [], postMessage(value) { this.posted.push(value); }, addEventListener(_type, fn) { listeners.add(fn); }, removeEventListener(_type, fn) { listeners.delete(fn); }, deliver(value) { for (const fn of listeners) fn({ data: value }); } };
}
function storage() {
  const entries = new Map();
  return { entries, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
}
function setup(handler, options = {}) {
  const calls = [];
  const control = options.channel ?? channel();
  const client = createBrowserAuthClient({ apiBase: '', locks: options.locks ?? serialLocks(), channel: control, storage: options.storage ?? storage(), store: options.store, fetchImpl: async (url, init) => { calls.push({ url, init }); return handler(url, init); } });
  return { client, control, calls };
}

for (const outcome of ['success', 'error']) {
  test(`delayed login ${outcome} cannot revive or alter logout through serialized locks`, async () => {
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    const { client, control } = setup(async (url) => {
      if (url === '/auth/login') { entered.resolve(); await release.promise; if (outcome === 'error') throw new TypeError('offline'); return json(tokens('A')); }
      if (url === '/auth/logout') return new Response(null, { status: 204 });
      return json(me('A'));
    });
    const pending = client.login('login', {});
    const rejected = assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    await entered.promise;
    const leaving = client.logout();
    const generation = client.getSnapshot().sessionGeneration;
    release.resolve();
    await Promise.all([rejected, leaving]);
    assert.equal(client.getAccessToken(), null);
    assert.equal(client.getSnapshot().status, 'anonymous');
    assert.equal(client.getSnapshot().sessionGeneration, generation);
    assert.equal(control.posted.includes('signed-in'), false);
    client.dispose();
  });
}

for (const outcome of ['success', 'error']) {
  test(`late profile ${outcome} cannot overwrite a newer login`, async () => {
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    let logins = 0;
    const { client } = setup(async (url, init) => {
      if (url === '/auth/login') return json(tokens(++logins === 1 ? 'A' : 'B'));
      if (init.headers.Authorization === 'Bearer access-A') { entered.resolve(); await release.promise; if (outcome === 'error') throw new TypeError('offline'); return json(me('A')); }
      return json(me('B'));
    });
    const pending = client.login('login', {});
    const rejected = assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    await entered.promise;
    await client.login('login', {});
    const newer = client.getSnapshot();
    release.resolve();
    await rejected;
    assert.deepEqual(client.getSnapshot(), newer);
    assert.equal(client.getAccessToken(), 'access-B');
    client.dispose();
  });
}

test('dispose invalidates pending login without installing its token', async () => {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const { client, control } = setup(async (url) => { if (url === '/auth/login') { entered.resolve(); await release.promise; return json(tokens('A')); } return json(me('A')); });
  const pending = client.login('login', {});
  const rejected = assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
  await entered.promise;
  client.dispose();
  release.resolve();
  await rejected;
  assert.equal(client.getAccessToken(), null);
  assert.deepEqual(control.posted, []);
});

test('failed logout blocks forced restore across new clients and sibling SPAs', async () => {
  const shared = storage();
  const locks = serialLocks();
  const handler = (url) => { if (url === '/auth/logout') throw new TypeError('offline'); if (url === '/accounts/me') return json(me('A')); return json(tokens('A')); };
  const a = setup(handler, { storage: shared, locks });
  await a.client.login('login', {});
  await a.client.logout();
  a.client.dispose();
  const b = setup(handler, { storage: shared, locks });
  const c = setup(handler, { storage: shared, locks });
  for (const current of [b, c]) {
    await assert.rejects(current.client.restore(true), (error) => error.code === 'LOGOUT_PENDING');
    assert.equal(current.calls.length, 0);
    assert.equal(current.client.getSnapshot().logoutPending, true);
  }
  assert.equal(shared.entries.size, 1);
  assert.equal(JSON.stringify([...shared.entries]).includes('access-'), false);
  await b.client.login('login', {});
  assert.equal(b.client.getSnapshot().logoutPending, false);
  await c.client.restore(true);
  b.client.dispose(); c.client.dispose();
});

test('logout marks pending synchronously and blocks queued sibling restore before logout finishes', async (t) => {
  const shared = storage();
  const locks = serialLocks();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  t.after(() => release.resolve());
  const a = setup(async (url) => { if (url === '/auth/logout') { entered.resolve(); await release.promise; throw new TypeError('offline'); } return json(url === '/accounts/me' ? me('A') : tokens('A')); }, { storage: shared, locks });
  await a.client.login('login', {});
  const leaving = a.client.logout();
  assert.equal(shared.entries.size, 1);
  await entered.promise;
  const b = setup(() => json(tokens('A')), { storage: shared, locks });
  const pending = assert.rejects(b.client.restore(true), (error) => error.code === 'LOGOUT_PENDING');
  release.resolve();
  await Promise.all([leaving, pending]);
  assert.equal(b.calls.length, 0);
  a.client.dispose(); b.client.dispose();
});

test('signed-in identity replacement invalidates old work and exposes account A', async (t) => {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  t.after(() => release.resolve());
  const { client, control } = setup(async (url, init) => {
    if (url === '/auth/login') return json(tokens('B'));
    if (url === '/auth/refresh') return json(tokens('A'));
    if (url === '/old-work') { entered.resolve(); await release.promise; return json({ old: true }); }
    return json(me(init.headers.Authorization === 'Bearer access-A' ? 'A' : 'B'));
  });
  await client.login('login', {});
  const before = client.getSnapshot();
  const pending = client.fetch('/old-work');
  const rejected = assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
  await entered.promise;
  control.deliver('signed-in');
  for (let i = 0; i < 10 && client.getSnapshot().profile?.id !== 'A'; i++) await tick();
  assert.equal(client.getSnapshot().profile?.id, 'A');
  assert.ok(client.getSnapshot().sessionGeneration > before.sessionGeneration);
  release.resolve();
  await rejected;
  assert.equal(JSON.stringify(client.getSnapshot()).includes('access-'), false);
  client.dispose();
});

for (const retrySafeRead of [false, true]) {
  test(`401 POST renews but requires deliberate retry (retrySafeRead=${retrySafeRead})`, async () => {
    const { client, calls } = setup((url, init) => { if (url === '/auth/login') return json(tokens('A')); if (url === '/auth/refresh') return json(tokens('B')); if (url === '/accounts/me') return json(me('A')); return init.headers.Authorization === 'Bearer access-A' ? json({ message: 'Expired' }, 401) : json({ submitted: true }); });
    await client.login('login', {});
    await assert.rejects(client.fetch('/submit', { method: 'POST', json: {}, retrySafeRead }), (error) => error.code === 'RETRY_REQUIRED');
    assert.equal(calls.filter(({ url }) => url === '/submit').length, 1);
    assert.equal(client.getAccessToken(), 'access-B');
    client.dispose();
  });
}


test('a sibling logout intent appearing during restore prevents token installation', async () => {
  const shared = storage();
  const locks = serialLocks();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const a = setup(async (url) => { if (url === '/auth/refresh') { entered.resolve(); await release.promise; return json(tokens('A')); } return json(me('A')); }, { storage: shared, locks });
  const b = setup(() => { throw new TypeError('offline'); }, { storage: shared, locks });
  const pending = a.client.restore(true);
  const rejected = assert.rejects(pending, (error) => error.code === 'LOGOUT_PENDING');
  await entered.promise;
  const leaving = b.client.logout();
  release.resolve();
  await Promise.all([rejected, leaving]);
  assert.equal(a.client.getAccessToken(), null);
  a.client.dispose(); b.client.dispose();
});

test('a sibling logout intent appearing during login survives that older login result', async () => {
  const shared = storage();
  const locks = serialLocks();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const a = setup(async (url) => { if (url === '/auth/login') { entered.resolve(); await release.promise; return json(tokens('A')); } return json(me('A')); }, { storage: shared, locks });
  const b = setup(() => { throw new TypeError('offline'); }, { storage: shared, locks });
  const pending = a.client.login('login', {});
  const rejected = assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
  await entered.promise;
  const leaving = b.client.logout();
  release.resolve();
  await Promise.all([rejected, leaving]);
  assert.equal(a.client.getAccessToken(), null);
  assert.equal(a.client.getSnapshot().logoutPending, true);
  a.client.dispose(); b.client.dispose();
});

test('a replayed safe GET that still returns 401 expires the session', async () => {
  const { client, calls } = setup((url) => { if (url === '/auth/login' || url === '/auth/refresh') return json(tokens('A')); if (url === '/accounts/me') return json(me('A')); return json({ message: 'Expired' }, 401); });
  await client.login('login', {});
  await assert.rejects(client.fetch('/read', { retrySafeRead: true }), (error) => error.code === 'SESSION_EXPIRED');
  assert.equal(client.getSnapshot().status, 'anonymous');
  assert.equal(client.getAccessToken(), null);
  assert.equal(calls.filter(({ url }) => url === '/read').length, 2);
  client.dispose();
});


for (const operation of ['restore', 'token-renewed']) {
  for (const outcome of ['success', 'error']) {
    test(`late ${operation} profile ${outcome} cannot alter logout`, async () => {
      const entered = Promise.withResolvers();
      const release = Promise.withResolvers();
      let delayProfile = false;
      const { client, control } = setup(async (url) => {
        if (url === '/auth/logout') return new Response(null, { status: 204 });
        if (url === '/auth/login' || url === '/auth/refresh') return json(tokens('A'));
        if (delayProfile) { entered.resolve(); await release.promise; if (outcome === 'error') throw new TypeError('offline'); }
        return json(me('A'));
      });
      await client.login('login', {});
      delayProfile = true;
      let rejected;
      if (operation === 'restore') rejected = assert.rejects(client.restore(true), (error) => error.code === 'SESSION_CHANGED');
      else control.deliver('token-renewed');
      await entered.promise;
      await client.logout();
      const newer = client.getSnapshot();
      release.resolve();
      if (rejected) await rejected;
      await tick();
      assert.deepEqual(client.getSnapshot(), newer);
      assert.equal(client.getAccessToken(), null);
      client.dispose();
    });
  }
}

test('dispose invalidates a pending profile callback', async () => {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const { client, control } = setup(async (url) => { if (url === '/auth/login') return json(tokens('A')); entered.resolve(); await release.promise; return json(me('A')); });
  const pending = client.login('login', {});
  const rejected = assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
  await entered.promise;
  client.dispose();
  const disposed = client.getSnapshot();
  release.resolve();
  await rejected;
  assert.deepEqual(client.getSnapshot(), disposed);
  assert.deepEqual(control.posted, []);
});

test('a failed sibling logout blocks renewal of a retained token', async () => {
  const shared = storage();
  const locks = serialLocks();
  const a = setup((url) => { if (url === '/auth/login') return json(tokens('A')); if (url === '/accounts/me') return json(me('A')); return json({ message: 'Expired' }, 401); }, { storage: shared, locks });
  const b = setup(() => { throw new TypeError('offline'); }, { storage: shared, locks });
  await a.client.login('login', {});
  await b.client.logout();
  await assert.rejects(a.client.fetch('/read', { retrySafeRead: true }), (error) => error.code === 'LOGOUT_PENDING');
  assert.equal(a.calls.some(({ url }) => url === '/auth/refresh'), false);
  a.client.dispose(); b.client.dispose();
});

test('confirmed logout acknowledges its marker and allows a fresh anonymous bootstrap', async () => {
  const shared = storage();
  const a = setup((url) => url === '/auth/logout' ? new Response(null, { status: 204 }) : json(tokens('A')), { storage: shared });
  assert.deepEqual(await a.client.logout(), { serverConfirmed: true });
  assert.equal(a.client.getSnapshot().logoutPending, false);
  const b = setup(() => json({ message: 'Expired' }, 401), { storage: shared });
  assert.equal((await b.client.restore(true)).status, 'anonymous');
  a.client.dispose(); b.client.dispose();
});

test('an older confirmed logout cannot erase a newer failed logout marker', async () => {
  const shared = storage();
  const locks = serialLocks();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const a = setup(async () => { entered.resolve(); await release.promise; return new Response(null, { status: 204 }); }, { storage: shared, locks });
  const b = setup(() => { throw new TypeError('offline'); }, { storage: shared, locks });
  const leavingA = a.client.logout();
  await entered.promise;
  const leavingB = b.client.logout();
  release.resolve();
  assert.deepEqual(await leavingA, { serverConfirmed: true });
  assert.deepEqual(await leavingB, { serverConfirmed: false });
  assert.equal(a.client.getSnapshot().logoutPending, true);
  await assert.rejects(a.client.restore(true), (error) => error.code === 'LOGOUT_PENDING');
  a.client.dispose(); b.client.dispose();
});

test('default GET renews without replay and lets its caller retry deliberately', async () => {
  const { client, calls } = setup((url, init) => { if (url === '/auth/login') return json(tokens('A')); if (url === '/auth/refresh') return json(tokens('B')); if (url === '/accounts/me') return json(me('A')); return init.headers.Authorization === 'Bearer access-A' ? json({ message: 'Expired' }, 401) : json({ ok: true }); });
  await client.login('login', {});
  await assert.rejects(client.fetch('/read'), (error) => error.code === 'RETRY_REQUIRED');
  assert.equal(calls.filter(({ url }) => url === '/read').length, 1);
  assert.deepEqual(await client.fetch('/read'), { ok: true });
  client.dispose();
});


for (const confirmed of [true, false]) {
  test(`deliberate login queued after logout owns the final session (confirmed=${confirmed})`, async () => {
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    const shared = storage();
    const { client } = setup(async (url) => {
      if (url === '/auth/logout') { entered.resolve(); await release.promise; if (!confirmed) throw new TypeError('offline'); return new Response(null, { status: 204 }); }
      return json(url === '/accounts/me' ? me('B') : tokens('B'));
    }, { storage: shared });
    const leaving = client.logout();
    await entered.promise;
    const login = client.login('login', {});
    release.resolve();
    assert.deepEqual(await leaving, { serverConfirmed: confirmed });
    const current = await login;
    assert.equal(current.status, 'authenticated');
    assert.equal(current.profile.id, 'B');
    assert.equal(current.logoutPending, false);
    assert.equal(client.getAccessToken(), 'access-B');
    assert.ok(shared.entries.size <= 2);
    client.dispose();
  });
}


for (const operation of ['logout-confirmation', 'deliberate-login']) {
  test(`acknowledging ${operation} cannot erase a logout inserted at the storage boundary`, async () => {
    const shared = storage();
    const locks = serialLocks();
    let armed = false;
    let interleaved = false;
    let newerLogout;
    const originalGet = shared.getItem;
    const originalSet = shared.setItem;
    const interleave = () => {
      if (!armed || interleaved) return;
      interleaved = true; armed = false;
      newerLogout = b.client.logout();
    };
    shared.getItem = (key) => { const captured = originalGet(key); if (key === 'browser-auth:logout-pending') interleave(); return captured; };
    shared.setItem = (key, value) => { if (key === 'browser-auth:logout-acknowledged') interleave(); originalSet(key, value); };
    const b = setup(() => { throw new TypeError('offline'); }, { storage: shared, locks });
    const a = setup((url) => {
      if (url === '/auth/logout') { if (operation === 'deliberate-login') throw new TypeError('offline'); armed = true; return new Response(null, { status: 204 }); }
      return json(url === '/accounts/me' ? me('A') : tokens('A'));
    }, { storage: shared, locks });
    if (operation === 'deliberate-login') {
      await a.client.logout();
      a.client.subscribe(() => { if (a.client.getAccessToken() && !interleaved) armed = true; });
      await a.client.login('login', {});
    } else assert.deepEqual(await a.client.logout(), { serverConfirmed: true });
    assert.equal(interleaved, true);
    assert.deepEqual(await newerLogout, { serverConfirmed: false });
    const fresh = setup((url) => json(url === '/accounts/me' ? me('A') : tokens('A')), { storage: shared, locks });
    await assert.rejects(fresh.client.restore(true), (error) => error.code === 'LOGOUT_PENDING');
    assert.equal(fresh.calls.length, 0);
    a.client.dispose(); b.client.dispose(); fresh.client.dispose();
  });
}

test('login profile 401 and refresh 401 settle anonymous with its own expiry', async () => {
  const { client } = setup((url) => url === '/auth/login' ? json(tokens('A')) : json({ message: 'Expired' }, 401));
  await assert.rejects(client.login('login', {}), (error) => error.code === 'SESSION_EXPIRED');
  assert.equal(client.getSnapshot().status, 'anonymous');
  assert.equal(client.getSnapshot().profile, null);
  assert.equal(client.getAccessToken(), null);
  client.dispose();
});

test('login own expiry superseded synchronously by newer login cannot map its status', async () => {
  const store = createMemorySession();
  let logins = 0;
  const { client } = setup((url, init) => {
    if (url === '/auth/login') return json(tokens(++logins === 1 ? 'A' : 'B'));
    if (url === '/auth/refresh' || init.headers.Authorization === 'Bearer access-A') return json({ message: 'Expired' }, 401);
    return json(me('B'));
  }, { store });
  let newer;
  store.subscribe((_session, reason) => { if (reason && !newer) newer = client.login('login', {}); });
  await assert.rejects(client.login('login', {}), (error) => error.code === 'SESSION_CHANGED');
  assert.ok(newer);
  const expected = await newer;
  assert.equal(expected.status, 'authenticated');
  assert.equal(expected.profile.id, 'B');
  assert.deepEqual(client.getSnapshot(), expected);
  assert.equal(client.getAccessToken(), 'access-B');
  client.dispose();
});


for (const newerConfirmed of [true, false]) {
  test(`reversed logout cookie queue preserves latest intent outcome (newerConfirmed=${newerConfirmed})`, async () => {
    const shared = storage();
    const locks = serialLocks();
    const order = [];
    const a = setup(() => { order.push('A'); return new Response(null, { status: 204 }); }, { storage: shared, locks });
    const b = setup(() => { order.push('B'); if (!newerConfirmed) throw new TypeError('offline'); return new Response(null, { status: 204 }); }, { storage: shared, locks });
    let leavingB;
    a.client.subscribe((snapshot) => { if (snapshot.status === 'anonymous' && !leavingB) leavingB = b.client.logout(); });
    const leavingA = a.client.logout();
    assert.deepEqual(await leavingA, { serverConfirmed: true });
    assert.deepEqual(await leavingB, { serverConfirmed: newerConfirmed });
    assert.deepEqual(order, ['B', 'A']);
    const fresh = setup((url) => json(url === '/accounts/me' ? me('A') : tokens('A')), { storage: shared, locks });
    if (newerConfirmed) assert.equal((await fresh.client.restore(true)).status, 'authenticated');
    else { await assert.rejects(fresh.client.restore(true), (error) => error.code === 'LOGOUT_PENDING'); assert.equal(fresh.calls.length, 0); }
    a.client.dispose(); b.client.dispose(); fresh.client.dispose();
  });
}
