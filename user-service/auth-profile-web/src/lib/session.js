export const TOKEN_KEY = 'auth-profile-tokens';

export function validTokens(value) {
  return (
    value &&
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    typeof value.refreshToken === 'string' &&
    value.refreshToken.length > 0
  );
}

export function createSessionStore(storage) {
  const listeners = new Set();
  let memory = null;
  let persistent = true;
  const read = () => {
    if (!persistent) return memory;
    let raw;
    try {
      raw = storage.getItem(TOKEN_KEY);
    } catch {
      persistent = false;
      try { storage.removeItem(TOKEN_KEY); } catch { /* Storage is unavailable. */ }
      return memory;
    }
    try {
      const value = JSON.parse(raw);
      memory = validTokens(value)
        ? {
            accessToken: value.accessToken,
            refreshToken: value.refreshToken,
            sessionKey: value.sessionKey || value.refreshToken.split('.')[0],
          }
        : null;
    } catch {
      memory = null;
    }
    return memory;
  };
  const write = (value, reason) => {
    memory = value;
    try {
      if (value) storage.setItem(TOKEN_KEY, JSON.stringify(value));
      else storage.removeItem(TOKEN_KEY);
    } catch {
      persistent = false;
    }
    listeners.forEach((listener) => listener(value, reason));
    return value;
  };
  return {
    read,
    replace(tokens) {
      if (!validTokens(tokens))
        throw new Error('The server returned an incomplete session.');
      return write({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionKey: crypto.randomUUID(),
      });
    },
    rotate(tokens, expected) {
      const current = read();
      if (
        !current ||
        current.sessionKey !== expected.sessionKey ||
        current.refreshToken !== expected.refreshToken
      )
        return null;
      if (!validTokens(tokens))
        throw new Error('The server returned an incomplete session.');
      return write({
        ...current,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    },
    clear(sessionKey, reason) {
      if (sessionKey && read()?.sessionKey !== sessionKey) return;
      write(null, reason);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sync() {
      const value = read();
      listeners.forEach((listener) => listener(value));
    },
  };
}

// Consume callback data once, before React mounts (including StrictMode).
export function consumeOAuthReturn(location, history, store) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const hasTokens = fragment.has('accessToken') || fragment.has('refreshToken');
  const linked = fragment.get('providerLinked');
  const error = fragment.get('oauthError');
  if (!hasTokens && !linked && !error) return null;
  history.replaceState(null, '', location.pathname + location.search);
  if (error) {
    const messages = {
      conflict: fragment.get('oauthFlow') === 'link'
        ? 'This Discord account cannot be connected. It is already linked elsewhere, or you have connected a different Discord account.'
        : 'That email is already in use. Sign in with your existing method, then connect Discord from your profile.',
      authorization: 'Discord authorization was cancelled, expired or could not be verified. Please try again.',
      configuration: 'Discord connection is not available right now. Please try another sign-in method.',
      unavailable: 'Discord connection could not be completed. Please try again later.',
    };
    return { type: 'error', text: messages[error] || messages.unavailable };
  }
  if (hasTokens) {
    const tokens = {
      accessToken: fragment.get('accessToken'),
      refreshToken: fragment.get('refreshToken'),
    };
    if (!validTokens(tokens))
      return {
        type: 'error',
        text: 'Sign-in could not be completed. Please try again.',
      };
    store.replace(tokens); // A fresh callback always takes precedence over an old session.
    return { type: 'success', text: 'You are signed in.' };
  }
  return linked === 'discord'
    ? { type: 'success', text: 'Discord connected successfully.' }
    : null;
}
