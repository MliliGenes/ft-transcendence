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
export const sessionStore = createSessionStore();
export const api = createApiClient({
  baseUrl: API_URL,
  store: sessionStore,
  locks: navigator.locks,
});
