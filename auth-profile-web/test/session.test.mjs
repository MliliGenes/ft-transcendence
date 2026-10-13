import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSessionStore,
  consumeOAuthReturn,
  clearLegacySession,
  LEGACY_TOKEN_KEY,
} from '../src/lib/session.js';
import { createApiClient } from '../src/lib/api-client.js';
import {
  profilePatch,
  toProfileForm,
  passwordError,
  imageError,
  mediaUrl,
} from '../src/lib/account.js';

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const session = (n) => ({ accessToken: `access-${n}` });
const unauthorized = () => json({ message: 'Expired' }, 401);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function browserLocks() {
  let tail = Promise.resolve();
  return {
    request: (_name, fn) => {
      const promise = tail.then(fn);
      tail = promise.catch(() => {});
      return promise;
    },
  };
}
function history() {
  const calls = [];
  return {
    calls,
    replaceState: (_, __, url) => {
      calls.push(url);
    },
  };
}

test('the session store is memory-only and hands out unique session keys', () => {
  const store = createSessionStore();
  const first = store.replace(session(1));
  const second = store.replace(session(1));
  assert.equal(typeof first.sessionKey, 'string');
  assert.notEqual(first.sessionKey, second.sessionKey);
  assert.deepEqual(store.read(), second);
  assert.equal(store.read().refreshToken, undefined);
  assert.throws(() => store.replace({}), /incomplete session/);
  assert.throws(() => store.replace({ refreshToken: 'refresh-1' }), /incomplete session/);
});

test('rotation only applies to the session that observed the 401', () => {
  const store = createSessionStore();
  const current = store.replace(session(1));
  const rotated = store.rotate(session(2), current);
  assert.equal(rotated.accessToken, 'access-2');
  assert.equal(rotated.sessionKey, current.sessionKey);
  assert.deepEqual(store.read(), rotated);
  assert.equal(store.rotate(session(3), current), null);
  assert.equal(
    store.rotate(session(3), { ...current, accessToken: 'stale' }),
    null,
  );
  assert.throws(() => store.rotate({}, rotated), /incomplete session/);
});

test('clearing targets one session and notifies listeners with a reason', () => {
  const store = createSessionStore();
  const seen = [];
  const stop = store.subscribe((value, reason) => seen.push([value, reason]));
  const current = store.replace(session(1));
  store.clear('another-key', 'nope');
  assert.deepEqual(store.read(), current);
  store.clear(current.sessionKey, 'Signed out.');
  assert.equal(store.read(), null);
  assert.deepEqual(seen.at(-1), [null, 'Signed out.']);
  stop();
  store.replace(session(2));
  assert.equal(seen.length, 2);
});

test('legacy script-readable credentials are removed on startup', () => {
  const map = new Map([[LEGACY_TOKEN_KEY, '{"accessToken":"old"}']]);
  globalThis.window = {
    localStorage: {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
      removeItem: (key) => map.delete(key),
    },
  };
  try {
    clearLegacySession();
    assert.equal(map.get(LEGACY_TOKEN_KEY), undefined);
    clearLegacySession();
  } finally {
    delete globalThis.window;
  }
});

test('OAuth errors are scrubbed and report safe messages without touching the session', () => {
  const store = createSessionStore();
  const original = store.replace(session('existing'));
  const seen = history();
  const notice = consumeOAuthReturn(
    { hash: '#oauthError=conflict&oauthFlow=link', pathname: '/', search: '' },
    seen,
  );
  assert.deepEqual(seen.calls, ['/']);
  assert.equal(notice.type, 'error');
  assert.match(notice.text, /already linked/);
  assert.deepEqual(store.read(), original);
  const loginConflict = consumeOAuthReturn(
    { hash: '#oauthError=conflict', pathname: '/', search: '' },
    history(),
  );
  assert.match(loginConflict.text, /already in use/);
});

