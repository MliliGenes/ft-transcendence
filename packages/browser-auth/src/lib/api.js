// Cookie-session HTTP layer: one origin-wide lock serializes every
// session-mutating call; ordinary fetches never replay (a single opt-in
// retry exists for safe reads only). A 401 renews once under the lock and
// may retry an opted-in safe read once; a confirmed 401 renewal ends the session, while a network /
// 5xx / timeout failure retains it as unavailable.

import { createLogoutIntent } from './logout-intent.js';

export class ApiError extends Error {
  constructor(message, status = 0, messages = [message], code = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.code = code;
  }
}

const SESSION_LOCK = 'browser-auth:session';
const RETRIABLE_NETWORK = 0;
const isSafeMethod = (method) => method === 'GET' || method === 'HEAD';
const isRetriable = (error) =>
  error instanceof ApiError && (error.status === RETRIABLE_NETWORK || error.status >= 500);

export function changedSession() {
  return new ApiError(
    'Your session changed. Please try again.',
    401,
    undefined,
    'SESSION_CHANGED',
  );
}

export function expiredSession(message = 'Your session expired. Please sign in again.') {
  return new ApiError(message, 401, undefined, 'SESSION_EXPIRED');
}

export function unavailableSession(error) {
  const status = error instanceof ApiError ? error.status : 0;
  return new ApiError(
    'The service could not be reached. Your session is kept and will resume.',
    status,
    undefined,
    'UNAVAILABLE',
  );
}

