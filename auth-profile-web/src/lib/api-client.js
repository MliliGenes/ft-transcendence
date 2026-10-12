export class ApiError extends Error {
  constructor(message, status = 0, messages = [message], code = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.code = code;
  }
}

export function createApiClient({
  baseUrl,
  store,
  fetchImpl = fetch,
  locks,
  timeoutMs = 20000,
}) {
  let renewal = null;
  const lockName = 'auth-profile-session-refresh';
  const changedSession = () =>
    new ApiError(
      'Your session changed. Please try again.',
      401,
      undefined,
      'SESSION_CHANGED',
    );

  const withSessionLock = (work) =>
    locks?.request ? locks.request(lockName, work) : work();

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
      const response = await fetchImpl(`${baseUrl}${path}`, {
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

  async function restoreSession(force = false) {
    return withSessionLock(async () => {
      if (!force && store.read()) return store.read();
      const tokens = await send('/auth/refresh', { method: 'POST', auth: false });
      return store.replace(tokens);
    });
  }

  async function renew(failedSession) {
    const current = store.read();
    if (!current || current.sessionKey !== failedSession.sessionKey)
      throw changedSession();
    if (current.accessToken !== failedSession.accessToken) return current;
    if (renewal?.sessionKey === current.sessionKey) return renewal.promise;
    const work = async () => {
      const latest = store.read();
      if (!latest || latest.sessionKey !== failedSession.sessionKey)
        throw changedSession();
      if (latest.accessToken !== failedSession.accessToken) return latest;
      try {
        const tokens = await send('/auth/refresh', { method: 'POST', auth: false });
        const updated = store.rotate(tokens, latest);
        if (!updated) throw changedSession();
        return updated;
      } catch (error) {
        if (error.code === 'SESSION_CHANGED') throw error;
        const message =
          error.status === 401
            ? 'Your session expired. Please sign in again.'
            : 'Session renewal could not be confirmed. Please sign in again.';
        store.clear(latest.sessionKey, message);
        throw new ApiError(message, 401, undefined, 'SESSION_EXPIRED');
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
    const session = options.auth === false ? null : store.read();
    if (options.auth !== false && !session)
      throw new ApiError(
        'Please sign in to continue.',
        401,
        undefined,
        'SESSION_EXPIRED',
      );
    const work = () => send(path, options, session?.accessToken);
    try {
      return await (options.cookieSession ? withSessionLock(work) : work());
    } catch (error) {
      if (error.status !== 401 || !session || options.signal?.aborted)
        throw error;
      const refreshed = await renew(session);
      if (options.signal?.aborted) throw options.signal.reason;
      if (store.read()?.sessionKey !== session.sessionKey)
        throw changedSession();
      try {
        return await send(path, options, refreshed.accessToken);
      } catch (retryError) {
        if (retryError.status === 401)
          store.clear(
            session.sessionKey,
            'Your session expired. Please sign in again.',
          );
        throw retryError;
      }
    }
  }

  return { request, restoreSession };
}
