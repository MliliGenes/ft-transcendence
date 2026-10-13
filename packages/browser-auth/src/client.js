// Shared memory-only browser auth client (refresh via the HttpOnly
// `auth-refresh` cookie). Dependency-free ESM: no React, no Nest, no build.
// Game and profile apps share this core so login/logout/renewal behave as
// one session: logout clears locally first (subscribers drop sockets
// immediately), broadcasts session-control cross-tab, then serializes the
// server logout; a failed server logout marks logout-pending, which blocks
// bootstrap until the next login. Token rotation bumps `tokenRevision` in
// the snapshot: that is the renewal signal sidecars subscribe to.

import { ApiError, createAuthApi, unavailableSession } from './lib/api.js';
import { createMemorySession } from './lib/session.js';
import {
  SIGNED_IN,
  SIGNED_OUT,
  TOKEN_RENEWED,
  createControl,
  requireChannel,
  requireLocks,
} from './lib/coordination.js';

export { ApiError, createAuthApi, createMemorySession };
export { SIGNED_IN, SIGNED_OUT, TOKEN_RENEWED, DEFAULT_CHANNEL_NAME } from './lib/coordination.js';

const LOGOUT_PENDING_MESSAGE =
  'You are signed out on this browser. The service could not confirm the session was closed.';

export function createBrowserAuthClient({ apiBase, fetchImpl = fetch, locks, channel, clock = Date, store: injectedStore } = {}) {
  requireLocks(locks);
  requireChannel(channel);
  const base = String(apiBase ?? '').replace(/\/$/, '');
  // Optional store injection lets app-level facades (login screens, game
  // wiring) share one memory session instead of shadowing each other.
  const store = injectedStore ?? createMemorySession();
  const api = createAuthApi({ apiBase: base, fetchImpl, store, locks, clock });
  const control = createControl(channel);
  const listeners = new Set();
  let status = 'loading';
  let profile = null;
  let logoutPending = false;
  let disposed = false;
  let lastRevision = 0;
  let lastGeneration = 0;
  const trackGeneration = () => {
    lastGeneration = store.generation();
  };
  trackGeneration();

  const snapshot = () => {
    const session = store.read();
    return {
      status,
      profile,
      sessionGeneration: session?.sessionGeneration ?? store.generation(),
      tokenRevision: session?.tokenRevision ?? lastRevision,
      logoutPending,
    };
  };
  const emit = () => {
    const current = snapshot();
    for (const listener of [...listeners]) listener(current);
  };

  // Renewal signal: a same-epoch rotation tells sibling tabs to re-verify
  // (their access token usually still works, so this never loops: tabs only
  // restore when their own token actually fails).
  store.subscribe((session) => {
    if (!session) {
      if (status === 'authenticated' || status === 'unavailable') {
        status = 'anonymous';
        profile = null;
        emit();
      }
      return;
    }
    if (session.tokenRevision !== lastRevision) {
      const local = session.tokenRevision > lastRevision;
      lastRevision = session.tokenRevision;
      if (local && session.sessionGeneration === lastGeneration) control.post(TOKEN_RENEWED);
      emit();
    }
  });
  function noteSession() {
    trackGeneration();
    const session = store.read();
    if (session) lastRevision = Math.max(lastRevision, session.tokenRevision);
  }

  async function loadProfile() {
    profile = await api.request('/accounts/me', { retrySafeRead: true });
    return profile;
  }

  function mapStatus(error) {
    if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') {
      status = 'anonymous';
      profile = null;
    } else {
      status = 'unavailable';
    }
    emit();
  }

  // Boundary normalization: a lost network/timeout surfaces as UNAVAILABLE
  // (session retained); HTTP statuses pass through untouched.
  function toUnavailable(error) {
    return error?.code === 'NETWORK' || error?.status === 0
      ? unavailableSession(error)
      : error;
  }

  async function restore(force = false) {
    if (disposed) throw new Error('The auth client is disposed.');
    if (logoutPending && !force)
      throw new ApiError(LOGOUT_PENDING_MESSAGE, 401, undefined, 'LOGOUT_PENDING');
    const tokens = await api.restoreSession(force).catch((error) => {
      if (error?.code === 'SESSION_CHANGED') throw error;
      if (error?.status === 401 && !store.read()) {
        status = 'anonymous';
        profile = null;
        emit();
        return null;
      }
      mapStatus(error);
      throw toUnavailable(error);
    });
    if (!tokens) return snapshot();
    noteSession();
    try {
      await loadProfile();
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED') throw error;
      mapStatus(error);
      throw toUnavailable(error);
    }
    if (!store.read()) {
      status = 'anonymous';
      profile = null;
      emit();
      return snapshot();
    }
    status = 'authenticated';
    emit();
    return snapshot();
  }

  async function login(mode, values) {
    if (disposed) throw new Error('The auth client is disposed.');
    let tokens;
    try {
      tokens = await api.loginRequest(mode, values);
    } catch (error) {
      mapStatus(error);
      throw toUnavailable(error);
    }
    store.replace(tokens);
    noteSession();
    logoutPending = false;
    try {
      await loadProfile();
    } catch (error) {
      mapStatus(error);
      throw toUnavailable(error);
    }
    status = 'authenticated';
    control.post(SIGNED_IN);
    emit();
    return snapshot();
  }

  async function logout() {
    // Clear first: subscribers (game transports) drop sockets immediately,
    // before the server round-trip. The epoch bump also rejects late
    // in-flight results instead of reviving them.
    store.clear();
    noteSession();
    status = 'anonymous';
    profile = null;
    control.post(SIGNED_OUT);
    emit();
    try {
      await api.logoutRequest();
      logoutPending = false;
    } catch {
      logoutPending = true;
    }
    emit();
    return { serverConfirmed: !logoutPending };
  }

  async function fetch(path, options = {}) {
    try {
      return await api.request(path, options);
    } catch (error) {
      const normalized = toUnavailable(error);
      if (normalized?.code === 'SESSION_EXPIRED' || normalized?.status === 401) {
        if (!store.read()) {
          status = 'anonymous';
          profile = null;
          emit();
        }
      } else if (normalized?.code === 'UNAVAILABLE' || (normalized?.status ?? 0) >= 500) {
        if (status === 'authenticated') {
          status = 'unavailable';
          emit();
        }
      }
      throw normalized;
    }
  }

  const stopControl = control.subscribe((message) => {
    if (disposed) return;
    if (message === SIGNED_OUT) {
      store.clear();
      noteSession();
      status = 'anonymous';
      profile = null;
      emit();
      return;
    }
    if (message === SIGNED_IN) {
      void restore(true).catch(() => {});
      return;
    }
    if (message === TOKEN_RENEWED && store.read()) {
      // Adopt the rotated cookie only if this tab's token actually failed;
      // a still-valid token needs no restore, which keeps this loop-free.
      void api
        .request('/accounts/me', { retrySafeRead: true })
        .then((me) => {
          if (disposed) return;
          profile = me;
          if (store.read()) status = 'authenticated';
          emit();
        })
        .catch((error) => {
          if (disposed) return;
          if (error?.status === 401 || error?.code === 'SESSION_EXPIRED')
            void restore(true).catch(() => {});
        });
    }
  });

  function dispose() {
    disposed = true;
    stopControl();
    listeners.clear();
  }

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore,
    login,
    logout,
    getAccessToken: () => store.read()?.accessToken ?? null,
    fetch,
    dispose,
  };
}
