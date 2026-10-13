import { describe, expect, it } from "vitest";
import { ArenaEngine, testPrincipal } from "../src/index.js";
import { FileBank } from "../src/judge.js";
import { inMemoryPersistence, type MatchPersistence } from "../src/persistence.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P70, P100, SOLVED_PY, setup, tick } from "./setup.js";

async function fixture(mode: "1v1" | "2v2" = "2v2", persistence: MatchPersistence = inMemoryPersistence(), rounds = 2) {
  let now = 1000;
  const bank = new FileBank();
  const options = { judge: new ScriptedJudge([]), bank, persistence, clock: () => now, revealGraceMs: 0 };
  const engine = new ArenaEngine(options);
  const a = testPrincipal("a");
  const participants = mode === "1v1"
    ? [{ userId: "a", sideId: "left" }, { userId: "b", sideId: "right" }]
    : [{ userId: "a", sideId: "left" }, { userId: "mate", sideId: "left" }, { userId: "b", sideId: "right" }, { userId: "other", sideId: "right" }];
  const matchId = await engine.createMatch({ mode, participants, problemVersionIds: Array(rounds).fill("even-ledger") });
  await engine.startRound(a, matchId);
  await engine.beginCoding(a, matchId);
  return { engine, a, matchId, persistence, bank, advance: () => { now += 100; } };
}

function revealWriteFault(persistence: MatchPersistence) {
  const save = persistence.saveMatch.bind(persistence);
  let armed = false;
  persistence.saveMatch = async (...args) => {
    if (armed && args[0].roundPhase === "SCORE_REVEAL") {
      armed = false;
      throw new Error("injected Reveal Match write failure");
    }
    return save(...args);
  };
  return () => { armed = true; };
}

describe("Match rule diagnosis through public entry points", () => {
  it("keeps the selected team language when the next Round starts", async () => {
    const fx = await fixture();
    await fx.engine.setTeamLanguage(fx.a, fx.matchId, "C++");
    expect((await fx.persistence.loadMatch(fx.matchId))?.rounds[0]?.teamDocs?.left?.language).toBe("C++");
    await fx.engine.publishReveal(fx.a, fx.matchId);
    await fx.engine.nextRound(fx.a, fx.matchId);
    const sync = await fx.engine.collabSync(fx.a, fx.matchId);
    expect(sync.language).toBe("C++");
    expect(sync.source).toBe(fx.bank.loadProblem("even-ledger").starters["C++"]);
    expect(sync.revision).toBe(1);
  });

  it("resumes the same saved Reveal after its Match commit fails, then rejects ordinary repeats", async () => {
    const persistence = inMemoryPersistence();
    const failNext = revealWriteFault(persistence);
    const fx = await fixture("1v1", persistence, 1);
    const events: Array<{ event: string; revision?: number }> = [];
    fx.engine.on((event, payload) => events.push({ event, revision: (payload as { revision?: number }).revision }));
    failNext();
    await expect(fx.engine.publishReveal(fx.a, fx.matchId)).rejects.toThrow("injected Reveal Match write failure");
    const stored = (await persistence.loadMatch(fx.matchId))!;
    expect(stored.roundPhase).toBe("CODING");
    const saved = await persistence.findReveal(fx.matchId, stored.rounds[0]!.roundId);
    expect(saved).toBeDefined();
    expect(events).toHaveLength(0);
    fx.advance();
    const retried = await fx.engine.publishReveal(fx.a, fx.matchId);
    expect(retried).toEqual(saved);
    const snapshot = await fx.engine.snapshot(fx.a, fx.matchId);
    expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
    expect(snapshot.sides.left.status).toBe("locked");
    expect(snapshot.sides.right.status).toBe("locked");
    expect(events.filter(({ event }) => event === "reveal.published")).toEqual([{ event: "reveal.published", revision: snapshot.revision }]);
    retried.scores.left = -1;
    await expect(fx.engine.publishReveal(fx.a, fx.matchId)).rejects.toThrow(/SCORE_REVEAL/);
    expect((await fx.engine.snapshot(fx.a, fx.matchId)).reveal).toEqual(saved);
  });

  it("keeps a late verdict excluded while a saved Reveal waits for its Match retry", async () => {
    const persistence = inMemoryPersistence();
    const failNext = revealWriteFault(persistence);
    const fx = await setup([P70, { defer: true }], { persistence });
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    const pending = fx.engine.submit(fx.left, fx.matchId, {
      code: SOLVED_PY, language: "Python", submissionId: "late-saved-reveal", evaluationId: "late-saved-reveal-evaluation",
    });
    await tick();
    failNext();
    await expect(fx.engine.publishReveal(fx.left, fx.matchId)).rejects.toThrow("injected Reveal Match write failure");
    const roundId = (await persistence.loadMatch(fx.matchId))!.rounds[0]!.roundId;
    const saved = await persistence.findReveal(fx.matchId, roundId);
    expect(saved?.scores.left).toBe(70);
    fx.judge.release(P100);
    await pending;
    expect((await persistence.findSubmissionById("late-saved-reveal"))?.status).toBe("superseded");
    expect(await fx.engine.publishReveal(fx.left, fx.matchId)).toEqual(saved);
    expect((await fx.engine.snapshot(fx.left, fx.matchId)).sides.left.submissions).toBe(1);
    fx.advance(30 * 60 * 1000);
    expect((await fx.engine.finalResult(fx.left, fx.matchId)).scores.left).toBe(70);
  });
});
