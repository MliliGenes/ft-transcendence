import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionStore, consumeOAuthReturn, TOKEN_KEY } from '../src/lib/session.js';
import { createApiClient } from '../src/lib/api-client.js';
import { profilePatch, toProfileForm, passwordError, imageError, mediaUrl } from '../src/lib/account.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const tokens = (n) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}` });
const unauthorized = () => json({ message: 'Expired' }, 401);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function browserLocks() {
  let tail = Promise.resolve();
  return { request: (_name, fn) => { const promise = tail.then(fn); tail = promise.catch(() => {}); return promise; } };
}

test('OAuth tokens replace an existing session and are removed from the URL first', () => {
  const store = createSessionStore(memoryStorage());
  store.replace(tokens('old'));
  let cleanUrl;
  const notice = consumeOAuthReturn({ hash: '#accessToken=new-access&refreshToken=new-refresh', pathname: '/', search: '?x=1' }, { replaceState: (_, __, url) => { cleanUrl = url; } }, store);
  assert.equal(store.read().accessToken, 'new-access');
  assert.equal(cleanUrl, '/?x=1');
  assert.equal(notice.type, 'success');
});

test('partial OAuth callback is scrubbed without replacing a valid session; linking does not replace it', () => {
  const store = createSessionStore(memoryStorage());
  const original = store.replace(tokens('original'));
  let cleared = 0;
  const history = { replaceState: () => cleared++ };
  const location = { pathname: '/', search: '', hash: '#accessToken=incomplete' };
  assert.equal(consumeOAuthReturn(location, history, store).type, 'error');
  assert.deepEqual(store.read(), original);
  location.hash = '#providerLinked=discord';
  assert.equal(consumeOAuthReturn(location, history, store).type, 'success');
  assert.deepEqual(store.read(), original);
  assert.equal(cleared, 2);
});

test('corrupt storage is ignored and unavailable storage supports an in-memory session', () => {
  const storage = memoryStorage(); storage.setItem(TOKEN_KEY, 'invalid json');
  assert.equal(createSessionStore(storage).read(), null);
  const unavailable = createSessionStore({ getItem: () => null, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
  unavailable.replace(tokens(1));
  assert.equal(unavailable.read().accessToken, 'access-1');
  unavailable.clear();
  assert.equal(unavailable.read(), null);
});

test('simultaneous 401s share one refresh and each request retries only once', async () => {
  const store = createSessionStore(memoryStorage()); store.replace(tokens(1));
  let refreshes = 0, resourceCalls = 0;
  const client = createApiClient({ baseUrl: 'https://api.test', store, locks: browserLocks(), fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; await wait(10); return json(tokens(2)); }
    resourceCalls++;
    return options.headers.Authorization === 'Bearer access-2' ? json({ id: 1 }) : unauthorized();
  } });
  const result = await Promise.all([client.request('/accounts/me'), client.request('/accounts/me'), client.request('/accounts/me')]);
  assert.deepEqual(result, [{ id: 1 }, { id: 1 }, { id: 1 }]);
  assert.equal(refreshes, 1); assert.equal(resourceCalls, 6);
  assert.equal(store.read().refreshToken, 'refresh-2');
});

test('separate tabs reread shared storage under a browser lock before refreshing', async () => {
  const storage = memoryStorage(), locks = browserLocks();
  const a = createSessionStore(storage), b = createSessionStore(storage);
  a.replace(tokens(1)); let refreshes = 0;
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; await wait(10); return json(tokens(2)); }
    return options.headers.Authorization === 'Bearer access-2' ? json({ ok: true }) : unauthorized();
  };
  await Promise.all([createApiClient({ baseUrl: '', store: a, fetchImpl, locks }).request('/accounts/me'), createApiClient({ baseUrl: '', store: b, fetchImpl, locks }).request('/accounts/me')]);
  assert.equal(refreshes, 1);
  assert.equal(b.read().refreshToken, 'refresh-2');
});

test('a rotated refresh token is recognized even if two JWT strings are identical', async () => {
  const store = createSessionStore(memoryStorage()); store.replace(tokens(1));
  let refreshes = 0, attempts = 0;
  const client = createApiClient({ baseUrl: '', store, locks: browserLocks(), fetchImpl: async (url) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return json({ accessToken: 'access-1', refreshToken: 'refresh-2' }); }
    attempts++;
    if (attempts <= 2) { await wait(attempts === 1 ? 1 : 15); return unauthorized(); }
    return json({ ok: true });
  } });
  await Promise.all([client.request('/accounts/me'), client.request('/accounts/me')]);
  assert.equal(refreshes, 1);
});

