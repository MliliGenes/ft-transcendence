// Persistent logout intent coordination: tracks credential-free intent markers
// and their acknowledgements across browser contexts and origin storage.
// The refresh token remains exclusively in its cookie; access tokens remain in memory.

const LOGOUT_MARKER = 'browser-auth:logout-pending';
const LOGOUT_ACKNOWLEDGED = 'browser-auth:logout-acknowledged';

export function createLogoutIntent(storage = globalThis.localStorage) {
  // Non-browser callers may omit storage; each instance maintains its own fallback.
  let localMarker = null;
  let localAcknowledged = null;

  const readMarker = () => (storage ? storage.getItem(LOGOUT_MARKER) : localMarker);

  const isPending = () => {
    // Read the acknowledgement first: a later intent always wins. Cookie work
    // serializes acknowledgements, but synchronous intent writes stay outside
    // that lock and must never be deleted by a non-atomic compare/remove pair.
    const acknowledged = storage ? storage.getItem(LOGOUT_ACKNOWLEDGED) : localAcknowledged;
    const marker = readMarker();
    return marker !== null && marker !== acknowledged;
  };

  const markPending = () => {
    const marker = globalThis.crypto.randomUUID();
    if (storage) storage.setItem(LOGOUT_MARKER, marker);
    else localMarker = marker;
    return marker;
  };

  const acknowledge = (expected) => {
    if (expected == null || readMarker() !== expected) return;
    // Cookie acknowledgements are serialized, so an older queued operation
    // cannot replace the acknowledgement of the current newer intent.
    // Acknowledge only our own ID, leaving the intent key untouched. Another
    // tab can write a newer ID at any storage-operation boundary safely.
    if (storage) storage.setItem(LOGOUT_ACKNOWLEDGED, expected);
    else localAcknowledged = expected;
  };

  return {
    readMarker,
    isPending,
    markPending,
    acknowledge,
  };
}
