import { calculateRoundScore } from "./lib/impl.js";

/** Public interface for the copy-me package. */
export function roundScore(passed: number, total: number): number {
  return calculateRoundScore(passed, total);
}
