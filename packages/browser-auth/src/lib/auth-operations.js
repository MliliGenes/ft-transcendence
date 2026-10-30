// Login/logout operations seam: handles credentialed session establishment and
// teardown, serialized under the origin-wide session lock and coordinated with logout intents.

import { changedSession } from './errors.js';

const SESSION_LOCK = 'browser-auth:session';

function assertIntent(isActive, store, generation, logoutIntent, marker) {
  if (!isActive() || store.generation() !== generation) throw changedSession();
  const currentMarker = logoutIntent.readMarker();
  if (currentMarker !== null && currentMarker !== marker) throw changedSession();
}

async function executeLoginWork(
  send,
  store,
  isActive,
  logoutIntent,
  generation,
  marker,
  mode,
  values,
) {
  const check = () => assertIntent(isActive, store, generation, logoutIntent, marker);
  check();

  let tokens;
  try {
    tokens = await send(`/auth/${mode}`, { method: 'POST', json: values });
  } catch (error) {
    check();
    throw error;
  }

  check();
  const session = store.replace(tokens);
  logoutIntent.acknowledge(marker);
  return session;
}

export function createAuthOperations({
  transport,
  locks,
  store,
  logoutIntent,
  isActive = () => true,
}) {
  const send = transport;

  const withSessionLock = (work) =>
    locks?.request ? locks.request(SESSION_LOCK, work) : work();

  function login(mode, values) {
    const generation = store.generation();
    const marker = logoutIntent.readMarker();
    return withSessionLock(() =>
      executeLoginWork(
        send,
        store,
        isActive,
        logoutIntent,
        generation,
        marker,
        mode,
        values,
      ),
    );
  }

  function logout(marker = logoutIntent.markPending()) {
    return withSessionLock(async () => {
      await send('/auth/logout', { method: 'POST' });
      logoutIntent.acknowledge(marker);
    });
  }

  return { login, logout };
}
