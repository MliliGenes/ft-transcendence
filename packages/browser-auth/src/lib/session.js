// Memory-only session store. Tokens never touch storage: the refresh
// credential lives in the HttpOnly `auth-refresh` cookie and only the
// access token lives here, in memory. `sessionGeneration` marks the identity
// epoch (bumped by every replace/clear so late async results can be
// rejected); `tokenRevision` bumps on every token set so subscribers can
// tell a rotation apart from a new epoch.

function validAccessToken(value) {
  return typeof value?.accessToken === 'string' && value.accessToken.length > 0;
}

function isMatchingSession(current, expected) {
  if (!current || !expected) return false;
  return current.sessionKey === expected.sessionKey && current.accessToken === expected.accessToken;
}

function canClearSession(memory, sessionKey) {
  if (!sessionKey) return true;
  return memory?.sessionKey === sessionKey;
}

function uuid() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function createMemorySession() {
  const listeners = new Set();
  let memory = null;
  let generation = 0;
  let revision = 0;
  const notify = (value, reason) => {
    for (const listener of [...listeners]) listener(value, reason);
  };
  return {
    read: () => memory,
    generation: () => generation,
    replace(tokens) {
      if (!validAccessToken(tokens))
        throw new Error('The server returned an incomplete session.');
      generation += 1;
      revision += 1;
      memory = {
        accessToken: tokens.accessToken,
        sessionKey: uuid(),
        sessionGeneration: generation,
        tokenRevision: revision,
      };
      notify(memory);
      return memory;
    },
    rotate(tokens, expected) {
      const current = memory;
      if (!isMatchingSession(current, expected)) return null;
      if (!validAccessToken(tokens))
        throw new Error('The server returned an incomplete session.');
      revision += 1;
      memory = { ...current, accessToken: tokens.accessToken, tokenRevision: revision };
      notify(memory);
      return memory;
    },
    clear(sessionKey, reason) {
      if (!canClearSession(memory, sessionKey)) return;
      generation += 1;
      memory = null;
      notify(null, reason);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
