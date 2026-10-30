// Session lifecycle operations: restore, login, logout, and profile loading.

async function loadProfile(api, assertCurrent, generation) {
  const me = await api.request('/accounts/me', { retrySafeRead: true });
  assertCurrent(generation);
  return me;
}

function isConfirmedExpiry(error, store, generation) {
  return (
    error?.status === 401 &&
    !store.read() &&
    store.generation() === generation + 1
  );
}

function isCleanAnonymousExpiry(error, store) {
  return (
    error?.status === 401 &&
    error?.code !== 'LOGOUT_PENDING' &&
    !store.read()
  );
}

function handleRestoreError(error, generation, { store, state, assertCurrent }) {
  if (error?.code === 'SESSION_CHANGED') throw error;
  const currentGen = isConfirmedExpiry(error, store, generation)
    ? store.generation()
    : generation;
  assertCurrent(currentGen);
  state.mapError(error);
  if (isCleanAnonymousExpiry(error, store)) {
    return state.getSnapshot();
  }
  throw state.normalizeError(error);
}

function isLoginExpiry(error, store, generation) {
  return (
    error?.code === 'SESSION_EXPIRED' &&
    !store.read() &&
    store.generation() === generation + 1
  );
}

function handleLoginError(error, generation, { store, state, assertCurrent }) {
  if (error?.code === 'SESSION_CHANGED') throw error;
  const currentGen = isLoginExpiry(error, store, generation)
    ? store.generation()
    : generation;
  assertCurrent(currentGen);
  state.mapError(error);
  throw state.normalizeError(error);
}

export function createSessionWorkflows({
  api,
  store,
  state,
  coordinator,
  assertActive,
  assertCurrent,
}) {
  async function restore(force = false) {
    assertActive();
    let generation = store.generation();
    let me;
    try {
      const session = await api.restoreSession(force);
      assertCurrent(session.sessionGeneration);
      generation = session.sessionGeneration;
      me = await loadProfile(api, assertCurrent, generation);
      assertCurrent(generation);
    } catch (error) {
      return handleRestoreError(error, generation, { store, state, assertCurrent });
    }
    return state.toAuthenticated(me);
  }

  async function login(mode, values) {
    assertActive();
    store.clear();
    state.toLoading();
    let generation = store.generation();
    let me;
    try {
      const session = await api.loginRequest(mode, values);
      assertCurrent(session.sessionGeneration);
      generation = session.sessionGeneration;
      me = await loadProfile(api, assertCurrent, generation);
      assertCurrent(generation);
    } catch (error) {
      handleLoginError(error, generation, { store, state, assertCurrent });
    }
    return state.toAuthenticated(me, () => coordinator.postSignedIn());
  }

  async function logout() {
    assertActive();
    const marker = api.markLogoutPending();
    store.clear();
    const generation = store.generation();
    state.toAnonymous(() => coordinator.postSignedOut());
    let serverConfirmed = false;
    try {
      await api.logoutRequest(marker);
      serverConfirmed = true;
    } catch {
      // Keep shared intent until confirmed logout or deliberate login
    }
    state.emitIfCurrent(generation);
    return { serverConfirmed };
  }

  return {
    loadProfile,
    restore,
    login,
    logout,
  };
}
