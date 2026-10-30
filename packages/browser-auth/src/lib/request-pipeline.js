// Request pipeline seam: handles request dispatch, authentication injection,
// opt-in safe-read retries, 401 renewal recovery, and deliberate retry enforcement.

import { ApiError, changedSession, expiredSession } from './errors.js';

const SESSION_LOCK = 'browser-auth:session';
const RETRIABLE_NETWORK = 0;

const isSafeMethod = (method) => method === 'GET' || method === 'HEAD';

const isRetriable = (error) =>
  error instanceof ApiError && (error.status === RETRIABLE_NETWORK || error.status >= 500);

function assertCurrent(isActive, store, generation) {
  if (!isActive() || store.generation() !== generation) throw changedSession();
}

function shouldRetrySafeRead(options, method, error) {
  return (
    Boolean(options.retrySafeRead) &&
    isSafeMethod(method) &&
    isRetriable(error) &&
    !options.signal?.aborted
  );
}

function resolveToken(session, store) {
  if (!session) return undefined;
  return store.read()?.accessToken ?? session.accessToken;
}

async function retrySafeRead({
  send,
  store,
  isActive,
  path,
  options,
  session,
  method,
  error,
}) {
  if (!shouldRetrySafeRead(options, method, error)) {
    throw error;
  }
  const token = resolveToken(session, store);
  const generation = store.generation();
  try {
    const result = await send(path, options, token);
    assertCurrent(isActive, store, generation);
    return result;
  } catch (retryError) {
    assertCurrent(isActive, store, generation);
    throw retryError;
  }
}

async function retryAfterRenew({
  send,
  store,
  isActive,
  session,
  refreshed,
  path,
  options,
  method,
  generation,
}) {
  if (options.signal?.aborted) throw options.signal.reason;
  if (store.read()?.sessionKey !== session.sessionKey) throw changedSession();
  if (!options.retrySafeRead || !isSafeMethod(method)) {
    throw new ApiError(
      'Your session was renewed. Please retry this action deliberately.',
      401,
      undefined,
      'RETRY_REQUIRED',
    );
  }

  try {
    const result = await send(path, options, refreshed.accessToken);
    assertCurrent(isActive, store, generation);
    return result;
  } catch (retryError) {
    assertCurrent(isActive, store, generation);
    if (retryError.status === 401) {
      store.clear(session.sessionKey, 'Your session expired. Please sign in again.');
      throw expiredSession();
    }
    throw retryError;
  }
}

function resolveRequestSession(options, store) {
  if (options.auth === false) return null;
  const session = store.read();
  if (!session) throw expiredSession('Please sign in to continue.');
  return session;
}

async function executeRequest({
  send,
  renew,
  store,
  withSessionLock,
  isActive,
  path,
  options,
}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const generation = store.generation();
  assertCurrent(isActive, store, generation);

  const session = resolveRequestSession(options, store);
  const attempt = (token) => send(path, options, token);
  const work = () => attempt(session?.accessToken);

  try {
    const result = await (options.cookieSession ? withSessionLock(work) : work());
    assertCurrent(isActive, store, generation);
    return result;
  } catch (error) {
    assertCurrent(isActive, store, generation);
    if (error.status !== 401 || !session || options.signal?.aborted) {
      return retrySafeRead({
        send,
        store,
        isActive,
        path,
        options,
        session,
        method,
        error,
      });
    }

    const refreshed = await renew(session);
    assertCurrent(isActive, store, generation);

    return retryAfterRenew({
      send,
      store,
      isActive,
      session,
      refreshed,
      path,
      options,
      method,
      generation,
    });
  }
}

export function createRequestPipeline({
  transport,
  lifecycle,
  store,
  locks,
  isActive = () => true,
}) {
  const send = transport;
  const renew = lifecycle.renew;

  const withSessionLock = (work) =>
    locks?.request ? locks.request(SESSION_LOCK, work) : work();

  function request(path, options = {}) {
    return executeRequest({
      send,
      renew,
      store,
      withSessionLock,
      isActive,
      path,
      options,
    });
  }

  return request;
}
