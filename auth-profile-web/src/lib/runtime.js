import { createBrowserAuthClient, DEFAULT_CHANNEL_NAME } from 'browser-auth';
import { createApiClient } from './api-client.js';
import { clearLegacySession, createSessionStore } from './session.js';

const configured = import.meta.env.VITE_API_URL?.trim();
export const API_URL = new URL(
  configured ||
    (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin),
  window.location.origin,
)
  .toString()
  .replace(/\/$/, '');
clearLegacySession();
// One memory session shared by the screens (via `api`/`sessionStore`) and
// the shared client (login/logout/restore + cross-tab control).
export const sessionStore = createSessionStore();
export const authChannel = new BroadcastChannel(DEFAULT_CHANNEL_NAME);
export const authClient = createBrowserAuthClient({
  apiBase: API_URL,
  locks: navigator.locks,
  channel: authChannel,
  store: sessionStore,
});
export const api = createApiClient({
  baseUrl: API_URL,
  store: sessionStore,
  locks: navigator.locks,
});
