'use client';

import { useEffect, useState } from 'react';
import type { ArenaTransport } from '@/lib/arena/transport';
import type { ArenaSnapshot } from '@/lib/arena/types';

/**
 * Subscribes to the transport's authoritative snapshot.
 * Marked "use client" for Next.js App Router boundary safety.
 */
export function useArena(transport: ArenaTransport): ArenaSnapshot {
  const [snapshot, setSnapshot] = useState<ArenaSnapshot>(() =>
    transport.snapshot(),
  );

  useEffect(() => {
    return transport.subscribe(() => {
      setSnapshot(transport.snapshot());
    });
  }, [transport]);

  return snapshot;
}
