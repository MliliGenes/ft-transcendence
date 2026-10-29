import { describe, expect, it } from "vitest";
import { FileBank } from "../src/judge.js";
import { inMemoryPersistence, type MatchPersistence } from "../src/persistence.js";
import { P100, SOLVED_PY, setup } from "./setup.js";

describe("07 run path (visible tests only, independent sides)", () => {
  it("1. A Run succeeds while B remains coding", async () => {
    const { engine, left, right, matchId } = await setup();
    const res = await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(res.tests.every((t) => t.passed)).toBe(true);
    const snap = await engine.snapshot(right, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.sides.right?.status).toBe("coding");
    expect(snap.reveal).toBeNull();
  });

  it("2. A Run completes while B submits", async () => {
    const { engine, left, right, matchId } = await setup([P100]);
    const aRun = engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    const receipt = await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
    const res = await aRun;
    expect(res.tests.every((t) => t.passed)).toBe(true);
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe("CODING");
  });

  it("3. judge receives visible tests only, never hidden material", async () => {
    const { engine, judge, left, matchId } = await setup();
    await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    const ids = judge.lastRunTests.map((t) => t.id);
    expect(ids).toEqual(["ex1", "ex2", "ex3"]);
    expect(ids).not.toContain("b1");
    const snap = await engine.snapshot(left, matchId);
    expect(JSON.stringify(snap)).not.toContain("1000000000");
    expect(JSON.stringify(snap)).not.toContain("hiddenGroups");
  });

  it("4. run judge failure returns A to coding and is recorded", async () => {
    const { engine, judge, left, right, matchId } = await setup();
    judge.failNextRun("judge unreachable");
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow("judge unreachable");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.failures).toEqual(["run: judge unreachable"]);
    expect(snap.sides.right?.status).toBe("coding");
  });

  it("5. run timeout verdict is represented without touching score", async () => {
    const { engine, judge, left, matchId } = await setup();
    judge.queueRunStatus("time_limit_exceeded");
    const res = await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(res.tests.every((t) => !t.passed)).toBe(true);
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.reveal).toBeNull();
  });

  it("6. invalid language and oversized source rejected before judge", async () => {
    const { engine, judge, left, matchId } = await setup();
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Brainfuck" })).rejects.toThrow();
    await expect(engine.run(left, matchId, { code: "", language: "Python" })).rejects.toThrow();
    await expect(engine.run(left, matchId, { code: "x".repeat(200 * 1024), language: "Python" })).rejects.toThrow();
    expect(judge.runCalls).toBe(0);
  });

  it("7. non-member principal rejected", async () => {
    const { engine, stranger, matchId } = await setup();
    await expect(engine.run(stranger, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    await expect(engine.submit(stranger, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    await expect(engine.snapshot(stranger, matchId)).rejects.toThrow();
  });

  it("8. duplicate concurrent Run for the same side is blocked", async () => {
    const { engine, judge, left, matchId } = await setup();
    judge.deferNextRun();
    const first = engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    judge.releaseRun();
    await first;
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("coding");
  });

  it("9. other side can still submit after A run failure", async () => {
    const { engine, judge, left, right, matchId } = await setup([{ score: 100 }]);
    judge.failNextRun("boom");
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    const receipt = await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
  });

  it("10. a bank setup failure leaves the side coding and the next Run succeeds", async () => {
    const bank = new FileBank();
    let unavailable = false;
    const { engine, left, matchId } = await setup([], {
      bank: {
        loadProblem(problemVersionId: string) {
          if (unavailable) throw new Error("bank read failed");
          return bank.loadProblem(problemVersionId);
        },
      },
    });
    unavailable = true;
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow("bank read failed");
    unavailable = false;

    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("coding");
    const retried = await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(retried.tests.every((test) => test.passed)).toBe(true);
  });

  it("11. a settlement write failure restores coding and the next Run succeeds", async () => {
    const base = inMemoryPersistence();
    const persistence: MatchPersistence = Object.create(base);
    let armed = false;
    persistence.saveMatch = async (...args) => {
      const match = args[0];
      if (armed && match.rounds.some((round) => round.runTests.left !== undefined)) {
        armed = false;
        throw new Error("settlement write failed");
      }
      return base.saveMatch(...args);
    };
    const { engine, left, matchId } = await setup([], { persistence });
    armed = true;

    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow("settlement write failed");

    const stored = (await base.loadMatch(matchId))!;
    expect(stored.rounds[0]!.activities.left).toBe("coding");
    const snapshot = await engine.snapshot(left, matchId);
    expect(snapshot.sides.left?.status).toBe("coding");
    expect(snapshot.failures).toContain("run: settlement write failed");
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).resolves.toMatchObject({ runId: expect.any(String) });
  });

  it("12. a lost settlement acknowledgement keeps the committed verdicts", async () => {
    const base = inMemoryPersistence();
    const persistence: MatchPersistence = Object.create(base);
    let armed = false;
    persistence.saveMatch = async (...args) => {
      const match = args[0];
      if (armed && match.rounds.some((round) => round.runTests.left !== undefined)) {
        armed = false;
        await base.saveMatch(...args);
        throw new Error("settlement ack lost");
      }
      return base.saveMatch(...args);
    };
    const { engine, left, matchId } = await setup([], { persistence });
    armed = true;

    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow("settlement ack lost");

    const snapshot = await engine.snapshot(left, matchId);
    expect(snapshot.sides.left?.status).toBe("coding");
    expect(snapshot.tests.every((test) => test.status === "passed")).toBe(true);
    expect(snapshot.failures).toContain("run: settlement ack lost");
  });

  it("13. failed acceptance recovery cannot unlock a newer Run for the same side", async () => {
    const base = inMemoryPersistence();
    const persistence: MatchPersistence = Object.create(base);
    let fixture: Awaited<ReturnType<typeof setup>>;
    let armed = false;
    let queuedRun: Promise<unknown> | undefined;
    persistence.saveMatch = async (...args) => {
      if (armed && args[0].rounds[0]!.activities.left === "running") {
        armed = false;
        // This request waits on the first Run's lock, ahead of its recovery.
        queuedRun = fixture.engine.run(fixture.left, fixture.matchId, { code: SOLVED_PY, language: "Python" });
        throw new Error("acceptance write failed");
      }
      return base.saveMatch(...args);
    };
    fixture = await setup([], { persistence });
    const { engine, judge, left, matchId } = fixture;
    judge.deferNextRun();
    armed = true;

    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow("acceptance write failed");

    try {
      expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("running");
      await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow("running");
    } finally {
      judge.releaseRun();
      await queuedRun;
    }
  });
});
