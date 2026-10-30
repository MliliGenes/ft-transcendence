// Shared browser auth lifecycle. Credentials stay in memory / HttpOnly cookies;
// only a credential-free logout intent is persisted across app instances.
import { ApiError, changedSession, createAuthApi } from './lib/api.js';
import { createMemorySession } from './lib/session.js';
import { createControl, requireChannel, requireLocks } from './lib/coordination.js';
import { createClientState } from './lib/client-state.js';
import { createClientFetch } from './lib/client-fetch.js';
import { createControlCoordinator } from './lib/control-channel.js';
import { createSessionWorkflows } from './lib/session-workflows.js';
export { ApiError, createAuthApi, createMemorySession };
export { SIGNED_IN, SIGNED_OUT, TOKEN_RENEWED, DEFAULT_CHANNEL_NAME } from './lib/coordination.js';

function checkCurrent(store, generation, disposed) {
  if (disposed || store.generation() !== generation) throw changedSession();
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
    onTokenRenewed: () => coordinator.postTokenRenewed(),
  });

  const assertCurrent = (generation) => checkCurrent(store, generation, disposed);
  const assertActive = () => { if (disposed) throw new Error('The auth client is disposed.'); };

  const workflows = createSessionWorkflows({
    api,
    store,
    state,
    coordinator: {
      postSignedIn: () => coordinator.postSignedIn(),
      postSignedOut: () => coordinator.postSignedOut(),
    },
    assertActive,
    assertCurrent,
  });

  const clientFetch = createClientFetch({
    api,
    store,
    state,
    assertActive,
    assertCurrent,
    isDisposed: () => disposed,
  });

  const coordinator = createControlCoordinator({
    control,
    store,
    state,
    api,
    loadProfile: workflows.loadProfile,
    assertCurrent,
    restore: workflows.restore,
    isActive: () => !disposed,
  });

  return {
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    restore: workflows.restore,
    login: workflows.login,
    logout: workflows.logout,
    getAccessToken: () => store.read()?.accessToken ?? null,
    fetch: clientFetch,
    dispose() {
      disposed = true;
      coordinator.dispose();
      state.dispose();
    },
  };
}
