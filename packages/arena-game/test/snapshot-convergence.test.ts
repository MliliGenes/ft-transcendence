import { describe, expect, it } from "vitest";
import { inMemoryPersistence, type MatchPersistence } from "../src/persistence.js";
import { setup } from "./setup.js";

function countingPersistence(): { persistence: MatchPersistence; saves: () => number } {
  const base = inMemoryPersistence();
  let saves = 0;
  const persistence: MatchPersistence = Object.create(base);
  persistence.saveMatch = async (...args) => {
    saves += 1;
    return base.saveMatch(...args);
  };
  return { persistence, saves: () => saves };
}

describe("snapshot write/refresh convergence", () => {
  it("an unchanged snapshot neither writes nor advances the revision", async () => {
    const { persistence, saves } = countingPersistence();
    const { engine, left, matchId } = await setup([], { persistence });

    const first = await engine.snapshot(left, matchId);
    const writesAfterFirst = saves();
    const second = await engine.snapshot(left, matchId);

    expect(second.revision).toBe(first.revision);
    expect(saves()).toBe(writesAfterFirst);
  });

  it("a grace forfeit discovered by a snapshot is persisted, not only returned", async () => {
    const { persistence, saves } = countingPersistence();
    const { engine, left, matchId, advance } = await setup([], { persistence });
    await engine.setPresence(matchId, "left", "offline");
    advance(90_001);

    const writesBefore = saves();
    const snap = await engine.snapshot(left, matchId);

    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
    expect(snap.final?.forfeit).toMatchObject({ winner: "right", loser: "left", reason: "grace-expired" });
    expect(saves()).toBeGreaterThan(writesBefore);
    const stored = await persistence.loadMatch(matchId);
    expect(stored?.roundPhase).toBe("MATCH_COMPLETE");
    expect(stored?.forfeit).toMatchObject({ winner: "right", loser: "left", reason: "grace-expired" });
  });
});
