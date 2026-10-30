// Public authenticated client fetch pipeline and service degradation policy.

import { changedSession } from './errors.js';

function isOwnExpiry(normalized, store, generation) {
  return (
    normalized?.code === 'SESSION_EXPIRED' &&
    !store.read() &&
    store.generation() === generation + 1
  );
}

function degradeOnFetchError(normalized, store, state) {
  if (normalized?.code === 'SESSION_EXPIRED' && !store.read()) {
    state.toAnonymous();
  } else if (normalized?.code === 'UNAVAILABLE' || (normalized?.status ?? 0) >= 500) {
    state.toUnavailable();
  }
}

function handleFetchError(error, { state, store, generation, assertCurrent, isDisposed }) {
  if (error?.code === 'SESSION_CHANGED') throw error;
  if (isDisposed()) throw changedSession();

  const normalized = state.normalizeError(error);
  if (!isOwnExpiry(normalized, store, generation)) {
    assertCurrent(generation);
  }

  degradeOnFetchError(normalized, store, state);
  throw normalized;
}

export function createClientFetch({ api, store, state, assertActive, assertCurrent, isDisposed }) {
  return async function fetch(path, options = {}) {
    assertActive();
    const generation = store.generation();
    try {
      const result = await api.request(path, options);
      assertCurrent(generation);
      return result;
    } catch (error) {
      handleFetchError(error, { state, store, generation, assertCurrent, isDisposed });
    }
  };
}
