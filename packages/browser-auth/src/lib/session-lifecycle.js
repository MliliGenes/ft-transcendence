// Session lifecycle seam: handles session restoration and background renewal under
// the shared session lock, ensuring generation consistency and logout-intent gating.

import { ApiError, changedSession, expiredSession, unavailableSession } from './errors.js';

const SESSION_LOCK = 'browser-auth:session';

function applyRestoreSuccess(store, tokens, before) {
  const after = store.read();
  if (after && after.sessionKey !== before?.sessionKey) return after;
  if (!after) return store.replace(tokens);
  const rotated = store.rotate(tokens, before);
  if (!rotated) throw changedSession();
  return rotated;
}

function handleRenewFailure(error, store, latest) {
  if (error.status === 401) {
    store.clear(latest.sessionKey, 'Your session expired. Please sign in again.');
    throw expiredSession();
  }
  throw unavailableSession(error);
}

function checkSessionMatch(session, expected) {
  if (!session || session.sessionKey !== expected.sessionKey) {
    throw changedSession();
  }
  return session.accessToken !== expected.accessToken;
}

function assertCurrent(isActive, store, generation) {
  if (!isActive() || store.generation() !== generation) throw changedSession();
}

function requireRestoreAllowed(logoutIntent) {
  if (logoutIntent.isPending()) {
    throw new ApiError(
      'You are signed out on this browser. Please sign in again.',
      401,
      undefined,
      'LOGOUT_PENDING',
    );
  }
}

async function executeRestoreWork(
  send,
  store,
  isActive,
  logoutIntent,
  force,
  invocation,
) {
  assertCurrent(isActive, store, invocation);
  requireRestoreAllowed(logoutIntent);
  const before = store.read();
  if (!force && before) return before;

  const generation = store.generation();
  let tokens;
  try {
    tokens = await send('/auth/refresh', { method: 'POST' });
  } catch (error) {
    assertCurrent(isActive, store, generation);
    requireRestoreAllowed(logoutIntent);
    if (error.status === 401 && before) store.clear(before.sessionKey);
    throw error;
  }

  assertCurrent(isActive, store, generation);
  requireRestoreAllowed(logoutIntent);
  return applyRestoreSuccess(store, tokens, before);
}

async function executeRenewWork(
  send,
  store,
  isActive,
  logoutIntent,
  failedSession,
) {
  requireRestoreAllowed(logoutIntent);
  if (!isActive()) throw changedSession();
  const latest = store.read();
  if (checkSessionMatch(latest, failedSession)) return latest;

  const generation = store.generation();
  try {
    const tokens = await send('/auth/refresh', { method: 'POST' });
    assertCurrent(isActive, store, generation);
    requireRestoreAllowed(logoutIntent);
    const updated = store.rotate(tokens, latest);
    if (!updated) throw changedSession();
    return updated;
  } catch (error) {
    if (error.code === 'SESSION_CHANGED') throw error;
    assertCurrent(isActive, store, generation);
    requireRestoreAllowed(logoutIntent);
    return handleRenewFailure(error, store, latest);
  }
}

export function createSessionLifecycle({
  transport,
  store,
  locks,
  logoutIntent,
  isActive = () => true,
}) {
  const send = transport;
  let renewal = null;

  const withSessionLock = (work) =>
    locks?.request ? locks.request(SESSION_LOCK, work) : work();

  function restore(force = false) {
    const invocation = store.generation();
    return withSessionLock(() =>
      executeRestoreWork(send, store, isActive, logoutIntent, force, invocation),
    );
  }

  async function renew(failedSession) {
    const current = store.read();
    if (checkSessionMatch(current, failedSession)) return current;
    if (renewal?.sessionKey === current.sessionKey) return renewal.promise;

    const promise = withSessionLock(() =>
      executeRenewWork(
        send,
        store,
        isActive,
        logoutIntent,
        failedSession,
      ),
    );
    renewal = { sessionKey: current.sessionKey, promise };
    try {
      return await promise;
    } finally {
      if (renewal?.promise === promise) renewal = null;
    }
  }

  return { restore, renew };
}
