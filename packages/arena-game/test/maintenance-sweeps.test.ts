import { describe, expect, it, vi } from "vitest";
import { ArenaEngine, MATCH_DURATION_MS, testPrincipal, type MatchRecord } from "../src/index.js";
import { FileBank } from "../src/judge.js";
import {
  InMemoryCollabPersist,
  InMemoryMatchStore,
  InMemoryRevealStore,
  InMemorySubmissionStore,
  StoreBackedMatchPersistence,
} from "../src/persistence.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P100, SOLVED_PY, setup } from "./setup.js";

function trackingPersistence() {
  const matches = new InMemoryMatchStore();
  const submissions = new InMemorySubmissionStore();
  const reveals = new InMemoryRevealStore();
  const collab = new InMemoryCollabPersist();
  const persistence = new StoreBackedMatchPersistence({ matches, submissions, reveals, collab });

  let loadMatchCalls = 0;
  const originalLoad = matches.load.bind(matches);
  matches.load = async (id: string) => {
    loadMatchCalls++;
    return originalLoad(id);
  };

  return {
    persistence,
    matches,
    getLoadCount: () => loadMatchCalls,
    resetCount: () => {
      loadMatchCalls = 0;
    },
  };
}

function completedMatch(id: string, startedAt: number, revision = 1): MatchRecord {
  return {
    id,
    mode: "1v1",
    roundPhase: "MATCH_COMPLETE",
    currentRound: 1,
    totalRounds: 1,
    durationMs: MATCH_DURATION_MS,
    startedAt,
    participants: [
      { userId: `${id}-left`, sideId: "left" },
      { userId: `${id}-right`, sideId: "right" },
    ],
    rounds: [{
      roundId: `${id}-round`,
      problemVersionId: "even-ledger",
      hiddenSuiteId: "h1",
      counted: {},
      attempts: {},
      activities: { left: "locked", right: "locked" },
      runTests: {},
      reveal: null,
      closing: false,
      cutoffPassed: true,
      superseded: [],
    }],
    failures: [],
    revision,
    presence: { left: "offline", right: "offline" },
    offlineSinceMs: {},
    forfeit: null,
  };
}

