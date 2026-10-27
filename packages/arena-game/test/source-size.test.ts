import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { inMemoryPersistence } from "../src/persistence.js";
import * as Y from "yjs";
import { ArenaEngine, testPrincipal } from "../src/index.js";
import { FileBank } from "../src/judge.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { tick } from "./setup.js";
import { setup } from "./setup.js";

describe("UTF-8 source admission", () => {
  for (const action of ["run", "submit"] as const) {
    for (const code of ["abcd", "éé"]) {
      it(`${action} accepts ${code} at the inclusive four-byte cap`, async () => {
        const { engine, left, matchId } = await setup([], { maxSourceBytes: 4 });
        await expect(engine[action](left, matchId, { code, language: "Python" })).resolves.toBeDefined();
      });
    }
    for (const code of ["abcde", "ééé", ""]) {
      it(`${action} rejects ${JSON.stringify(code)} before execution or counting`, async () => {
        const { engine, judge, left, matchId } = await setup([], { maxSourceBytes: 4 });
        await expect(engine[action](left, matchId, { code, language: "Python" })).rejects.toThrow(code ? "source exceeds 4 bytes" : "empty source");
        expect(judge.runCalls).toBe(0);
        expect(judge.evalCalls).toBe(0);
        expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(0);
      });
    }
  }
});

async function legacyPending() {
  const persistence = inMemoryPersistence();
  const fx = await setup([], { persistence, maxSourceBytes: 4 });
  const match = (await persistence.loadMatch(fx.matchId))!;
  await persistence.recordSubmission({
    submissionId: "legacy-sub", evaluationId: "legacy-eval", matchId: fx.matchId,
    roundId: match.rounds[0]!.roundId, sideId: "left", problemVersionId: "even-ledger",
    language: "Python", source: "ééé", sourceHash: createHash("sha256").update("ééé").digest("hex"),
    documentRevision: null, submittedAt: 1_000_000, elapsedMatchMs: 0,
    status: "pending", score: null, scoreBp: null, groups: null, testStatuses: null, failureCode: null,
  });
  const input = { code: "ééé", language: "Python", submissionId: "legacy-sub", evaluationId: "legacy-eval" };
  return { ...fx, persistence, input };
}

it("resumes accepted oversized work and attaches exact in-flight retries outside the lock", async () => {
  const { engine, judge, left, matchId, input, persistence } = await legacyPending();
  judge.queuePlan({ defer: true });
  const first = engine.submit(left, matchId, input);
  const firstObserved = first.then(value => ({ value }), error => ({ error }));
  await tick();
  expect(judge.evalCalls).toBe(1);
  const retry = engine.submit(left, matchId, input);
  const changed = engine.submit(left, matchId, { ...input, code: "changed" });
  const changedObserved = expect(changed).rejects.toThrow("different submission data");
  judge.release({ score: 100 });
  const [original, receipt] = await Promise.race([
    Promise.all([firstObserved, retry]),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("retry deadlock")), 500)),
  ]);
  expect(original).toEqual({ value: receipt });
  expect(receipt).toEqual({ ok: true, round: 1, submissionId: "legacy-sub", evaluationId: "legacy-eval" });
  await changedObserved;
  expect(judge.evalCalls).toBe(1);
  expect((await persistence.findSubmissionByEvaluationId("legacy-eval"))?.status).toBe("completed");
});

it("returns a persisted accepted receipt after restart without judging and rejects changed identity", async () => {
  const { engine, left, matchId, input, persistence } = await legacyPending();
  await engine.recover();
  const judge = new ScriptedJudge([]);
  const reboot = new ArenaEngine({ judge, bank: new FileBank(), persistence, clock: () => 1_000_000, maxSourceBytes: 4 });
  await expect(reboot.submit(left, matchId, input)).resolves.toEqual({ ok: true, round: 1, submissionId: "legacy-sub", evaluationId: "legacy-eval" });
  await expect(reboot.submit(left, matchId, { ...input, submissionId: "other" })).rejects.toThrow("different submission data");
  expect(judge.evalCalls).toBe(0);
});

