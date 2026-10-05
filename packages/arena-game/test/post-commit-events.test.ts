import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArenaEvent } from "arena-model";
import { inMemoryPersistence, type MatchPersistence } from "../src/persistence.js";
import { setup } from "./setup.js";

afterEach(() => vi.restoreAllMocks());

describe("ArenaEngine post-commit events", () => {
  it("does not publish a terminal event when the Match save fails", async () => {
    const base = inMemoryPersistence();
    let failNext = false;
    const persistence: MatchPersistence = Object.create(base);
    persistence.saveMatch = async (...args) => {
      if (failNext) {
        failNext = false;
        throw new Error("injected Match save failure");
      }
      return base.saveMatch(...args);
    };
    const fx = await setup([], { persistence });
    const emitted: ArenaEvent[] = [];
    fx.engine.on((event) => emitted.push(event));
    failNext = true;

    await expect(fx.engine.leaveMatch(fx.left, fx.matchId)).rejects.toThrow("injected Match save failure");

    expect(emitted).not.toContain("match.ended");
    expect((await fx.engine.snapshot(fx.left, fx.matchId)).roundPhase).toBe("CODING");
  });

  it("uses the committed revision and isolates listener failures", async () => {
    const fx = await setup([]);
    const failed = vi.spyOn(console, "error").mockImplementation(() => {});
    const received: Array<{ event: ArenaEvent; payload: { revision?: number } }> = [];
    fx.engine.on(() => {
      throw new Error("broken listener");
    });
    fx.engine.on((event, payload) => {
      received.push({ event, payload: payload as { revision?: number } });
    });

    await expect(fx.engine.setPresence(fx.matchId, "left", "offline")).resolves.toBe("offline");

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(received).toContainEqual({
      event: "player.presenceChanged",
      payload: expect.objectContaining({ revision: snapshot.revision }),
    });
    expect(snapshot.sides.left?.presence).toBe("offline");
    expect(failed).toHaveBeenCalled();
  });
});
