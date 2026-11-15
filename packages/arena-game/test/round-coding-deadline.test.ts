import { describe, expect, it } from "vitest";
import { MATCH_DURATION_MS, ROUND_CODING_DURATION_MS } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { ArenaEngine } from "../src/engine.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P70, SOLVED_PY, setup, tick } from "./setup.js";
import { testPrincipal } from "../src/principal.js";

describe("per-side problem deadlines", () => {
  it("advances only the side whose problem deadline expires", async () => {
    const fx = await setup([P70], { roundDurationMs: 1_000 });
    fx.advance(200);
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    fx.advance(800);
    expect(await fx.engine.sweepExpiredMatches()).toEqual([fx.matchId]);
    const snap = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.progress.self.currentRound).toBe(2);
    expect(snap.progress.opponent.currentRound).toBe(2);
    expect(snap.reveals).toEqual([]);
  });

  it("rejects an action at cutoff instead of applying it to the next problem", async () => {
    const fx = await setup([], { roundDurationMs: 1_000 });
    fx.advance(1_000);
    await expect(fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow(/expired/);
    expect((await fx.engine.snapshot(fx.left, fx.matchId)).progress.self.currentRound).toBe(2);
  });

  it("counts a pre-cutoff evaluation that settles during grace", async () => {
    const fx = await setup([{ defer: true }], { roundDurationMs: 1_000, revealGraceMs: 100 });
    const accepted = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    fx.advance(1_000);
    const sweep = fx.engine.sweepExpiredMatches();
    setTimeout(() => fx.judge.release(P70), 10);
    await Promise.all([accepted, sweep]);
    const snap = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snap.progress.self).toMatchObject({ currentRound: 2, lastScore: 70 });
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.reveals).toEqual([]);
  });

  it("clamps side deadlines at the match deadline and publishes a final reveal", async () => {
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([]),
      bank: new FileBank(),
      clock: () => now,
      revealGraceMs: 0,
      roundDurationMs: ROUND_CODING_DURATION_MS,
    });
    const left = testPrincipal("user-left");
    const right = testPrincipal("user-right");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [{ userId: "user-left", sideId: "left" }, { userId: "user-right", sideId: "right" }],
      problemVersionIds: ["even-ledger-v2", "even-ledger-v2", "even-ledger-v2"],
      durationMs: MATCH_DURATION_MS,
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    now += MATCH_DURATION_MS;
    await engine.sweepExpiredMatches();
    const snap = await engine.snapshot(right, matchId);
    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
    expect(snap.reveals).toHaveLength(3);
    expect(snap.reveals.every((reveal) => reveal.cause === "MATCH_DEADLINE")).toBe(true);
  });
});