it("rejects new oversized work without a durable attempt and permits corrected reuse of its IDs", async () => {
  const persistence = inMemoryPersistence();
  const { engine, judge, left, matchId } = await setup([], { persistence, maxSourceBytes: 4 });
  const ids = { submissionId: "rejected-sub", evaluationId: "rejected-eval", language: "Python" };
  await expect(engine.submit(left, matchId, { ...ids, code: "ééé" })).rejects.toThrow("source exceeds");
  expect(await persistence.findSubmissionById(ids.submissionId)).toBeUndefined();
  const snapshot = await engine.snapshot(left, matchId);
  expect(snapshot.sides.left?.submissions).toBe(0);
  expect(snapshot.sides.left?.status).toBe("coding");
  expect(judge.evalCalls).toBe(0);
  await expect(engine.submit(left, matchId, { ...ids, code: "éé" })).resolves.toMatchObject({ submissionId: "rejected-sub", evaluationId: "rejected-eval" });
  expect(judge.evalCalls).toBe(1);
});

it("replays the original accepted failure to in-flight and persisted retries despite the tighter cap", async () => {
  const { engine, judge, left, matchId, input, persistence } = await legacyPending();
  judge.queuePlan({ defer: true });
  const first = expect(engine.submit(left, matchId, input)).rejects.toThrow("original infrastructure failure");
  await tick();
  const retry = expect(engine.submit(left, matchId, input)).rejects.toThrow("original infrastructure failure");
  judge.release({ infra: "original infrastructure failure" });
  await Promise.all([first, retry]);
  expect(judge.evalCalls).toBe(1);
  const rebootJudge = new ScriptedJudge([]);
  const reboot = new ArenaEngine({ judge: rebootJudge, bank: new FileBank(), persistence, clock: () => 1_000_000, maxSourceBytes: 4 });
  await expect(reboot.submit(left, matchId, input)).rejects.toThrow("evaluation previously failed");
  expect(rebootJudge.evalCalls).toBe(0);
});

for (const [source, clientCode, accepted] of [["éé", "oversized client payload", true], ["ééé", "a", false]] as const) {
  it(`2v2 admits the authoritative document ${source} rather than client source`, async () => {
    const judge = new ScriptedJudge([]);
    const persistence = inMemoryPersistence();
    const engine = new ArenaEngine({ judge, bank: new FileBank(), persistence, clock: () => 1_000_000, maxSourceBytes: 4 });
    const a1 = testPrincipal("a1"), a2 = testPrincipal("a2");
    const matchId = await engine.createMatch({ mode: "2v2", participants: [
      { userId: "a1", sideId: "left" }, { userId: "a2", sideId: "left" },
      { userId: "b1", sideId: "right" }, { userId: "b2", sideId: "right" },
    ], problemVersionIds: ["even-ledger"] });
    await engine.startRound(a1, matchId);
    await engine.beginCoding(a1, matchId);
    const sync = await engine.collabSync(a1, matchId);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Buffer.from(sync.stateB64, "base64"));
    const text = doc.getText("source");
    text.delete(0, text.length);
    text.insert(0, source);
    const { revision } = await engine.applyCollabUpdate(a1, matchId, { roundId: sync.roundId, updateB64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64") });
    doc.destroy();
    await engine.setReady(a1, matchId, { ready: true, documentRevision: revision });
    await engine.setReady(a2, matchId, { ready: true, documentRevision: revision });
    const input = { code: clientCode, language: "Python", documentRevision: revision, submissionId: "team-sub", evaluationId: "team-eval" };
    await expect(engine.submit(a1, matchId, { ...input, documentRevision: revision - 1 })).rejects.toThrow();
    if (accepted) {
      await expect(engine.submit(a1, matchId, input)).resolves.toMatchObject({ submissionId: "team-sub" });
      expect(await persistence.findSubmissionById("team-sub")).toMatchObject({ source: "éé", documentRevision: revision });
      expect(judge.evalCalls).toBe(1);
    } else {
      await expect(engine.submit(a1, matchId, input)).rejects.toThrow("source exceeds 4 bytes");
      expect(await persistence.findSubmissionById("team-sub")).toBeUndefined();
      expect(judge.evalCalls).toBe(0);
      expect((await engine.snapshot(a1, matchId)).sides.left?.submissions).toBe(0);
    }
  });
}
