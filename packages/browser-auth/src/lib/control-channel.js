// Cross-tab broadcast coordination and multi-instance session synchronization.

import { SIGNED_IN, SIGNED_OUT, TOKEN_RENEWED } from './coordination.js';

function handleSignedOut(store, state) {
  store.clear();
  state.toAnonymous();
}

function handleSignedIn(store, state, restore) {
  store.clear();
  state.toLoading();
  void restore(true).catch(() => {});
}

function onProfileReloadError(error, store, generation, restore, isActive) {
  if (!isActive() || store.generation() !== generation || error?.code === 'SESSION_CHANGED') {
    return;
  }
  if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') {
    void restore(true).catch(() => {});
  }
}

function handleTokenRenewed({ store, state, api, loadProfile, assertCurrent, restore, isActive }) {
  if (!store.read()) return;
  const generation = store.generation();
  void loadProfile(api, assertCurrent, generation)
    .then((me) => {
      assertCurrent(generation);
      state.toAuthenticated(me);
    })
    .catch((error) => {
      onProfileReloadError(error, store, generation, restore, isActive);
    });
}

function routeControlMessage(message, ctx) {
  if (message === SIGNED_OUT) {
    handleSignedOut(ctx.store, ctx.state);
  } else if (message === SIGNED_IN) {
    handleSignedIn(ctx.store, ctx.state, ctx.restore);
  } else if (message === TOKEN_RENEWED) {
    handleTokenRenewed(ctx);
  }
}

export function createControlCoordinator({
  control,
  store,
  state,
  api,
  loadProfile,
  assertCurrent,
  restore,
  isActive = () => true,
}) {
  const ctx = { control, store, state, api, loadProfile, assertCurrent, restore, isActive };
  const stopControl = control.subscribe((message) => {
    if (!isActive()) return;
    routeControlMessage(message, ctx);
  });

  return {
    postSignedIn: () => control.post(SIGNED_IN),
    postSignedOut: () => control.post(SIGNED_OUT),
    postTokenRenewed: () => control.post(TOKEN_RENEWED),
    dispose: stopControl,
  };
}
