// Shared browser auth lifecycle. Credentials stay in memory / HttpOnly cookies;
// only a credential-free logout intent is persisted across app instances.
import { ApiError, changedSession, createAuthApi, unavailableSession } from './lib/api.js';
import { createMemorySession } from './lib/session.js';
import { SIGNED_IN, SIGNED_OUT, TOKEN_RENEWED, createControl, requireChannel, requireLocks } from './lib/coordination.js';
export { ApiError, createAuthApi, createMemorySession };
export { SIGNED_IN, SIGNED_OUT, TOKEN_RENEWED, DEFAULT_CHANNEL_NAME } from './lib/coordination.js';

export function createBrowserAuthClient({ apiBase, fetchImpl = fetch, locks, channel, clock = Date, store: injectedStore, storage = globalThis.localStorage } = {}) {
  requireLocks(locks);
  requireChannel(channel);
  const store = injectedStore ?? createMemorySession();
  const control = createControl(channel);
  const listeners = new Set();
  let status = 'loading';
  let profile = null;
  let disposed = false;
  let lastRevision = 0;
  let lastGeneration = store.generation();
  const api = createAuthApi({ apiBase, fetchImpl, store, locks, clock, storage, isActive: () => !disposed });
  const snapshot = () => {
    const session = store.read();
    return { status, profile, sessionGeneration: session?.sessionGeneration ?? store.generation(), tokenRevision: session?.tokenRevision ?? lastRevision, logoutPending: api.isLogoutPending() };
  };
  const emit = () => {
    if (disposed) return;
    const current = snapshot();
    for (const listener of [...listeners]) listener(current);
  };
  const assertCurrent = (generation) => {
    if (disposed || store.generation() !== generation) throw changedSession();
  };
  const assertActive = () => { if (disposed) throw new Error('The auth client is disposed.'); };
  const stopStore = store.subscribe((session) => {
    if (disposed) return;
    if (!session) {
      lastGeneration = store.generation();
      if (status === 'authenticated' || status === 'unavailable') {
        status = 'anonymous'; profile = null; emit();
      }
      return;
    }
    if (session.tokenRevision !== lastRevision) {
      const renewed = session.sessionGeneration === lastGeneration;
      lastGeneration = session.sessionGeneration;
      lastRevision = session.tokenRevision;
      if (renewed) control.post(TOKEN_RENEWED);
      emit();
    }
  });
  const normalize = (error) => error?.code === 'NETWORK' || error?.status === 0 ? unavailableSession(error) : error;
  const mapStatus = (error) => {
    if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') { status = 'anonymous'; profile = null; }
    else status = 'unavailable';
    emit();
  };
  async function loadProfile(generation) {
    const me = await api.request('/accounts/me', { retrySafeRead: true });
    assertCurrent(generation);
    profile = me;
  }
  async function restore(force = false) {
    assertActive();
    let generation = store.generation();
    let session;
    try {
      session = await api.restoreSession(force);
      // Restore may create its own session; only that returned epoch is valid.
      assertCurrent(session.sessionGeneration);
      generation = session.sessionGeneration;
      await loadProfile(generation);
      assertCurrent(generation);
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED') throw error;
      // A confirmed expiry can clear this operation's own epoch.
      if (error?.status === 401 && !store.read() && store.generation() === generation + 1) generation = store.generation();
      assertCurrent(generation);
      mapStatus(error);
      if (error?.status === 401 && error?.code !== 'LOGOUT_PENDING' && !store.read()) return snapshot();
      throw normalize(error);
    }
    status = 'authenticated'; emit(); return snapshot();
  }
  async function login(mode, values) {
    assertActive();
    // Deliberate identity replacement invalidates older restore/profile work
    // synchronously, before joining the origin-wide cookie-operation queue.
    store.clear();
    status = 'loading'; profile = null; emit();
    let generation = store.generation();
    try {
      const session = await api.loginRequest(mode, values);
      assertCurrent(session.sessionGeneration);
      generation = session.sessionGeneration;
      await loadProfile(generation);
      assertCurrent(generation);
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED') throw error;
      // A confirmed expiry cleared this login's own epoch. A newer login or
      // logout increments it again, so its state still cannot be overwritten.
      if (error?.code === 'SESSION_EXPIRED' && !store.read() && store.generation() === generation + 1) generation = store.generation();
      assertCurrent(generation);
      mapStatus(error);
      throw normalize(error);
    }
    status = 'authenticated'; control.post(SIGNED_IN); emit(); return snapshot();
  }
  async function logout() {
    assertActive();
    const marker = api.markLogoutPending();
    store.clear();
    const generation = store.generation();
    status = 'anonymous'; profile = null;
    control.post(SIGNED_OUT); emit();
    let serverConfirmed = false;
    try { await api.logoutRequest(marker); serverConfirmed = true; } catch { /* Keep the shared intent until a confirmed logout or deliberate login. */ }
    if (!disposed && store.generation() === generation) emit();
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
      const normalized = normalize(error);
      const ownExpiry = normalized?.code === 'SESSION_EXPIRED' && !store.read() && store.generation() === generation + 1;
      if (!ownExpiry) assertCurrent(generation);
      if (normalized?.code === 'SESSION_EXPIRED' && !store.read()) { status = 'anonymous'; profile = null; emit(); }
      else if (normalized?.code === 'UNAVAILABLE' || (normalized?.status ?? 0) >= 500) {
        if (status === 'authenticated') { status = 'unavailable'; emit(); }
      }
      throw normalized;
    }
  }
  const stopControl = control.subscribe((message) => {
    if (disposed) return;
    if (message === SIGNED_OUT) {
      store.clear(); status = 'anonymous'; profile = null; emit(); return;
    }
    if (message === SIGNED_IN) {
      store.clear(); status = 'loading'; profile = null; emit();
      void restore(true).catch(() => {}); return;
    }
    if (message === TOKEN_RENEWED && store.read()) {
      const generation = store.generation();
      void loadProfile(generation).then(() => {
        assertCurrent(generation); status = 'authenticated'; emit();
      }).catch((error) => {
        if (disposed || store.generation() !== generation || error?.code === 'SESSION_CHANGED') return;
        if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') void restore(true).catch(() => {});
      });
    }
  });
  return {
    getSnapshot: snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    restore, login, logout, getAccessToken: () => store.read()?.accessToken ?? null, fetch,
    dispose() { disposed = true; stopControl(); stopStore(); listeners.clear(); },
  };
}
