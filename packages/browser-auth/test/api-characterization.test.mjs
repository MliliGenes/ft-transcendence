import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthApi, createMemorySession, ApiError } from '../src/client.js';

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

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
  };
}

const jsonResponse = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

test('HTTP transport: returns null on 204 No Content', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  const api = createAuthApi({
    apiBase: 'https://api.test/',
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.test/resource');
      return new Response(null, { status: 204 });
    },
    store,
    locks,
  });

  const result = await api.request('/resource', { auth: false });
  assert.equal(result, null);
});

test('HTTP transport: throws ApiError on non-204 null payload (invalid JSON)', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => new Response('not json at all', { status: 200 }),
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/test', { auth: false }),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 200);
      assert.equal(err.message, 'The server returned an unexpected response. Please try again.');
      return true;
    },
  );
});

test('HTTP transport: extracts array of error messages and fallbacks', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  let statusToReturn = 400;
  let bodyToReturn = { message: ['Error 1', 'Error 2'] };

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => jsonResponse(bodyToReturn, statusToReturn),
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/test', { auth: false }),
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.message, 'Error 1');
      assert.deepEqual(err.messages, ['Error 1', 'Error 2']);
      return true;
    },
  );

  statusToReturn = 502;
  bodyToReturn = {};
  await assert.rejects(
    () => api.request('/test', { auth: false }),
    (err) => {
      assert.equal(err.status, 502);
      assert.equal(err.message, 'The request could not be completed (502).');
      assert.deepEqual(err.messages, ['The request could not be completed (502).']);
      return true;
    },
  );
});

test('HTTP transport: headers and X-Requested-With policy', async () => {
  const store = createMemorySession();
  store.replace({ accessToken: 'initial-token' });
  const locks = serialLocks();
  const calls = [];

  const api = createAuthApi({
    apiBase: 'https://api.test/',
    fetchImpl: async (url, init) => {
      calls.push({ url, headers: init.headers, method: init.method, body: init.body });
      return jsonResponse({ ok: true });
    },
    store,
    locks,
  });

  // Safe GET request
  await api.request('/data');
  assert.equal(calls[0].url, 'https://api.test/data');
  assert.equal(calls[0].headers.Accept, 'application/json');
  assert.equal(calls[0].headers.Authorization, 'Bearer initial-token');
  assert.equal(calls[0].headers['X-Requested-With'], undefined);

  // Auth POST request carries X-Requested-With and Content-Type for json
  await api.request('/auth/custom', { method: 'POST', json: { foo: 'bar' } });
  assert.equal(calls[1].url, 'https://api.test/auth/custom');
  assert.equal(calls[1].headers['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(calls[1].headers['Content-Type'], 'application/json');
  assert.equal(calls[1].body, JSON.stringify({ foo: 'bar' }));
});

test('HTTP transport: maps network TypeError to ApiError with NETWORK code', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch');
    },
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/ping', { auth: false }),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 0);
      assert.equal(err.code, 'NETWORK');
      assert.equal(err.message, 'Unable to reach the service. Check your connection and try again.');
      return true;
    },
  );
});

test('HTTP transport: propagates abort signal immediately or during wait', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (_url, init) => {
      if (init.signal.aborted) {
        throw init.signal.reason;
      }
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(init.signal.reason);
        });
      });
    },
    store,
    locks,
  });

  // Pre-aborted controller
  const preAborted = new AbortController();
  preAborted.abort(new Error('Pre-aborted'));
  await assert.rejects(
    () => api.request('/test', { auth: false, signal: preAborted.signal }),
    (err) => {
      assert.equal(err.message, 'Pre-aborted');
      return true;
    },
  );

  // Aborted in flight
  const midFlight = new AbortController();
  const promise = api.request('/test', { auth: false, signal: midFlight.signal });
  midFlight.abort(new Error('Cancelled in flight'));
  await assert.rejects(promise, (err) => {
    assert.equal(err.message, 'Cancelled in flight');
    return true;
  });
});

test('Session lifecycle: restoreSession returns current when not forced, refreshes when forced', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  let refreshCalls = 0;

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        return jsonResponse({ accessToken: `token-${refreshCalls}` });
      }
      return jsonResponse({});
    },
    store,
    locks,
  });

  // First restore with no session in store -> refreshes and replaces
  const s1 = await api.restoreSession(false);
  assert.equal(s1.accessToken, 'token-1');
  assert.equal(refreshCalls, 1);

  // Second restore with unforced -> returns s1 without network call
  const s2 = await api.restoreSession(false);
  assert.equal(s2.accessToken, 'token-1');
  assert.equal(refreshCalls, 1);

  // Forced restore -> calls /auth/refresh and rotates
  const s3 = await api.restoreSession(true);
  assert.equal(s3.accessToken, 'token-2');
  assert.equal(refreshCalls, 2);
});

test('Session lifecycle: renew deduplicates concurrent calls for the same session', async () => {
  const store = createMemorySession();
  const session = store.replace({ accessToken: 'tok-1' });
  const locks = serialLocks();
  let refreshCalls = 0;

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse({ accessToken: 'tok-2' });
      }
      return jsonResponse({});
    },
    store,
    locks,
  });

  const [res1, res2] = await Promise.all([
    api.renew(session),
    api.renew(session),
  ]);

  assert.equal(refreshCalls, 1);
  assert.equal(res1.accessToken, 'tok-2');
  assert.equal(res2.accessToken, 'tok-2');
});

