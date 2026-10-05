import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { ArenaEngine } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { CollabDocs, InMemoryCollabPersist } from "../src/collab.js";
import { InMemoryMatchStore, InMemorySubmissionStore, InMemoryRevealStore } from "../src/store.js";
import { testPrincipal } from "../src/principal.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P100, SOLVED_PY, tick } from "./setup.js";

class FailableMatches extends InMemoryMatchStore {
  failNext = false;
  override async save(...args: Parameters<InMemoryMatchStore["save"]>) {
    if (this.failNext) { this.failNext = false; throw new Error("Match commit failed"); }
    return super.save(...args);
  }
}

async function fixture(plans: ConstructorParameters<typeof ScriptedJudge>[0] = []) {
  let now = 1000;
  const matches = new FailableMatches();
  const submissions = new InMemorySubmissionStore();
  const reveals = new InMemoryRevealStore();
  const collab = new InMemoryCollabPersist();
  const judge = new ScriptedJudge(plans);
  const options = { judge, bank: new FileBank(), matches, submissions, reveals, collab, clock: () => now, revealGraceMs: 0 };
  const engine = new ArenaEngine(options);
  const a = testPrincipal("a");
  const b = testPrincipal("b");
  const documents = new Set<CollabDocs>();
  const seed = CollabDocs.prototype.seedOnce;
  const restore = CollabDocs.prototype.restoreState;
  vi.spyOn(CollabDocs.prototype, "seedOnce").mockImplementation(function (this: CollabDocs, ...args) {
    documents.add(this); return seed.apply(this, args);
  });
  vi.spyOn(CollabDocs.prototype, "restoreState").mockImplementation(function (this: CollabDocs, ...args) {
    documents.add(this); return restore.apply(this, args);
  });
  const matchId = await engine.createMatch({ mode: "2v2", participants: [
    { userId: "a", sideId: "left" }, { userId: "mate", sideId: "left" },
    { userId: "b", sideId: "right" }, { userId: "other", sideId: "right" },
  ], problemVersionIds: ["even-ledger"], durationMs: 1000 });
  await engine.startRound(a, matchId);
  await engine.beginCoding(a, matchId);
  const initial = await engine.collabSync(a, matchId);
  const edit = new Y.Doc();
  Y.applyUpdate(edit, new Uint8Array(Buffer.from(initial.stateB64, "base64")));
  edit.getText("source").insert(edit.getText("source").length, "\n# durable edit");
  await engine.applyCollabUpdate(a, matchId, {
    roundId: initial.roundId, updateB64: Buffer.from(Y.encodeStateAsUpdate(edit)).toString("base64"),
  });
  edit.destroy();
  const left = await engine.collabSync(a, matchId);
  const right = await engine.collabSync(b, matchId);
  const retained = () => [...documents].some((docs) => docs.has(left.roomId) || docs.has(right.roomId));
  return { engine, a, b, matchId, left, right, retained, matches, submissions, reveals, collab, judge, options, advance: () => { now += 1000; } };
}

afterEach(() => vi.restoreAllMocks());

describe("completed Match resource retirement through ArenaEngine", () => {
  it.each(["rounds", "deadline", "forfeit"])("releases live documents after %s completion while keeping durable results", async (path) => {
    const fx = await fixture();
    expect(fx.retained()).toBe(true);
    if (path === "rounds") {
      await fx.engine.publishReveal(fx.a, fx.matchId);
      await fx.engine.nextRound(fx.a, fx.matchId);
    } else if (path === "deadline") {
      fx.advance();
      await fx.engine.sweepExpiredMatches();
    } else await fx.engine.leaveMatch(fx.a, fx.matchId);
    expect(fx.retained()).toBe(false);
    const stored = await fx.matches.load(fx.matchId);
    expect(stored?.roundPhase).toBe("MATCH_COMPLETE");
    expect(await fx.collab.load(fx.matchId, fx.left.roundId, "left")).toBeDefined();
    expect((await fx.engine.snapshot(fx.a, fx.matchId)).final).toBeDefined();
    if (path !== "forfeit") expect(await fx.reveals.get(fx.matchId, fx.left.roundId)).toBeDefined();
  });

  it("retains live documents on a failed terminal commit and retires them after retry", async () => {
    const fx = await fixture();
    fx.matches.failNext = true;
    await expect(fx.engine.leaveMatch(fx.a, fx.matchId)).rejects.toThrow("commit failed");
    expect(fx.retained()).toBe(true);
    expect((await fx.matches.load(fx.matchId))?.roundPhase).toBe("CODING");
    expect((await fx.engine.collabSync(fx.a, fx.matchId)).source).toBe(fx.left.source);
    await fx.engine.leaveMatch(fx.a, fx.matchId);
    expect(fx.retained()).toBe(false);
  });

  it("reloads terminal documents for queued/repeated reconnect reads, then retires each read", async () => {
    const fx = await fixture();
    const ending = fx.engine.leaveMatch(fx.a, fx.matchId);
    const queuedRead = fx.engine.collabSync(fx.a, fx.matchId);
    await ending;
    expect((await queuedRead).source).toBe(fx.left.source);
    expect(fx.retained()).toBe(false);
    for (let n = 0; n < 5; n++) {
      expect((await fx.engine.collabSync(fx.b, fx.matchId)).source).toBe(fx.right.source);
      expect(fx.retained()).toBe(false);
    }
    const recovered = new ArenaEngine(fx.options);
    expect((await recovered.collabSync(fx.a, fx.matchId)).source).toBe(fx.left.source);
    expect(fx.retained()).toBe(false);
    expect((await recovered.snapshot(fx.a, fx.matchId)).roundPhase).toBe("MATCH_COMPLETE");
  });

  it("lets an accepted evaluation settle after completion without reviving live documents", async () => {
    const fx = await fixture([{ defer: true }]);
    await fx.engine.setReady(fx.a, fx.matchId, { ready: true, documentRevision: fx.left.revision });
    await fx.engine.setReady(testPrincipal("mate"), fx.matchId, { ready: true, documentRevision: fx.left.revision });
    const submitting = fx.engine.submit(fx.a, fx.matchId, {
      code: fx.left.source, language: "Python", documentRevision: fx.left.revision,
      submissionId: "late-submission", evaluationId: "late-evaluation",
    });
    await tick();
    await fx.engine.leaveMatch(fx.b, fx.matchId);
    expect(fx.retained()).toBe(false);
    fx.judge.release(P100);
    await submitting;
    expect((await fx.submissions.getBySubmissionId("late-submission"))?.status).not.toBe("pending");
    expect((await fx.engine.snapshot(fx.a, fx.matchId)).roundPhase).toBe("MATCH_COMPLETE");
    expect(fx.retained()).toBe(false);
  });

  it("lets an accepted Run settle after completion without recreating documents", async () => {
    const fx = await fixture();
    fx.judge.deferNextRun();
    const running = fx.engine.run(fx.a, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    await fx.engine.leaveMatch(fx.b, fx.matchId);
    fx.judge.releaseRun();
    await running;
    expect((await fx.engine.snapshot(fx.a, fx.matchId)).roundPhase).toBe("MATCH_COMPLETE");
    expect(fx.retained()).toBe(false);
  });
});
