import { createApiClient } from './api-client.js';
import { createSessionStore } from './session.js';

const configured = import.meta.env.VITE_API_URL?.trim();
export const API_URL = new URL(
  configured ||
    (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin),
  window.location.origin,
)
  .toString()
  .replace(/\/$/, '');
export const sessionStore = createSessionStore({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
});
export const api = createApiClient({
  baseUrl: API_URL,
  store: sessionStore,
  locks: navigator.locks,
});