test('OAuth token fragments are rejected because sessions are cookie-only', () => {
  const store = createSessionStore();
  const original = store.replace(session('old'));
  const seen = history();
  const notice = consumeOAuthReturn(
    {
      hash: '#accessToken=new-access&refreshToken=new-refresh',
      pathname: '/',
      search: '?x=1',
    },
    seen,
  );
  assert.deepEqual(seen.calls, ['/?x=1']);
  assert.equal(notice.type, 'error');
  assert.match(notice.text, /sign in again/);
  assert.deepEqual(store.read(), original);
  const partial = consumeOAuthReturn(
    { hash: '#accessToken=incomplete', pathname: '/', search: '' },
    history(),
  );
  assert.equal(partial.type, 'error');
  assert.deepEqual(store.read(), original);
});

test('provider linking succeeds without replacing the session; empty fragments are ignored', () => {
  const store = createSessionStore();
  const original = store.replace(session('original'));
  const seen = history();
  const linked = consumeOAuthReturn(
    { hash: '#providerLinked=discord', pathname: '/', search: '' },
    seen,
  );
  assert.equal(linked.type, 'success');
  assert.match(linked.text, /connected successfully/);
  assert.deepEqual(store.read(), original);
  const idle = history();
  assert.equal(
    consumeOAuthReturn({ hash: '', pathname: '/', search: '' }, idle),
    null,
  );
  assert.deepEqual(idle.calls, []);
  assert.deepEqual(seen.calls, ['/']);
});

test('restoreSession uses the HttpOnly cookie and caches the in-memory session', async () => {
  const store = createSessionStore();
  let refreshes = 0;
  const seen = [];
  const client = createApiClient({
    baseUrl: '',
    store,
    locks: browserLocks(),
    fetchImpl: async (url, options) => {
      refreshes++;
      seen.push(options);
      assert.ok(url.endsWith('/auth/refresh'));
      return json(session(1));
    },
  });
  const restored = await client.restoreSession();
  assert.equal(restored.accessToken, 'access-1');
  assert.deepEqual(store.read(), restored);
  assert.equal((await client.restoreSession()).sessionKey, restored.sessionKey);
  assert.equal(refreshes, 1);
  assert.equal(seen[0].credentials, 'include');
  assert.equal(seen[0].body, undefined);
  assert.equal(await client.restoreSession(true).then((s) => s.accessToken), 'access-1');
  assert.equal(refreshes, 2);
});

test('simultaneous 401s share one cookie refresh and each request retries only once', async () => {
  const store = createSessionStore();
  store.replace(session(1));
  let refreshes = 0,
    resourceCalls = 0;
  const client = createApiClient({
    baseUrl: 'https://api.test',
    store,
    locks: browserLocks(),
    fetchImpl: async (url, options) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        await wait(10);
        return json(session(2));
      }
      resourceCalls++;
      return options.headers.Authorization === 'Bearer access-2'
        ? json({ id: 1 })
        : unauthorized();
    },
  });
  const result = await Promise.all([
    client.request('/accounts/me'),
    client.request('/accounts/me'),
    client.request('/accounts/me'),
  ]);
  assert.deepEqual(result, [{ id: 1 }, { id: 1 }, { id: 1 }]);
  assert.equal(refreshes, 1);
  assert.equal(resourceCalls, 6);
  assert.equal(store.read().accessToken, 'access-2');
  assert.equal(store.read().refreshToken, undefined);
});

test('independent in-memory sessions never share a cookie refresh', async () => {
  const locks = browserLocks();
  const a = createSessionStore(),
    b = createSessionStore();
  a.replace(session(1));
  b.replace(session(1));
  let refreshes = 0;
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      await wait(10);
      return json(session(2));
    }
    return options.headers.Authorization === 'Bearer access-2'
      ? json({ ok: true })
      : unauthorized();
  };
  await Promise.all([
    createApiClient({ baseUrl: '', store: a, fetchImpl, locks }).request(
      '/accounts/me',
    ),
    createApiClient({ baseUrl: '', store: b, fetchImpl, locks }).request(
      '/accounts/me',
    ),
  ]);
  assert.equal(refreshes, 2);
  assert.equal(a.read().accessToken, 'access-2');
  assert.equal(b.read().accessToken, 'access-2');
  assert.notEqual(a.read().sessionKey, b.read().sessionKey);
});

