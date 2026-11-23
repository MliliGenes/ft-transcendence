import { describe, expect, it } from "vitest";
import { ArenaEngine, MATCH_DURATION_MS, ROUND_CODING_DURATION_MS } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { InMemoryCollabPersist } from "../src/collab.js";
import { InMemoryMatchStore, InMemoryRevealStore, InMemorySubmissionStore } from "../src/store.js";
import { StoreBackedMatchPersistence } from "../src/persistence.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P100, P70, SOLVED_PY, setup, tick } from "./setup.js";
import { testPrincipal } from "../src/principal.js";

describe("Round coding deadline (TICKET-12)", () => {
  it("reveals immediately when both sides submit before the deadline", async () => {
    const fx = await setup([P70, P100]);
    const events: string[] = [];
    fx.engine.on((event) => events.push(event));

    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    let snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("CODING");
    expect(snapshot.reveal).toBeNull();

    await fx.engine.submit(fx.right, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await fx.engine.autoRevealIfAllSidesCounted(fx.matchId, { graceMs: 0 });
    snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
    expect(snapshot.reveal?.scores).toEqual({ left: 70, right: 100 });
    expect(events).toContain("reveal.published");
    expect(events).not.toContain("match.ended");
  });

  it("reveals at the 10-minute round deadline when one side does not submit and assigns zero to unscored side", async () => {
    const fx = await setup([P70]);
    const events: string[] = [];
    fx.engine.on((event) => events.push(event));

    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });

    // Advance 10 minutes (round deadline)
    fx.advance(ROUND_CODING_DURATION_MS);

    // Sweep closes the expired round at round deadline
    const swept = await fx.engine.sweepExpiredMatches();
    expect(swept).toEqual([fx.matchId]);

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
    expect(snapshot.reveal?.scores).toEqual({ left: 70, right: 0 });
    expect(snapshot.reveal?.cause).toBe("ROUND_DEADLINE");
    expect(snapshot.reveal?.noSubmission).toEqual({ left: false, right: true });
    expect(events).toContain("reveal.published");
    expect(events).not.toContain("match.ended");

    // Allows advancing to the next round
    await fx.engine.nextRound(fx.left, fx.matchId);
    const round2 = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(round2.roundPhase).toBe("ROUND_INTRO");
    expect(round2.round).toBe(2);
  });

  it("assigns zero to both sides when neither submits before the round deadline", async () => {
    const fx = await setup([]);
    const events: string[] = [];
    fx.engine.on((event) => events.push(event));

    fx.advance(ROUND_CODING_DURATION_MS);
    await fx.engine.sweepExpiredMatches();

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
    expect(snapshot.reveal?.scores).toEqual({ left: 0, right: 0 });
    expect(snapshot.reveal?.cause).toBe("ROUND_DEADLINE");
    expect(snapshot.reveal?.noSubmission).toEqual({ left: true, right: true });
    expect(events).toContain("reveal.published");
    expect(events).not.toContain("match.ended");
  });

  it("rejects new Run and Submit actions at and after the round cutoff", async () => {
    const fx = await setup([]);
    fx.advance(ROUND_CODING_DURATION_MS);

    await expect(
      fx.engine.run(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" }),
    ).rejects.toThrow(/expired/);

    await expect(
      fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" }),
    ).rejects.toThrow(/expired/);

    fx.advance(5000);
    await expect(
      fx.engine.submit(fx.right, fx.matchId, { code: SOLVED_PY, language: "Python" }),
    ).rejects.toThrow(/expired/);
  });

  it("counts a submission accepted before the cutoff that settles inside bounded evaluation grace", async () => {
    const graceMs = 100;
    const fx = await setup([{ defer: true }], { revealGraceMs: graceMs });

    // Submit right before deadline cutoff
    const submission = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    fx.advance(ROUND_CODING_DURATION_MS);

    // Closing starts: waits for in-flight evaluation during grace
    const closing = fx.engine.sweepExpiredMatches();
    setTimeout(() => fx.judge.release(P70), 10);
    await Promise.all([submission, closing]);

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
    expect(snapshot.reveal?.scores.left).toBe(70);
    expect(snapshot.reveal?.scores.right).toBe(0);
    expect(snapshot.reveal?.noSubmission?.left).toBe(false);
    expect(snapshot.reveal?.noSubmission?.right).toBe(true);
  });

  it("supersedes a submission accepted before cutoff that settles after evaluation grace", async () => {
    const graceMs = 30;
    const fx = await setup([{ defer: true }], { revealGraceMs: graceMs });

    const submission = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    fx.advance(ROUND_CODING_DURATION_MS);

    const closing = fx.engine.sweepExpiredMatches();
    setTimeout(() => {
      fx.advance(graceMs + 1);
      fx.judge.release(P70);
    }, 5);
    await Promise.all([submission, closing]);

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
    expect(snapshot.reveal?.scores.left).toBe(0);
    expect(snapshot.reveal?.noSubmission?.left).toBe(true);
  });

  it("caps round deadline at the 30-minute overall match deadline", async () => {
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([P70]),
      bank: new FileBank(),
      clock: () => now,
      revealGraceMs: 0,
      roundDurationMs: ROUND_CODING_DURATION_MS, // 10 minutes
    });
    const left = testPrincipal("user-left");
    const right = testPrincipal("user-right");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger-v2", "even-ledger-v2", "even-ledger-v2"],
      durationMs: MATCH_DURATION_MS, // 30 minutes
    });

    // Start Round 1 at minute 0, advance 10m
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    now += ROUND_CODING_DURATION_MS;
    await engine.sweepExpiredMatches();
    await engine.nextRound(left, matchId);

    // Start Round 2 at minute 10, advance 10m
    await engine.beginCoding(left, matchId);
    now += ROUND_CODING_DURATION_MS;
    await engine.sweepExpiredMatches();
    await engine.nextRound(left, matchId);

    // Start Round 3 at minute 25 (only 5 minutes left in match!)
    now += 5 * 60 * 1000;
    await engine.beginCoding(left, matchId);

    const snap = await engine.snapshot(left, matchId);
    // Round deadline must be capped at match deadline: exactly 5 minutes remaining (300,000 ms), not 10 minutes (600,000 ms)
    expect(snap.roundRemainingMs).toBe(5 * 60 * 1000);
    expect(snap.remainingMs).toBe(5 * 60 * 1000);

    // Advance 5 minutes to minute 30
    now += 5 * 60 * 1000;
    await engine.sweepExpiredMatches();

    const terminalSnap = await engine.snapshot(left, matchId);
    expect(terminalSnap.roundPhase).toBe("MATCH_COMPLETE");
  });

  it("works for 2v2 teams under shared deadline and reveals unscored team as zero", async () => {
    let now = 1_000_000;
    const judge = new ScriptedJudge([P70]);
    const engine = new ArenaEngine({
      judge,
      bank: new FileBank(),
      clock: () => now,
      revealGraceMs: 0,
      roundDurationMs: 60_000,
    });
    const a1 = testPrincipal("alpha-1");
    const a2 = testPrincipal("alpha-2");
    const b1 = testPrincipal("beta-1");
    const b2 = testPrincipal("beta-2");
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "alpha-1", sideId: "left" },
        { userId: "alpha-2", sideId: "left" },
        { userId: "beta-1", sideId: "right" },
        { userId: "beta-2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger-v2", "even-ledger-v2"],
    });

    await engine.startRound(a1, matchId);
    await engine.beginCoding(a1, matchId);

    // Both alpha members ready and submit
    await engine.setReady(a1, matchId, { ready: true, documentRevision: 1 });
    await engine.setReady(a2, matchId, { ready: true, documentRevision: 1 });
    await engine.submit(a1, matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });

    // Beta team does not submit. Advance past the 60s round deadline
    now += 60_000;
    await engine.sweepExpiredMatches();

    const snapshot = await engine.snapshot(a1, matchId);
    expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
    expect(snapshot.reveal?.scores).toEqual({ left: 70, right: 0 });
    expect(snapshot.reveal?.noSubmission).toEqual({ left: false, right: true });

    // Can advance to round 2
    await engine.nextRound(a1, matchId);
    const round2 = await engine.snapshot(a1, matchId);
    expect(round2.round).toBe(2);
    expect(round2.roundPhase).toBe("ROUND_INTRO");
  });

  it("does not reset the deadline on repeated Begin Coding calls or player reconnects", async () => {
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([]),
      bank: new FileBank(),
      clock: () => now,
      roundDurationMs: 600_000,
    });
    const left = testPrincipal("user-left");
    const right = testPrincipal("user-right");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger-v2", "even-ledger-v2"],
    });

    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);

    const snap1 = await engine.snapshot(left, matchId);
    expect(snap1.roundRemainingMs).toBe(600_000);

    // Advance 2 minutes
    now += 120_000;

    // Repeated beginCoding call from either player
    await engine.beginCoding(left, matchId);
    await engine.beginCoding(right, matchId);

    const snap2 = await engine.snapshot(left, matchId);
    // Deadline must NOT have reset back to 600,000; it must be 480,000
    expect(snap2.roundRemainingMs).toBe(480_000);
  });

  it("preserves an active round deadline across Game service restart and recovery", async () => {
    let now = 1_000_000;
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const collab = new InMemoryCollabPersist();
    const bank = new FileBank();
    const persistence = new StoreBackedMatchPersistence({ matches, submissions, reveals, collab });

    const sharedOpts = {
      bank,
      persistence,
      clock: () => now,
      roundDurationMs: 600_000,
    };

    const firstEngine = new ArenaEngine({ ...sharedOpts, judge: new ScriptedJudge([P70]) });
    const left = testPrincipal("user-left");
    const right = testPrincipal("user-right");
    const matchId = await firstEngine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger-v2", "even-ledger-v2"],
    });

    await firstEngine.startRound(left, matchId);
    await firstEngine.beginCoding(left, matchId);
    await firstEngine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });

    // Advance 3 minutes
    now += 180_000;

    // Simulate Game service restart: create second engine instance with the same persistence
    const secondEngine = new ArenaEngine({ ...sharedOpts, judge: new ScriptedJudge([]) });
    await secondEngine.recover();
    await secondEngine.setPresence(matchId, "left", "online");
    await secondEngine.setPresence(matchId, "right", "online");

    const snapRestart = await secondEngine.snapshot(left, matchId);
    expect(snapRestart.roundPhase).toBe("CODING");
    // Deadline preserved: 600,000 - 180,000 = 420,000 ms remaining
    expect(snapRestart.roundRemainingMs).toBe(420_000);

    // Repeated beginCoding on recovered instance does not reset deadline
    await secondEngine.beginCoding(left, matchId);
    const snapAfterRepeat = await secondEngine.snapshot(left, matchId);
    expect(snapAfterRepeat.roundRemainingMs).toBe(420_000);

    // Advance remaining 7 minutes past deadline
    now += 420_000;
    await secondEngine.sweepExpiredMatches();

    const finalSnap = await secondEngine.snapshot(left, matchId);
    expect(finalSnap.roundPhase).toBe("SCORE_REVEAL");
    expect(finalSnap.reveal?.scores).toEqual({ left: 70, right: 0 });
    expect(finalSnap.reveal?.noSubmission).toEqual({ left: false, right: true });
  });
});
