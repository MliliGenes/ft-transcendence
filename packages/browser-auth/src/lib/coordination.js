// Cross-tab session control. Web Locks and BroadcastChannel are required:
// without the origin-wide lock two tabs rotate the refresh cookie against
// each other, and without the channel a logout strands sibling tabs.

export const DEFAULT_CHANNEL_NAME = 'fieldnote-auth-session';
export const SIGNED_IN = 'signed-in';
export const SIGNED_OUT = 'signed-out';
export const TOKEN_RENEWED = 'token-renewed';

export function requireLocks(locks) {
  if (!locks || typeof locks.request !== 'function')
    throw new Error('browser-auth requires Web Locks (locks.request).');
  return locks;
}

export function requireChannel(channel) {
  if (!channel || typeof channel.postMessage !== 'function')
    throw new Error('browser-auth requires a BroadcastChannel.');
  return channel;
}

export function createControl(channel) {
  requireChannel(channel);
  return {
    post(type) {
      channel.postMessage(type);
    },
    subscribe(handler) {
      const onMessage = (event) => handler(event?.data ?? event);
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
  };
}
