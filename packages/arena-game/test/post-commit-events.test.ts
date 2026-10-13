import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArenaEvent } from "arena-model";
import { inMemoryPersistence, type MatchPersistence } from "../src/persistence.js";
import { setup, SOLVED_PY } from "./setup.js";

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

  it("does not save a no-op command when another writer commits before its final read", async () => {
    const base = inMemoryPersistence();
    const persistence: MatchPersistence = Object.create(base);
    let armed = false;
    let reads = 0;
    let writes = 0;
    persistence.loadMatch = async (id) => {
      if (armed && ++reads === 3) {
        const remote = (await base.loadMatch(id))!;
        const revision = remote.revision;
        remote.revision += 1;
        remote.presence.left = "online";
        await base.saveMatch(remote, revision);
      }
      return base.loadMatch(id);
    };
    persistence.saveMatch = async (...args) => {
      if (armed) writes += 1;
      return base.saveMatch(...args);
    };
    const fx = await setup([], { persistence });
    armed = true;

    await expect(fx.engine.setReady(fx.left, fx.matchId, { ready: true })).resolves.toBeUndefined();
    expect(writes).toBe(0);
    await expect(base.loadMatch(fx.matchId)).resolves.toMatchObject({ presence: { left: "online" } });
  });

  it.each(["ordinary", "claim"])("keeps the confirmed %s result and event revision when the final read fails", async (kind) => {
    const base = inMemoryPersistence();
    const persistence: MatchPersistence = Object.create(base);
    let armed = false;
    let failRead = false;
    persistence.loadMatch = async (id) => {
      if (failRead) {
        failRead = false;
        throw new Error("post-commit read failed");
      }
      return base.loadMatch(id);
    };
    persistence.saveMatch = async (...args) => {
      await base.saveMatch(...args);
      if (armed) failRead = true;
    };
    persistence.commitClaimedEvaluation = async (...args) => {
      await base.commitClaimedEvaluation(...args);
      if (armed) failRead = true;
    };
    const fx = await setup([{ score: 100 }], { persistence });
    const received: Array<{ event: ArenaEvent; revision?: number }> = [];
    fx.engine.on((event, payload) => received.push({ event, revision: (payload as { revision?: number }).revision }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    armed = true;

    if (kind === "ordinary") {
      await expect(fx.engine.leaveMatch(fx.left, fx.matchId)).resolves.toEqual({ winner: "right", loser: "left" });
    } else {
      await expect(fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" })).resolves.toMatchObject({ ok: true });
    }
    const stored = (await base.loadMatch(fx.matchId))!;
    expect(received.at(-1)?.revision).toBe(stored.revision);
    expect(received.at(-1)?.event).toBe(kind === "ordinary" ? "match.ended" : "player.statusChanged");
    expect(stored.roundPhase).toBe(kind === "ordinary" ? "MATCH_COMPLETE" : "CODING");
  });

  it("rejects a failed initial read without writing and releases the command lock", async () => {
    const base = inMemoryPersistence();
    const persistence: MatchPersistence = Object.create(base);
    let failRead = false;
    persistence.loadMatch = async (id) => {
      if (failRead) { failRead = false; throw new Error("initial read failed"); }
      return base.loadMatch(id);
    };
    const fx = await setup([], { persistence });
    failRead = true;
    await expect(fx.engine.leaveMatch(fx.left, fx.matchId)).rejects.toThrow("initial read failed");
    await expect(base.loadMatch(fx.matchId)).resolves.toMatchObject({ roundPhase: "CODING" });
    await expect(fx.engine.leaveMatch(fx.left, fx.matchId)).resolves.toEqual({ winner: "right", loser: "left" });
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
