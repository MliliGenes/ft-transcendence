import { describe, expect, it } from "vitest";
import { P100, P70, SOLVED_PY, setup } from "./setup.js";

describe("final scoring and reveal", () => {
  it("keeps per-problem results hidden until both sides finish", async () => {
    const fx = await setup([P100, P70, P100, P70, P100, P70]);
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    const beforeFinal = await fx.engine.snapshot(fx.right, fx.matchId);
    expect(beforeFinal.roundPhase).toBe("CODING");
    expect(beforeFinal.reveal).toBeNull();
    expect(beforeFinal.reveals).toEqual([]);
    expect(beforeFinal.progress.opponent).toMatchObject({ currentRound: 2, stage: "CODING" });
    await expect(fx.engine.publishReveal(fx.right, fx.matchId)).rejects.toThrow(/both sides finish/);
  });

  it("publishes all counted rounds and computes the final winner once", async () => {
    const fx = await setup([P100, P100, P100, P70, P70, P70]);
    for (const principal of [fx.left, fx.right]) {
      for (let round = 0; round < 3; round += 1) {
        await fx.engine.submit(principal, fx.matchId, { code: SOLVED_PY, language: "Python" });
      }
    }
    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.reveals).toHaveLength(3);
    expect(snapshot.final).toMatchObject({ scores: { left: 300, right: 210 }, winner: "left" });
    expect(snapshot.reveals[2]?.totals).toEqual({ left: 300, right: 210 });
    await expect(fx.engine.publishReveal(fx.left, fx.matchId)).resolves.toMatchObject({ round: 3 });
  });
});