test('Session lifecycle: renew returns current session if store token already rotated', async () => {
  const store = createMemorySession();
  const session1 = store.replace({ accessToken: 'tok-1' });
  store.rotate({ accessToken: 'tok-2' }, session1);
  const locks = serialLocks();

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => jsonResponse({ accessToken: 'tok-3' }),
    store,
    locks,
  });

  // If failedSession is tok-1, but current store has tok-2, renew returns current immediately without calling refresh
  const res = await api.renew(session1);
  assert.equal(res.accessToken, 'tok-2');
});

test('Request pipeline: auth false allows unauthenticated requests', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  let authHeader = null;

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (_url, init) => {
      authHeader = init.headers.Authorization;
      return jsonResponse({ public: true });
    },
    store,
    locks,
  });

  const res = await api.request('/public', { auth: false });
  assert.deepEqual(res, { public: true });
  assert.equal(authHeader, undefined);
});

test('Request pipeline: request without auth throws SESSION_EXPIRED if store is empty', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => jsonResponse({}),
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/protected'),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'SESSION_EXPIRED');
      assert.equal(err.message, 'Please sign in to continue.');
      return true;
    },
  );
});

test('Request pipeline: cookieSession runs under session lock', async () => {
  const store = createMemorySession();
  store.replace({ accessToken: 'tok-1' });
  let lockAcquired = false;
  const locks = {
    async request(name, fn) {
      if (name === 'browser-auth:session') {
        lockAcquired = true;
      }
      return fn();
    },
  };

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => jsonResponse({ ok: true }),
    store,
    locks,
  });

  await api.request('/data', { cookieSession: true });
  assert.equal(lockAcquired, true);
});

test('Request pipeline: retry safe read retries after 500 error and propagates failure if retry fails', async () => {
  const store = createMemorySession();
  store.replace({ accessToken: 'tok-1' });
  const locks = serialLocks();
  let attempts = 0;

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => {
      attempts++;
      return jsonResponse({ message: 'Server down' }, 500);
    },
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/resource', { retrySafeRead: true }),
    (err) => {
      assert.equal(err.status, 500);
      assert.equal(attempts, 2); // Initial + 1 retry
      return true;
    },
  );
});

test('Request pipeline: renewed 401 retry fails with non-401 error', async () => {
  const store = createMemorySession();
  store.replace({ accessToken: 'tok-1' });
  const locks = serialLocks();
  let calls = 0;

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (url) => {
      calls++;
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse({ accessToken: 'tok-2' });
      }
      if (calls === 1) {
        return jsonResponse({ message: 'Expired' }, 401);
      }
      // On retry after refresh: returns 503 Service Unavailable
      return jsonResponse({ message: 'Gateway timeout' }, 503);
    },
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/items', { retrySafeRead: true }),
    (err) => {
      assert.equal(err.status, 503);
      assert.equal(err.message, 'Gateway timeout');
      return true;
    },
  );
});

test('Login & Logout operations: loginRequest replaces tokens and clears pending marker', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  const storage = memoryStorage();

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (url, init) => {
      if (url.endsWith('/auth/login')) {
        const body = JSON.parse(init.body);
        assert.equal(body.username, 'alice');
        return jsonResponse({ accessToken: 'alice-token' });
      }
      return jsonResponse({});
    },
    store,
    locks,
    storage,
  });

  // Mark pending
  api.markLogoutPending();
  assert.equal(api.isLogoutPending(), true);

  const session = await api.loginRequest('login', { username: 'alice' });
  assert.equal(session.accessToken, 'alice-token');
  assert.equal(api.isLogoutPending(), false);
});

test('Request pipeline: signal aborted after renewal before retry throws abort reason', async () => {
  const store = createMemorySession();
  store.replace({ accessToken: 'tok-1' });
  const locks = serialLocks();
  const controller = new AbortController();

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        controller.abort(new Error('Aborted post-refresh'));
        return jsonResponse({ accessToken: 'tok-2' });
      }
      return jsonResponse({ message: 'Expired' }, 401);
    },
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/data', { retrySafeRead: true, signal: controller.signal }),
    (err) => {
      assert.equal(err.message, 'Aborted post-refresh');
      return true;
    },
  );
});

test('Request pipeline: session changed after renewal before retry throws changedSession', async () => {
  const store = createMemorySession();
  store.replace({ accessToken: 'tok-1' });
  const locks = serialLocks();

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async (url) => {
      if (url.endsWith('/auth/refresh')) {
        store.replace({ accessToken: 'tok-other' });
        return jsonResponse({ accessToken: 'tok-2' });
      }
      return jsonResponse({ message: 'Expired' }, 401);
    },
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/data', { retrySafeRead: true }),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'SESSION_CHANGED');
      return true;
    },
  );
});

test('Request pipeline: auth false with retrySafeRead retries 500 without token', async () => {
  const store = createMemorySession();
  const locks = serialLocks();
  let calls = 0;

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return jsonResponse({ message: 'Server error' }, 500);
      return jsonResponse({ success: true });
    },
    store,
    locks,
  });

  const res = await api.request('/public-feed', { auth: false, retrySafeRead: true });
  assert.deepEqual(res, { success: true });
  assert.equal(calls, 2);
});

test('Request pipeline: generation change during request throws changedSession', async () => {
  const store = createMemorySession();
  store.replace({ accessToken: 'tok-1' });
  const locks = serialLocks();

  const api = createAuthApi({
    apiBase: 'https://api.test',
    fetchImpl: async () => {
      store.replace({ accessToken: 'tok-2' });
      return jsonResponse({ ok: true });
    },
    store,
    locks,
  });

  await assert.rejects(
    () => api.request('/data'),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'SESSION_CHANGED');
      return true;
    },
  );
});


