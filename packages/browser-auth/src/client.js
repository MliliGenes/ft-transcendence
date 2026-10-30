// Shared browser auth lifecycle. Credentials stay in memory / HttpOnly cookies;
// only a credential-free logout intent is persisted across app instances.
import { ApiError, changedSession, createAuthApi } from './lib/api.js';
import { createMemorySession } from './lib/session.js';
import { SIGNED_IN, SIGNED_OUT, TOKEN_RENEWED, createControl, requireChannel, requireLocks } from './lib/coordination.js';
import { createClientState } from './lib/client-state.js';
export { ApiError, createAuthApi, createMemorySession };
export { SIGNED_IN, SIGNED_OUT, TOKEN_RENEWED, DEFAULT_CHANNEL_NAME } from './lib/coordination.js';

function checkCurrent(store, generation, disposed) {
  if (disposed || store.generation() !== generation) throw changedSession();
}

async function loadProfile(api, assertCurrent, generation) {
  const me = await api.request('/accounts/me', { retrySafeRead: true });
  assertCurrent(generation);
  return me;
}

export function createBrowserAuthClient({ apiBase, fetchImpl = fetch, locks, channel, clock = Date, store: injectedStore, storage = globalThis.localStorage } = {}) {
  requireLocks(locks);
  requireChannel(channel);
  const store = injectedStore ?? createMemorySession();
  const control = createControl(channel);
  let disposed = false;
  const api = createAuthApi({ apiBase, fetchImpl, store, locks, clock, storage, isActive: () => !disposed });
  const state = createClientState({
    store,
    api,
    isActive: () => !disposed,
    onTokenRenewed: () => control.post(TOKEN_RENEWED),
  });

  const assertCurrent = (generation) => checkCurrent(store, generation, disposed);
  const assertActive = () => { if (disposed) throw new Error('The auth client is disposed.'); };

  async function restore(force = false) {
    assertActive();
    let generation = store.generation();
    let session;
    let me;
    try {
      session = await api.restoreSession(force);
      // Restore may create its own session; only that returned epoch is valid.
      assertCurrent(session.sessionGeneration);
      generation = session.sessionGeneration;
      me = await loadProfile(api, assertCurrent, generation);
      assertCurrent(generation);
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED') throw error;
      // A confirmed expiry can clear this operation's own epoch.
      if (error?.status === 401 && !store.read() && store.generation() === generation + 1) generation = store.generation();
      assertCurrent(generation);
      state.mapError(error);
      if (error?.status === 401 && error?.code !== 'LOGOUT_PENDING' && !store.read()) return state.getSnapshot();
      throw state.normalizeError(error);
    }
    return state.toAuthenticated(me);
  }

  async function login(mode, values) {
    assertActive();
    // Deliberate identity replacement invalidates older restore/profile work
    // synchronously, before joining the origin-wide cookie-operation queue.
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
      if (error?.code === 'SESSION_CHANGED') throw error;
      // A confirmed expiry cleared this login's own epoch. A newer login or
      // logout increments it again, so its state still cannot be overwritten.
      if (error?.code === 'SESSION_EXPIRED' && !store.read() && store.generation() === generation + 1) generation = store.generation();
      assertCurrent(generation);
      state.mapError(error);
      throw state.normalizeError(error);
    }
    return state.toAuthenticated(me, () => control.post(SIGNED_IN));
  }

  async function logout() {
    assertActive();
    const marker = api.markLogoutPending();
    store.clear();
    const generation = store.generation();
    state.toAnonymous(() => control.post(SIGNED_OUT));
    let serverConfirmed = false;
    try { await api.logoutRequest(marker); serverConfirmed = true; } catch { /* Keep the shared intent until a confirmed logout or deliberate login. */ }
    state.emitIfCurrent(generation);
    return { serverConfirmed };
  }

  async function fetch(path, options = {}) {
    assertActive();
    const generation = store.generation();
    try {
      const result = await api.request(path, options);
      assertCurrent(generation);
      return result;
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED') throw error;
      if (disposed) throw changedSession();
      const normalized = state.normalizeError(error);
      const ownExpiry = normalized?.code === 'SESSION_EXPIRED' && !store.read() && store.generation() === generation + 1;
      if (!ownExpiry) assertCurrent(generation);
      if (normalized?.code === 'SESSION_EXPIRED' && !store.read()) {
        state.toAnonymous();
      } else if (normalized?.code === 'UNAVAILABLE' || (normalized?.status ?? 0) >= 500) {
        state.toUnavailable();
      }
      throw normalized;
    }
  }

  const stopControl = control.subscribe((message) => {
    if (disposed) return;
    if (message === SIGNED_OUT) {
      store.clear();
      state.toAnonymous();
      return;
    }
    if (message === SIGNED_IN) {
      store.clear();
      state.toLoading();
      void restore(true).catch(() => {});
      return;
    }
    if (message === TOKEN_RENEWED && store.read()) {
      const generation = store.generation();
      void loadProfile(api, assertCurrent, generation).then((me) => {
        assertCurrent(generation);
        state.toAuthenticated(me);
      }).catch((error) => {
        if (disposed || store.generation() !== generation || error?.code === 'SESSION_CHANGED') return;
        if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') void restore(true).catch(() => {});
      });
    }
  });

  return {
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    restore,
    login,
    logout,
    getAccessToken: () => store.read()?.accessToken ?? null,
    fetch,
    dispose() {
      disposed = true;
      stopControl();
      state.dispose();
    },
  };
}
