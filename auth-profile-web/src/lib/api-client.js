// Thin adapter over the shared browser-auth core: same `createApiClient`
// interface (`request`, `restoreSession`) with the shared renewal semantics
// (single lock, no-replay default, 401→renew→retry once, outage→retain).
import { ApiError, createAuthApi } from 'browser-auth';

export { ApiError };

function inlineLocks() {
  let tail = Promise.resolve();
  return {
    request: (_name, fn) => {
      const promise = tail.then(fn);
      tail = promise.catch(() => {});
      return promise;
    },
  };
}

export function createApiClient({
  baseUrl,
  store,
  fetchImpl = fetch,
  locks,
  timeoutMs = 20000,
}) {
  const api = createAuthApi({
    apiBase: baseUrl,
    fetchImpl,
    store,
    locks: locks ?? inlineLocks(),
    timeoutMs,
  });
  return { request: api.request, restoreSession: api.restoreSession };
}
