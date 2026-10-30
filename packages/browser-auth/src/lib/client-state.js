// Client state management and snapshot emission seam: encapsulates lifecycle status,
// profile data, snapshot broadcasting, and store event coordination.

import { unavailableSession } from './errors.js';

function normalizeError(error) {
  return error?.code === 'NETWORK' || error?.status === 0 ? unavailableSession(error) : error;
}

function isSessionFault(error) {
  return error?.status === 401 || error?.code === 'SESSION_EXPIRED';
}

function shouldClearOnEmpty(status) {
  return status === 'authenticated' || status === 'unavailable';
}

export function createClientState({ store, api, isActive = () => true, onTokenRenewed }) {
  const listeners = new Set();
  let status = 'loading';
  let profile = null;
  let lastRevision = 0;
  let lastGeneration = store.generation();

  const getSnapshot = () => {
    const session = store.read();
    return {
      status,
      profile,
      sessionGeneration: session?.sessionGeneration ?? store.generation(),
      tokenRevision: session?.tokenRevision ?? lastRevision,
      logoutPending: api.isLogoutPending(),
    };
  };

  const emit = () => {
    if (!isActive()) return;
    const current = getSnapshot();
    for (const listener of [...listeners]) listener(current);
  };

  const toLoading = () => {
    status = 'loading';
    profile = null;
    emit();
  };

  const toAuthenticated = (newProfile, beforeEmit) => {
    status = 'authenticated';
    profile = newProfile;
    beforeEmit?.();
    emit();
    return getSnapshot();
  };

  const toAnonymous = (beforeEmit) => {
    status = 'anonymous';
    profile = null;
    beforeEmit?.();
    emit();
    return getSnapshot();
  };

  const emitIfCurrent = (generation) => {
    if (store.generation() === generation) emit();
  };

  const toUnavailable = () => {
    if (status === 'authenticated') {
      status = 'unavailable';
      emit();
    }
  };

  const mapError = (error) => {
    if (isSessionFault(error)) {
      status = 'anonymous';
      profile = null;
    } else {
      status = 'unavailable';
    }
    emit();
  };

  const onSessionCleared = () => {
    lastGeneration = store.generation();
    if (shouldClearOnEmpty(status)) {
      status = 'anonymous';
      profile = null;
      emit();
    }
  };

  const onSessionRotated = (session) => {
    if (session.tokenRevision === lastRevision) return;
    const renewed = session.sessionGeneration === lastGeneration;
    lastGeneration = session.sessionGeneration;
    lastRevision = session.tokenRevision;
    if (renewed) onTokenRenewed?.();
    emit();
  };

  const stopStore = store.subscribe((session) => {
    if (!isActive()) return;
    if (!session) {
      onSessionCleared();
    } else {
      onSessionRotated(session);
    }
  });

  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toLoading,
    toAuthenticated,
    toAnonymous,
    toUnavailable,
    emitIfCurrent,
    mapError,
    normalizeError,
    dispose() {
      stopStore();
      listeners.clear();
    },
  };
}