test('a rotated session is recognized even if two access-token strings are identical', async () => {
  const store = createSessionStore();
  store.replace(session(1));
  let refreshes = 0,
    attempts = 0;
  const client = createApiClient({
    baseUrl: '',
    store,
    locks: browserLocks(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        // Overlapping 401s must share this single in-flight renewal even
        // though the rotated access-token string is identical.
        await wait(30);
        return json({ accessToken: 'access-1' });
      }
      attempts++;
      if (attempts <= 2) {
        await wait(attempts === 1 ? 1 : 15);
        return unauthorized();
      }
      return json({ ok: true });
    },
  });
  await Promise.all([
    client.request('/accounts/me'),
    client.request('/accounts/me'),
  ]);
  assert.equal(refreshes, 1);
});

test('403, 404, server failures and ordinary network errors never trigger refresh or clear the session', async () => {
  for (const status of [403, 404, 500, 0]) {
    const store = createSessionStore();
    const original = store.replace(session(1));
    let calls = 0;
    const client = createApiClient({
      baseUrl: '',
      store,
      fetchImpl: async () => {
        calls++;
        if (!status) throw new TypeError('offline');
        return json({ message: 'failure' }, status);
      },
    });
    await assert.rejects(
      client.request('/accounts/me'),
      (e) => e.status === status,
    );
    assert.equal(calls, 1);
    assert.deepEqual(store.read(), original);
  }
});

test('logout during refresh cannot restore a session or retry the original request', async () => {
  const store = createSessionStore();
  store.replace(session(1));
  const ready = Promise.withResolvers(),
    finish = Promise.withResolvers();
  let resources = 0;
  const client = createApiClient({
    baseUrl: '',
    store,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        ready.resolve();
        await finish.promise;
        return json(session(2));
      }
      resources++;
      return unauthorized();
    },
  });
  const pending = client.request('/accounts/me');
  await ready.promise;
  store.clear();
  finish.resolve();
  await assert.rejects(pending, (e) => e.code === 'SESSION_CHANGED');
  assert.equal(store.read(), null);
  assert.equal(resources, 1);
});

test('a stale failed refresh cannot clear a newer login', async () => {
  const store = createSessionStore();
  store.replace(session(1));
  const ready = Promise.withResolvers(),
    finish = Promise.withResolvers();
  const client = createApiClient({
    baseUrl: '',
    store,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        ready.resolve();
        await finish.promise;
        return unauthorized();
      }
      return unauthorized();
    },
  });
  const pending = client.request('/accounts/me');
  await ready.promise;
  const next = store.replace(session('new-login'));
  finish.resolve();
  await assert.rejects(pending);
  assert.deepEqual(store.read(), next);
});

test('a confirmed 401 refresh ends the local session instead of replaying an old token', async () => {
  const store = createSessionStore();
  store.replace(session(1));
  let refreshes = 0;
  const client = createApiClient({
    baseUrl: '',
    store,
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) refreshes++;
      return unauthorized();
    },
  });
  await assert.rejects(
    client.request('/accounts/me'),
    (e) => e.code === 'SESSION_EXPIRED',
  );
  await assert.rejects(client.request('/accounts/me'));
  assert.equal(refreshes, 1);
  assert.equal(store.read(), null);
});

test('an uncertain refresh retains the session as unavailable instead of expiring it', async () => {
  for (const failure of [0, 500]) {
    const store = createSessionStore();
    const original = store.replace(session(1));
    let refreshes = 0;
    const client = createApiClient({
      baseUrl: '',
      store,
      fetchImpl: async (url) => {
        if (url.endsWith('/auth/refresh')) {
          refreshes++;
          if (!failure) throw new TypeError('response lost');
          return json({ message: 'boom' }, failure);
        }
        return unauthorized();
      },
    });
    await assert.rejects(
      client.request('/accounts/me'),
      (e) => e.code === 'UNAVAILABLE',
    );
    assert.equal(refreshes, 1);
    assert.deepEqual(store.read()?.accessToken, original.accessToken);
  }
});

