// Thin adapter over the shared browser-auth core: the store keeps the
// legacy `createSessionStore` name and record shape (`accessToken`,
// `sessionKey`) plus the shared epoch fields (`sessionGeneration`,
// `tokenRevision`). Memory-only; the refresh credential stays HttpOnly.
import { createMemorySession } from 'browser-auth';

export const LEGACY_TOKEN_KEY = 'auth-profile-tokens';
const LEGACY_COOKIE_FLAG = 'fieldnote-legacy-cookie-cleared';
const REFRESH_COOKIE = 'auth-refresh';

export const createSessionStore = createMemorySession;

// Expire a legacy root-path `auth-refresh` cookie left by older deployments
// (the server issues Path=/auth/; a stale Path=/ copy would shadow it).
// One-shot: dev proxies rewrite the live cookie to Path=/, so this must not
// run on every startup.
export function expireLegacyRootCookie() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    let flagged = false;
    try {
      flagged = window.localStorage.getItem(LEGACY_COOKIE_FLAG) === '1';
    } catch {
      // Storage blocked: still expire, just without the once-flag.
    }
    if (flagged) return false;
    document.cookie = `${REFRESH_COOKIE}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    try {
      window.localStorage.setItem(LEGACY_COOKIE_FLAG, '1');
    } catch {
      // Best effort; the expiry above already ran.
    }
    return true;
  } catch {
    return false;
  }
}

// Remove the old script-readable credentials when the app starts.
export function clearLegacySession() {
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage may be disabled; the app no longer depends on it.
  }
  expireLegacyRootCookie();
}

// OAuth callbacks now use an HttpOnly cookie; only safe status fragments remain.
export function consumeOAuthReturn(location, history) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const hasTokens = fragment.has('accessToken') || fragment.has('refreshToken');
  const linked = fragment.get('providerLinked');
  const error = fragment.get('oauthError');
  const provider =
    fragment.get('oauthProvider') === 'github' ? 'GitHub' : 'Discord';
  if (!hasTokens && !linked && !error) return null;
  history.replaceState(null, '', location.pathname + location.search);
  if (hasTokens)
    return {
      type: 'error',
      text: 'Your session format changed. Please sign in again.',
    };
  if (error) {
    const messages = {
      conflict:
        fragment.get('oauthFlow') === 'link'
          ? `This ${provider} account cannot be connected. It is already linked elsewhere, or you have connected a different ${provider} account.`
          : `That email is already in use. Sign in with your existing method, then connect ${provider} from your profile.`,
      authorization: `${provider} authorization was cancelled, expired or could not be verified. Please try again.`,
      configuration: `${provider} connection is not available right now. Please try another sign-in method.`,
      unavailable: `${provider} connection could not be completed. Please try again later.`,
    };
    return { type: 'error', text: messages[error] || messages.unavailable };
  }
  return linked
    ? {
        type: 'success',
        text: `${linked === 'github' ? 'GitHub' : 'Discord'} connected successfully.`,
      }
    : null;
}
