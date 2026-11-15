import { describe, expect, it } from "vitest";
import { P100, P70, SOLVED_PY, setup } from "./setup.js";

describe("independent async round progression", () => {
  it("advances a counted side immediately and keeps opponent scores private", async () => {
    const fx = await setup([P70]);
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });

    const own = await fx.engine.snapshot(fx.left, fx.matchId);
    const opponent = await fx.engine.snapshot(fx.right, fx.matchId);
    expect(own.roundPhase).toBe("CODING");
    expect(own.progress.self).toMatchObject({ currentRound: 2, stage: "CODING", lastScore: 70 });
    expect(own.progress.opponent).toMatchObject({ currentRound: 1, stage: "CODING" });
    expect(opponent.progress.self.currentRound).toBe(1);
    expect(own.reveals).toEqual([]);
    expect(own.reveal).toBeNull();
    expect(own.sides.right?.submissions).toBe(0);
  });

  it("lets one side finish all problems while the opponent remains on problem one", async () => {
    const fx = await setup([P100, P100, P100]);
    for (let i = 0; i < 3; i += 1) {
      await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    }
    const own = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(own.progress.self).toMatchObject({ currentRound: 3, stage: "FINISHED" });
    expect(own.progress.opponent).toMatchObject({ currentRound: 1, stage: "CODING" });
    expect(own.roundPhase).toBe("CODING");
    expect(own.reveals).toEqual([]);
  });

  it("times out only the side whose current problem deadline has expired", async () => {
    const fx = await setup([P70], { roundDurationMs: 1_000 });
    fx.advance(200);
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    fx.advance(800);
    await fx.engine.sweepExpiredMatches();

    const own = await fx.engine.snapshot(fx.left, fx.matchId);
    const opponent = await fx.engine.snapshot(fx.right, fx.matchId);
    expect(own.progress.self.currentRound).toBe(2);
    expect(own.progress.opponent.currentRound).toBe(2);
    expect(opponent.progress.self.currentRound).toBe(2);
    expect(own.roundPhase).toBe("CODING");
    expect(own.reveals).toEqual([]);
  });

  it("publishes all problem reveals once both sides finish", async () => {
    const fx = await setup([P100, P70, P100, P70, P100, P70]);
    for (let i = 0; i < 3; i += 1) {
      await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    }
    for (let i = 0; i < 3; i += 1) {
      await fx.engine.submit(fx.right, fx.matchId, { code: SOLVED_PY, language: "Python" });
    }
    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.reveals.map((reveal) => reveal.round)).toEqual([1, 2, 3]);
    expect(snapshot.reveals.map((reveal) => reveal.scores.left)).toEqual([100, 70, 100]);
    expect(snapshot.reveals.map((reveal) => reveal.scores.right)).toEqual([70, 100, 70]);
    expect(snapshot.final?.scores).toEqual({ left: 270, right: 240 });
    expect(snapshot.reveals[2]?.cause).toBe("REVEAL_CONDITION_MET");
  });
});
