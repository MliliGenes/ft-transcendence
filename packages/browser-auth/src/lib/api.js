// Cookie-session HTTP layer: one origin-wide lock serializes every
// session-mutating call; ordinary fetches never replay (a single opt-in
// retry exists for safe reads only). A 401 renews once under the lock and
// may retry an opted-in safe read once; a confirmed 401 renewal ends the session, while a network /
// 5xx / timeout failure retains it as unavailable.

import { createLogoutIntent } from './logout-intent.js';
import { createHttpTransport } from './http-transport.js';
import { createSessionLifecycle } from './session-lifecycle.js';
import { createRequestPipeline } from './request-pipeline.js';
import { createAuthOperations } from './auth-operations.js';

export { ApiError, changedSession, expiredSession, unavailableSession } from './errors.js';

export function createAuthApi({
  apiBase,
  fetchImpl = fetch,
  store,
  locks,
  clock = Date,
  timeoutMs = 20000,
  storage = globalThis.localStorage,
  isActive = () => true,
}) {
  void clock;
  const logoutIntent = createLogoutIntent(storage);
  const transport = createHttpTransport({ apiBase, fetchImpl, timeoutMs });
  const lifecycle = createSessionLifecycle({ transport, store, locks, logoutIntent, isActive });
  const pipeline = createRequestPipeline({ transport, lifecycle, store, locks, isActive });
  const operations = createAuthOperations({ transport, locks, store, logoutIntent, isActive });

  return {
    request: pipeline,
    restoreSession: lifecycle.restore,
    renew: lifecycle.renew,
    loginRequest: operations.login,
    logoutRequest: operations.logout,
    isLogoutPending: () => logoutIntent.isPending(),
    markLogoutPending: () => logoutIntent.markPending(),
  };
}