test('restore after logout never revives a cleared session', async () => {
  const store = createSessionStore();
  const ready = Promise.withResolvers(),
    finish = Promise.withResolvers();
  const client = createApiClient({
    baseUrl: '',
    store,
    locks: browserLocks(),
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        ready.resolve();
        await finish.promise;
        return json(session(2));
      }
      return unauthorized();
    },
  });
  const pending = client.restoreSession(true).catch((error) => error);
  await ready.promise;
  store.clear();
  finish.resolve();
  const result = await pending;
  assert.equal(result.code, 'SESSION_CHANGED');
  assert.equal(store.read(), null);
});

test('mutations are never replayed; safe reads retry once only with retrySafeRead', async () => {
  const store = createSessionStore();
  store.replace(session(1));
  let calls = 0;
  const client = createApiClient({
    baseUrl: '',
    store,
    fetchImpl: async () => {
      calls++;
      return json({ message: 'boom' }, 500);
    },
  });
  await assert.rejects(client.request('/accounts/me/password', { method: 'PATCH', json: {} }));
  assert.equal(calls, 1);
  await assert.rejects(client.request('/accounts/me'));
  assert.equal(calls, 2);
  await assert.rejects(client.request('/accounts/me', { retrySafeRead: true }));
  assert.equal(calls, 4);
  await assert.rejects(
    client.request('/accounts/me/password', { method: 'PATCH', json: {}, retrySafeRead: true }),
  );
  assert.equal(calls, 5);
  assert.deepEqual(store.read()?.accessToken, 'access-1');
});

test('JSON errors preserve all validation messages; 204 and FormData are handled correctly', async () => {
  const store = createSessionStore();
  store.replace(session(1));
  let received;
  const client = createApiClient({
    baseUrl: '',
    store,
    fetchImpl: async (_url, options) => {
      received = options;
      return new Response(null, { status: 204 });
    },
  });
  const body = new FormData();
  body.append('file', new Blob(['image']), 'avatar.png');
  assert.equal(
    await client.request('/accounts/me/avatar', { method: 'PUT', body }),
    null,
  );
  assert.equal(received.headers['Content-Type'], undefined);
  assert.equal(received.body, body);
  const invalid = createApiClient({
    baseUrl: '',
    store,
    fetchImpl: async () =>
      json({ message: ['Bad username', 'Bad email'] }, 400),
  });
  await assert.rejects(invalid.request('/accounts/me'), (e) => {
    assert.deepEqual(e.messages, ['Bad username', 'Bad email']);
    return true;
  });
});

test('profile updates send only edited fields and never forward protected fields', () => {
  const baseline = toProfileForm({
    username: 'player',
    email: 'player@example.com',
    displayName: 'Original',
    firstName: null,
    lastName: null,
  });
  assert.deepEqual(profilePatch(baseline, baseline), {});
  assert.deepEqual(
    profilePatch(
      { ...baseline, displayName: '', role: 'SUPERADMIN' },
      baseline,
    ),
    { displayName: null },
  );
  assert.deepEqual(profilePatch({ ...baseline, firstName: 'Ada' }, baseline), {
    firstName: 'Ada',
  });
});

test('password byte bounds, upload limits and safe media URLs match the interface contract', () => {
  assert.ok(passwordError('short', true));
  assert.equal(passwordError('short', false), '');
  assert.ok(passwordError('😀'.repeat(20), true));
  assert.equal(passwordError('valid password', true), '');
  assert.ok(imageError({ type: 'image/svg+xml', size: 20 }, 'avatar'));
  assert.ok(imageError({ type: 'image/png', size: 2 * 1024 * 1024 }, 'avatar'));
  assert.equal(imageError({ type: 'image/png', size: 100 }, 'avatar'), '');
  assert.equal(mediaUrl('javascript:alert(1)', 'https://api.test'), null);
  assert.equal(
    mediaUrl('/accounts/id/avatar', 'https://api.test', 2),
    'https://api.test/accounts/id/avatar?v=2',
  );
});