test('403, 404, server failures and ordinary network errors never trigger refresh or clear tokens', async () => {
  for (const status of [403, 404, 500, 0]) {
    const store = createSessionStore(memoryStorage()); const original = store.replace(tokens(1));
    let calls = 0;
    const client = createApiClient({ baseUrl: '', store, fetchImpl: async () => { calls++; if (!status) throw new TypeError('offline'); return json({ message: 'failure' }, status); } });
    await assert.rejects(client.request('/accounts/me'), (e) => e.status === status);
    assert.equal(calls, 1); assert.deepEqual(store.read(), original);
  }
});

test('logout during refresh cannot restore a session or retry the original request', async () => {
  const store = createSessionStore(memoryStorage()); store.replace(tokens(1));
  const ready = Promise.withResolvers(), finish = Promise.withResolvers();
  let resources = 0;
  const client = createApiClient({ baseUrl: '', store, fetchImpl: async (url) => {
    if (url.endsWith('/auth/refresh')) { ready.resolve(); await finish.promise; return json(tokens(2)); }
    resources++; return unauthorized();
  } });
  const pending = client.request('/accounts/me');
  await ready.promise; store.clear(); finish.resolve();
  await assert.rejects(pending, (e) => e.code === 'SESSION_CHANGED');
  assert.equal(store.read(), null); assert.equal(resources, 1);
});

test('a stale failed refresh cannot clear a newer login', async () => {
  const store = createSessionStore(memoryStorage()); store.replace(tokens(1));
  const ready = Promise.withResolvers(), finish = Promise.withResolvers();
  const client = createApiClient({ baseUrl: '', store, fetchImpl: async (url) => {
    if (url.endsWith('/auth/refresh')) { ready.resolve(); await finish.promise; return unauthorized(); }
    return unauthorized();
  } });
  const pending = client.request('/accounts/me');
  await ready.promise; const next = store.replace(tokens('new-login')); finish.resolve();
  await assert.rejects(pending);
  assert.deepEqual(store.read(), next);
});

test('failed or uncertain refresh ends the local session instead of replaying an old token', async () => {
  for (const failure of [401, 0]) {
    const store = createSessionStore(memoryStorage()); store.replace(tokens(1)); let refreshes = 0;
    const client = createApiClient({ baseUrl: '', store, fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) { refreshes++; if (!failure) throw new TypeError('response lost'); }
      return unauthorized();
    } });
    await assert.rejects(client.request('/accounts/me'), (e) => e.code === 'SESSION_EXPIRED');
    await assert.rejects(client.request('/accounts/me'));
    assert.equal(refreshes, 1); assert.equal(store.read(), null);
  }
});

test('JSON errors preserve all validation messages; 204 and FormData are handled correctly', async () => {
  const store = createSessionStore(memoryStorage()); store.replace(tokens(1));
  let received;
  const client = createApiClient({ baseUrl: '', store, fetchImpl: async (_url, options) => { received = options; return new Response(null, { status: 204 }); } });
  const body = new FormData(); body.append('file', new Blob(['image']), 'avatar.png');
  assert.equal(await client.request('/accounts/me/avatar', { method: 'PUT', body }), null);
  assert.equal(received.headers['Content-Type'], undefined);
  assert.equal(received.body, body);
  const invalid = createApiClient({ baseUrl: '', store, fetchImpl: async () => json({ message: ['Bad username', 'Bad email'] }, 400) });
  await assert.rejects(invalid.request('/accounts/me'), (e) => { assert.deepEqual(e.messages, ['Bad username', 'Bad email']); return true; });
});

test('profile updates send only edited fields and never forward protected fields', () => {
  const baseline = toProfileForm({ username: 'player', email: 'player@example.com', displayName: 'Original', firstName: null, lastName: null });
  assert.deepEqual(profilePatch(baseline, baseline), {});
  assert.deepEqual(profilePatch({ ...baseline, displayName: '', role: 'SUPERADMIN' }, baseline), { displayName: null });
  assert.deepEqual(profilePatch({ ...baseline, firstName: 'Ada' }, baseline), { firstName: 'Ada' });
});

test('password byte bounds, upload limits and safe media URLs match the interface contract', () => {
  assert.ok(passwordError('short', true)); assert.equal(passwordError('short', false), '');
  assert.ok(passwordError('😀'.repeat(20), true)); assert.equal(passwordError('valid password', true), '');
  assert.ok(imageError({ type: 'image/svg+xml', size: 20 }, 'avatar'));
  assert.ok(imageError({ type: 'image/png', size: 2 * 1024 * 1024 }, 'avatar'));
  assert.equal(imageError({ type: 'image/png', size: 100 }, 'avatar'), '');
  assert.equal(mediaUrl('javascript:alert(1)', 'https://api.test'), null);
  assert.equal(mediaUrl('/accounts/id/avatar', 'https://api.test', 2), 'https://api.test/accounts/id/avatar?v=2');
});
