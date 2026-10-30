// HTTP transport seam: handles request formatting, timeouts, abort signals,
// response parsing, and standard network/API error mapping.

import { ApiError } from './errors.js';

function buildHeaders(path, method, accessToken, hasJson) {
  const headers = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (hasJson) headers['Content-Type'] = 'application/json';
  if (path.startsWith('/auth/') && method !== 'GET') {
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  return headers;
}

function parsePayload(response) {
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

function extractError(response, payload) {
  const raw = payload?.message;
  const messages = (Array.isArray(raw) ? raw : [raw]).filter((s) => typeof s === 'string');
  const message = messages[0] || `The request could not be completed (${response.status}).`;
  return new ApiError(message, response.status, messages.length ? messages : [message]);
}

function mapCaughtError(error, signal) {
  if (signal?.aborted) throw signal.reason || error;
  if (error instanceof ApiError) throw error;
  throw new ApiError(
    'Unable to reach the service. Check your connection and try again.',
    0,
    undefined,
    'NETWORK',
  );
}

function setupAbortSignal(signal, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cleanup = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  };
  return { signal: controller.signal, cleanup };
}

async function executeSend(
  base,
  fetchImpl,
  timeoutMs,
  path,
  { method = 'GET', json, body, signal, credentials = 'include' } = {},
  accessToken,
) {
  const { signal: requestSignal, cleanup } = setupAbortSignal(signal, timeoutMs);
  try {
    const headers = buildHeaders(path, method, accessToken, json !== undefined);
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : body,
      credentials,
      signal: requestSignal,
    });

    const payload = await parsePayload(response);
    if (!response.ok) throw extractError(response, payload);
    if (response.status !== 204 && payload === null) {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
        response.status,
      );
    }
    return payload;
  } catch (error) {
    mapCaughtError(error, signal);
  } finally {
    cleanup();
  }
}

export function createHttpTransport({
  apiBase,
  fetchImpl = fetch,
  timeoutMs = 20000,
} = {}) {
  const base = String(apiBase ?? '').replace(/\/$/, '');

  function send(path, options, accessToken) {
    return executeSend(base, fetchImpl, timeoutMs, path, options, accessToken);
  }

  return send;
}