describe("Bounded Match maintenance sweeps (#5)", () => {
  it("measures deterministic work growth as completed Match history grows (baseline proof)", async () => {
    const { persistence, matches, getLoadCount, resetCount } = trackingPersistence();
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([P100]),
      bank: new FileBank(),
      persistence,
      clock: () => now,
      reconnectGraceMs: 5000,
    });

    const left = testPrincipal("p1");
    const right = testPrincipal("p2");

    // Create 1 active match
    const activeMatchId = await engine.createMatch({
      mode: "1v1",
      problemVersionIds: ["even-ledger"],
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: right.userId, sideId: "right" },
      ],
    });
    await engine.startRound(left, activeMatchId);
    await engine.beginCoding(left, activeMatchId);

    // Measure sweeps with 0 completed matches
    resetCount();
    await engine.sweepExpiredMatches();
    const expiredLoadsWith0Completed = getLoadCount();

    resetCount();
    await engine.sweepGrace();
    const graceLoadsWith0Completed = getLoadCount();

    resetCount();
    await engine.recover();
    const recoverLoadsWith0Completed = getLoadCount();

    console.log("BASELINE with 0 completed matches:", {
      expiredLoadsWith0Completed,
      graceLoadsWith0Completed,
      recoverLoadsWith0Completed,
    });

    // Populate 50 completed matches directly into store
    for (let i = 1; i <= 50; i++) {
      await matches.save(completedMatch(`completed-hist-${i}`, now - 100_000, 5));
    }

    // Measure sweeps with 50 completed matches
    resetCount();
    await engine.sweepExpiredMatches();
    const expiredLoadsWith50Completed = getLoadCount();

    resetCount();
    await engine.sweepGrace();
    const graceLoadsWith50Completed = getLoadCount();

    resetCount();
    await engine.recover();
    const recoverLoadsWith50Completed = getLoadCount();

    console.log("BASELINE with 50 completed matches:", {
      expiredLoadsWith50Completed,
      graceLoadsWith50Completed,
      recoverLoadsWith50Completed,
    });

    // Assert that work is bounded independently of completed history:
    // With fix, loads should be bounded to active candidates (e.g. <= 1), not 51!
    expect(expiredLoadsWith50Completed).toBe(expiredLoadsWith0Completed);
    expect(graceLoadsWith50Completed).toBe(graceLoadsWith0Completed);
    expect(recoverLoadsWith50Completed).toBe(recoverLoadsWith0Completed);
  });

  it("due active expired match transitions to MATCH_COMPLETE in presence of completed history", async () => {
    const matches = new InMemoryMatchStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions: new InMemorySubmissionStore(),
      reveals: new InMemoryRevealStore(),
      collab: new InMemoryCollabPersist(),
    });
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([P100]),
      bank: new FileBank(),
      persistence,
      clock: () => now,
      revealGraceMs: 0,
    });

    const left = testPrincipal("due-p1");
    const right = testPrincipal("due-p2");
    const activeMatchId = await engine.createMatch({
      mode: "1v1",
      problemVersionIds: ["even-ledger"],
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: right.userId, sideId: "right" },
      ],
    });
    await engine.startRound(left, activeMatchId);
    await engine.beginCoding(left, activeMatchId);

    // Save completed history
    for (let i = 1; i <= 20; i++) {
      await matches.save(completedMatch(`hist-${i}`, now - 50_000));
    }

    // Advance clock past match deadline
    now += MATCH_DURATION_MS + 1000;

    const expired = await engine.sweepExpiredMatches();
    expect(expired).toEqual([activeMatchId]);

    const snapshot = await engine.snapshot(left, activeMatchId);
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
  });

  it("due disconnected match transitions to forfeit in presence of completed history", async () => {
    const matches = new InMemoryMatchStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions: new InMemorySubmissionStore(),
      reveals: new InMemoryRevealStore(),
      collab: new InMemoryCollabPersist(),
    });
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([P100]),
      bank: new FileBank(),
      persistence,
      clock: () => now,
      reconnectGraceMs: 5000,
    });

    const left = testPrincipal("disc-p1");
    const right = testPrincipal("disc-p2");
    const activeMatchId = await engine.createMatch({
      mode: "1v1",
      problemVersionIds: ["even-ledger"],
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: right.userId, sideId: "right" },
      ],
    });
    await engine.startRound(left, activeMatchId);
    await engine.beginCoding(left, activeMatchId);
    await engine.setPresence(activeMatchId, "left", "online");
    await engine.setPresence(activeMatchId, "right", "online");

    // Right side goes offline
    await engine.setPresence(activeMatchId, "right", "offline");

    // Save completed history
    for (let i = 1; i <= 20; i++) {
      await matches.save(completedMatch(`grace-hist-${i}`, now - 50_000));
    }

    // Advance clock past reconnect grace (5000ms)
    now += 6000;

    const forfeited = await engine.sweepGrace();
    expect(forfeited).toEqual([activeMatchId]);

    const snapshot = await engine.snapshot(left, activeMatchId);
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.final?.forfeit).toMatchObject({ winner: "left", loser: "right", reason: "grace-expired" });
  });

  it("handles transient failure during sweep without aborting other candidates, retrying on next sweep", async () => {
    const matches = new InMemoryMatchStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions: new InMemorySubmissionStore(),
      reveals: new InMemoryRevealStore(),
      collab: new InMemoryCollabPersist(),
    });
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([P100]),
      bank: new FileBank(),
      persistence,
      clock: () => now,
      revealGraceMs: 0,
    });

    const p1 = testPrincipal("m1-p1");
    const p2 = testPrincipal("m1-p2");
    const p3 = testPrincipal("m2-p1");
    const p4 = testPrincipal("m2-p2");

    const match1 = await engine.createMatch({
      mode: "1v1",
      problemVersionIds: ["even-ledger"],
      participants: [{ userId: p1.userId, sideId: "left" }, { userId: p2.userId, sideId: "right" }],
    });
    const match2 = await engine.createMatch({
      mode: "1v1",
      problemVersionIds: ["even-ledger"],
      participants: [{ userId: p3.userId, sideId: "left" }, { userId: p4.userId, sideId: "right" }],
    });

    await engine.startRound(p1, match1);
    await engine.beginCoding(p1, match1);
    await engine.startRound(p3, match2);
    await engine.beginCoding(p3, match2);

    now += MATCH_DURATION_MS + 1000;

    // Simulate transient failure on match1 load
    let failMatch1Once = true;
    const originalLoad = matches.load.bind(matches);
    matches.load = async (id: string) => {
      if (id === match1 && failMatch1Once) {
        failMatch1Once = false;
        throw new Error("transient connection timeout");
      }
      return originalLoad(id);
    };

    // First sweep: match1 fails transiently, match2 succeeds
    const outcomes1 = await engine.sweepExpiredMatches();
    expect(outcomes1).toContain(match2);
    expect(outcomes1).not.toContain(match1);

    // match2 is complete, match1 is still coding in store because its sweep failed
    expect((await matches.load(match2))?.roundPhase).toBe("MATCH_COMPLETE");
    expect((await matches.load(match1))?.roundPhase).toBe("CODING");

    // Second sweep: match1 retries and succeeds
    const outcomes2 = await engine.sweepExpiredMatches();
    expect(outcomes2).toEqual([match1]);
    expect((await matches.load(match1))?.roundPhase).toBe("MATCH_COMPLETE");
  });
});