export function createAuthApi({
  apiBase,
  fetchImpl = fetch,
  store,
  locks,
  clock = Date,
  timeoutMs = 20000,
  storage = globalThis.localStorage,
  isActive = () => true,
}) {
  void clock;
  const base = String(apiBase ?? '').replace(/\/$/, '');
  let renewal = null;
  const logoutIntent = createLogoutIntent(storage);
  const assertCurrent = (generation) => {
    if (!isActive() || store.generation() !== generation) throw changedSession();
  };
  const requireRestoreAllowed = () => {
    if (logoutIntent.isPending())
      throw new ApiError('You are signed out on this browser. Please sign in again.', 401, undefined, 'LOGOUT_PENDING');
  };

  const withSessionLock = (work) =>
    locks?.request ? locks.request(SESSION_LOCK, work) : work();

  async function send(
    path,
    { method = 'GET', json, body, signal, credentials = 'include' } = {},
    accessToken,
  ) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { Accept: 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      if (json !== undefined) headers['Content-Type'] = 'application/json';
      if (path.startsWith('/auth/') && method !== 'GET')
        headers['X-Requested-With'] = 'XMLHttpRequest';
      // Origin/Referer are forbidden headers: the browser attaches them
      // automatically to same-origin credentialed requests, so cookie
      // endpoints must not suppress them (never `referrer: 'no-referrer'`).
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : body,
        credentials,
        signal: controller.signal,
      });
      const payload =
        response.status === 204
          ? null
          : await response.json().catch(() => null);
      if (!response.ok) {
        const messages = (
          Array.isArray(payload?.message) ? payload.message : [payload?.message]
        ).filter((s) => typeof s === 'string');
        const message =
          messages[0] ||
          `The request could not be completed (${response.status}).`;
        throw new ApiError(
          message,
          response.status,
          messages.length ? messages : [message],
        );
      }
      if (response.status !== 204 && payload === null)
        throw new ApiError(
          'The server returned an unexpected response. Please try again.',
          response.status,
        );
      return payload;
    } catch (error) {
      if (signal?.aborted) throw signal.reason || error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Unable to reach the service. Check your connection and try again.',
        0,
        undefined,
        'NETWORK',
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  // Refresh-cookie restore that never revives a cleared session: the
  // generation is captured before the network call and a changed epoch (a
  // logout or a newer login) rejects the late result instead of replacing.
  async function restoreSession(force = false) {
    const invocation = store.generation();
    return withSessionLock(async () => {
      assertCurrent(invocation);
      requireRestoreAllowed();
      const before = store.read();
      if (!force && before) return before;
      const generation = store.generation();
      let tokens;
      try {
        tokens = await send('/auth/refresh', { method: 'POST' });
      } catch (error) {
        assertCurrent(generation);
        requireRestoreAllowed();
        if (error.status === 401 && before) store.clear(before.sessionKey);
        throw error;
      }
      assertCurrent(generation);
      requireRestoreAllowed();
      const after = store.read();
      if (after && after.sessionKey !== before?.sessionKey) return after;
      if (!after) return store.replace(tokens);
      const rotated = store.rotate(tokens, before);
      if (!rotated) throw changedSession();
      return rotated;
    });
  }

  async function renew(failedSession) {
    const current = store.read();
    if (!current || current.sessionKey !== failedSession.sessionKey)
      throw changedSession();
    if (current.accessToken !== failedSession.accessToken) return current;
    if (renewal?.sessionKey === current.sessionKey) return renewal.promise;
    const work = async () => {
      requireRestoreAllowed();
      if (!isActive()) throw changedSession();
      const latest = store.read();
      if (!latest || latest.sessionKey !== failedSession.sessionKey)
        throw changedSession();
      if (latest.accessToken !== failedSession.accessToken) return latest;
      const generation = store.generation();
      try {
        const tokens = await send('/auth/refresh', { method: 'POST' });
        assertCurrent(generation);
        requireRestoreAllowed();
        const updated = store.rotate(tokens, latest);
        if (!updated) throw changedSession();
        return updated;
      } catch (error) {
        if (error.code === 'SESSION_CHANGED') throw error;
        assertCurrent(generation);
        requireRestoreAllowed();
        if (error.status === 401) {
          store.clear(latest.sessionKey, 'Your session expired. Please sign in again.');
          throw expiredSession();
        }
        // Outage, 5xx, or timeout: keep the token, report unavailable. A
        // lost renewal response must not expire a session that may still be
        // valid (the server rotates on use; a retry with the old cookie 401s
        // and only then does the session end).
        throw unavailableSession(error);
      }
    };
    const promise = withSessionLock(work);
    renewal = { sessionKey: current.sessionKey, promise };
    try {
      return await promise;
    } finally {
      if (renewal?.promise === promise) renewal = null;
    }
  }

  async function request(path, options = {}) {
    const method = (options.method ?? 'GET').toUpperCase();
    const generation = store.generation();
    assertCurrent(generation);
    const session = options.auth === false ? null : store.read();
    if (options.auth !== false && !session)
      throw expiredSession('Please sign in to continue.');
    const attempt = (token) => send(path, options, token);
    const work = () => attempt(session?.accessToken);
    try {
      const result = await (options.cookieSession ? withSessionLock(work) : work());
      assertCurrent(generation);
      return result;
    } catch (error) {
      assertCurrent(generation);
      if (error.status !== 401 || !session || options.signal?.aborted)
        return retrySafeRead(path, options, session, method, error);
      const refreshed = await renew(session);
      assertCurrent(generation);
      if (options.signal?.aborted) throw options.signal.reason;
      if (store.read()?.sessionKey !== session.sessionKey)
        throw changedSession();
      if (!options.retrySafeRead || !isSafeMethod(method))
        throw new ApiError('Your session was renewed. Please retry this action deliberately.', 401, undefined, 'RETRY_REQUIRED');
      try {
        const result = await attempt(refreshed.accessToken);
        assertCurrent(generation);
        return result;
      } catch (retryError) {
        assertCurrent(generation);
        if (retryError.status === 401) {
          store.clear(
            session.sessionKey,
            'Your session expired. Please sign in again.',
          );
          throw expiredSession();
        }
        throw retryError;
      }
    }
  }

  // Default: no replay. Exactly one retry, only for safe reads that opt in.
  async function retrySafeRead(path, options, session, method, error) {
    if (
      !options.retrySafeRead ||
      !isSafeMethod(method) ||
      !isRetriable(error) ||
      options.signal?.aborted
    )
      throw error;
    const token = session ? store.read()?.accessToken ?? session.accessToken : undefined;
    const generation = store.generation();
    try {
      const result = await send(path, options, token);
      assertCurrent(generation);
      return result;
    } catch (retryError) {
      assertCurrent(generation);
      throw retryError;
    }
  }

  async function loginRequest(mode, values) {
    const generation = store.generation();
    const marker = logoutIntent.readMarker();
    const assertIntent = () => {
      assertCurrent(generation);
      const currentMarker = logoutIntent.readMarker();
      // A prior logout may finish before this queued deliberate login; only
      // a newer outstanding intent supersedes the login.
      if (currentMarker !== null && currentMarker !== marker) throw changedSession();
    };
    return withSessionLock(async () => {
      assertIntent();
      let tokens;
      try {
        tokens = await send(`/auth/${mode}`, { method: 'POST', json: values });
      } catch (error) {
        assertIntent();
        throw error;
      }
      assertIntent();
      const session = store.replace(tokens);
      logoutIntent.acknowledge(marker);
      return session;
    });
  }

  async function logoutRequest(marker = logoutIntent.markPending()) {
    return withSessionLock(async () => {
      await send('/auth/logout', { method: 'POST' });
      // Only this operation's intent ID is acknowledged; a newer ID stays pending.
      logoutIntent.acknowledge(marker);
    });
  }

  return {
    request,
    restoreSession,
    renew,
    loginRequest,
    logoutRequest,
    isLogoutPending: () => logoutIntent.isPending(),
    markLogoutPending: () => logoutIntent.markPending(),
  };
}
