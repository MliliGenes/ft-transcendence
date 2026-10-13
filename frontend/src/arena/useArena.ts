import { useEffect, useState } from "react";
import type { ArenaTransport } from "./transport.js";
import type { ArenaSnapshot } from "./types.js";

/** Subscribes to the transport authority, including a replaced transport. */
export function useArena(transport: ArenaTransport): ArenaSnapshot {
  const [current, setCurrent] = useState(() => ({ transport, snapshot: transport.snapshot() }));
  const snapshot = current.transport === transport ? current.snapshot : transport.snapshot();
  useEffect(() => {
    const read = () => setCurrent({ transport, snapshot: transport.snapshot() });
    const unsubscribe = transport.subscribe(read);
    read();
    return unsubscribe;
  }, [transport]);
  return snapshot;
}
