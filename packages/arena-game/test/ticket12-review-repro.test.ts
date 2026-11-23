import { describe, expect, it } from "vitest";
import { ArenaEngine, MATCH_DURATION_MS, ROUND_CODING_DURATION_MS } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { InMemoryCollabPersist } from "../src/collab.js";
import { InMemoryMatchStore, InMemoryRevealStore, InMemorySubmissionStore } from "../src/store.js";
import { StoreBackedMatchPersistence } from "../src/persistence.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P60, P70, SOLVED_PY, setup, tick } from "./setup.js";
import { testPrincipal } from "../src/principal.js";

describe("TICKET-12 Desired Behavior: Round coding deadline regressions", () => {
  it("supersedes an evaluation completed after round cutoff+grace even if now >= matchDeadline", async () => {
    // Round coding deadline = 10 minutes (600,000 ms)
    // Match deadline = 30 minutes (1,800,000 ms)
    // Grace = 2000 ms
    const fx = await setup([{ defer: true }], {
      revealGraceMs: 2000,
      roundDurationMs: ROUND_CODING_DURATION_MS,
    });

    // Advance to minute 9.9 (590,000 ms), before round 1 cutoff, and submit
    fx.advance(590_000);
    const submissionPromise = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();

    // Advance to 30 minutes + 500 ms (1,800,500 ms from match start) - past round cutoff+grace AND match cutoff
    fx.advance(MATCH_DURATION_MS + 500 - 590_000);

    // Release the judge verdict now at minute 30.008
    fx.judge.release(P70);
    await submissionPromise;

    // SPEC REQUIREMENT:
    // Round 1 coding deadline expired at 600,000 ms, grace expired at 602,000 ms.
    // The evaluation completed at 1,800,500 ms (20 minutes after round 1 cutoff+grace).
    // The submission MUST be superseded and NOT counted.
    const round = (await fx.engine["authority"].loadOrThrow(fx.matchId)).rounds[0];
    const leftCounted = round.counted.left;
    expect(leftCounted).toBeUndefined();

    const subs = await fx.engine["persistence"].listRoundSubmissions(fx.matchId, round.roundId);
    expect(subs[0]?.status).toBe("superseded");
    expect(subs[0]?.score).toBeNull();
  });

  it("supersedes stale pending submissions in recoverPending without re-dispatching to judge", async () => {
    let now = 1_000_000;
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const collab = new InMemoryCollabPersist();
    const bank = new FileBank();

    // First process:
    const firstPersistence = new StoreBackedMatchPersistence({ matches, submissions, reveals, collab });
    const firstJudge = new ScriptedJudge([{ defer: true }]);
    const firstEngine = new ArenaEngine({
      bank,
      persistence: firstPersistence,
      clock: () => now,
      roundDurationMs: 600_000,
      revealGraceMs: 2000,
      judge: firstJudge,
    });
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
    void firstEngine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();

    // Advance time to minute 11 (660,000 ms)
    // Round 1 coding deadline was 600,000 ms, grace ended at 602,000 ms.
    // It is now 58 seconds PAST Round 1 grace expiration!
    now += 660_000;

    // Simulate Game service restart at minute 11:
    const secondPersistence = new StoreBackedMatchPersistence({ matches, submissions, reveals, collab });
    const secondJudge = new ScriptedJudge([P70]);
    const secondEngine = new ArenaEngine({
      bank,
      persistence: secondPersistence,
      clock: () => now,
      roundDurationMs: 600_000,
      revealGraceMs: 2000,
      judge: secondJudge,
    });

    // SPEC REQUIREMENT:
    // Because Round 1 deadline grace expired, recoverPending() must recognize that the
    // submission is no longer within grace. It should immediately supersede it without retrying.
    const recoveryReport = await secondEngine.recover();
    expect(recoveryReport.retried).toBe(0);
    expect(secondJudge.evalCalls).toBe(0);

    const round = (await secondPersistence.loadMatch(matchId))?.rounds[0];
    expect(round?.counted.left).toBeUndefined();
    const subs = await secondPersistence.listRoundSubmissions(matchId, round!.roundId);
    expect(subs[0]?.status).toBe("superseded");
  });

  it("supersedes expired Round 1 submission during restart recovery at minute 30 without counting", async () => {
    let now = 1_000_000;
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const collab = new InMemoryCollabPersist();
    const bank = new FileBank();

    const firstPersistence = new StoreBackedMatchPersistence({ matches, submissions, reveals, collab });
    const firstJudge = new ScriptedJudge([{ defer: true }]);
    const firstEngine = new ArenaEngine({
      bank,
      persistence: firstPersistence,
      clock: () => now,
      roundDurationMs: 600_000,
      revealGraceMs: 2000,
      judge: firstJudge,
    });
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
    void firstEngine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();

    // Advance directly to 30 minutes + 500 ms (1,800,500 ms)
    now += 1_800_500;

    // Restart at minute 30:
    const secondPersistence = new StoreBackedMatchPersistence({ matches, submissions, reveals, collab });
    const secondJudge = new ScriptedJudge([P70]);
    const secondEngine = new ArenaEngine({
      bank,
      persistence: secondPersistence,
      clock: () => now,
      roundDurationMs: 600_000,
      revealGraceMs: 2000,
      judge: secondJudge,
    });

    const recoveryReport = await secondEngine.recover();
    expect(recoveryReport.retried).toBe(0);
    expect(secondJudge.evalCalls).toBe(0);

    const round = (await secondPersistence.loadMatch(matchId))?.rounds[0];
    const leftCounted = round?.counted.left;
    expect(leftCounted).toBeUndefined();
    const subs = await secondPersistence.listRoundSubmissions(matchId, round!.roundId);
    expect(subs[0]?.status).toBe("superseded");
  });

  it("preserves previously counted score when a subsequent evaluation settles after round deadline grace", async () => {
    // Left submits at minute 1 and scores 60
    // Left submits again at minute 9.9, but that second submission settles after cutoff + grace
    // Left's counted score must remain 60 (not overwritten or dropped)
    const fx = await setup([P60, { defer: true }], {
      revealGraceMs: 2000,
      roundDurationMs: ROUND_CODING_DURATION_MS,
    });

    // First submission at minute 1 -> completes immediately with score 60
    fx.advance(60_000);
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    let round = (await fx.engine["authority"].loadOrThrow(fx.matchId)).rounds[0];
    expect(round.counted.left?.score).toBe(60);

    // Second submission at minute 9.9 (590,000 ms from match start)
    fx.advance(530_000); // 60,000 + 530,000 = 590,000 ms
    const secondSub = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();

    // Advance past round deadline (600,000 ms) and grace (602,000 ms)
    fx.advance(15_000); // 590,000 + 15,000 = 605,000 ms

    // Sweeper runs and closes round at deadline
    await fx.engine.sweepExpiredMatches();

    // Now release second submission's verdict (settles after cutoff + grace)
    fx.judge.release(P70);
    await secondSub;

    // Previously counted score 60 MUST stay intact!
    const match = await fx.engine["authority"].loadOrThrow(fx.matchId);
    round = match.rounds[0];
    expect(round.counted.left?.score).toBe(60);

    const finalSnap = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(finalSnap.reveal?.scores.left).toBe(60);
  });

  it("checks exact boundary rejection: accepts at cutoff - 1, rejects at exact cutoff", async () => {
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([P70]),
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
      problemVersionIds: ["even-ledger-v2"],
    });

    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);

    // Advance to exactly cutoff - 1 ms (599,999 ms from beginCoding)
    now += 599_999;
    // Should succeed
    const sub = await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(sub.ok).toBe(true);

    // Advance 1 ms to exactly cutoff (600,000 ms)
    now += 1;
    // At exact boundary, Run and Submit must reject
    await expect(
      engine.run(right, matchId, { code: SOLVED_PY, language: "Python" }),
    ).rejects.toThrow(/expired/);
    await expect(
      engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" }),
    ).rejects.toThrow(/expired/);
  });
});
