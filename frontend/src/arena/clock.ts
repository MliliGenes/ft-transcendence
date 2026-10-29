import { useEffect, useState } from "react";
import type { ArenaSnapshot, ServerClockSample } from "./types.js";

/** Monotonic browser time; wall-clock adjustments cannot extend a Match. */
export function monotonicNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Remaining Match milliseconds from a server sample. Elapsed time is clamped
 * at zero so a non-monotonic caller can never extend the clock. The result
 * never goes below zero.
 */
export function remainingMsFromSample(sample: ServerClockSample, now = monotonicNow()): number {
  const elapsed = Math.max(0, now - sample.sampledAt);
  return Math.max(0, sample.remainingMs - elapsed);
}

/** Display seconds round up so the final second is shown, then clamp to 00:00. */
export function remainingSecondsFromSample(sample: ServerClockSample, now = monotonicNow()): number {
  return Math.ceil(remainingMsFromSample(sample, now) / 1000);
}

const TICK_MS = 250;

/**
 * Live header clock. Re-anchors on every applied snapshot (the only source of
 * authority) and ticks locally in between. Without a sample the coarse server
 * value is used, which keeps fixtures and SSR deterministic. State changes
 * only when the displayed second changes, not on every timer tick.
 */
export function useMatchClock(snapshot: ArenaSnapshot): number {
  const sample = snapshot.clock ?? null;
  const [seconds, setSeconds] = useState(() =>
    sample ? remainingSecondsFromSample(sample) : snapshot.remainingSeconds,
  );

  useEffect(() => {
    if (!sample) {
      setSeconds(snapshot.remainingSeconds);
      return;
    }
    const tick = () => setSeconds(remainingSecondsFromSample(sample));
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [sample, snapshot.remainingSeconds]);

  return sample ? seconds : snapshot.remainingSeconds;
}
