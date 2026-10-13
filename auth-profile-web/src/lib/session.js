export const LEGACY_TOKEN_KEY = 'auth-profile-tokens';

function validAccessToken(value) {
  return typeof value?.accessToken === 'string' && value.accessToken.length > 0;
}

export function createSessionStore() {
  const listeners = new Set();
  let memory = null;
  const write = (value, reason) => {
    memory = value;
    listeners.forEach((listener) => listener(value, reason));
    return value;
  };
  return {
    read: () => memory,
    replace(tokens) {
      if (!validAccessToken(tokens))
        throw new Error('The server returned an incomplete session.');
      return write({
        accessToken: tokens.accessToken,
        sessionKey: crypto.randomUUID(),
      });
    },
    rotate(tokens, expected) {
      const current = memory;
      if (
        !current ||
        current.sessionKey !== expected.sessionKey ||
        current.accessToken !== expected.accessToken
      )
        return null;
      if (!validAccessToken(tokens))
        throw new Error('The server returned an incomplete session.');
      return write({ ...current, accessToken: tokens.accessToken });
    },
    clear(sessionKey, reason) {
      if (sessionKey && memory?.sessionKey !== sessionKey) return;
      write(null, reason);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Remove the old script-readable credentials when the app starts.
export function clearLegacySession() {
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage may be disabled; the app no longer depends on it.
  }
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
