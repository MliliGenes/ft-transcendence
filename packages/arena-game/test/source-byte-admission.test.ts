import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ArenaEngine, type EngineOptions } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { ValidationError } from "../src/judge.js";
import { testPrincipal, type AuthenticatedPrincipal } from "../src/principal.js";
import { ScriptedJudge, type ScriptPlan } from "./scripted-judge.js";
import { setup } from "./setup.js";

interface TeamFixture {
  engine: ArenaEngine;
  judge: ScriptedJudge;
  a1: AuthenticatedPrincipal;
  a2: AuthenticatedPrincipal;
  b1: AuthenticatedPrincipal;
  b2: AuthenticatedPrincipal;
  matchId: string;
}

async function setup2v2(
  plans: ScriptPlan[] = [{ score: 100 }],
  options: Partial<EngineOptions> = {},
): Promise<TeamFixture> {
  let now = 1_000_000;
  const judge = new ScriptedJudge(plans);
  const engine = new ArenaEngine({
    judge,
    bank: new FileBank(),
    clock: () => now,
    revealGraceMs: 0,
    ...options,
  });
  const a1 = testPrincipal("user-a1");
  const a2 = testPrincipal("user-a2");
  const b1 = testPrincipal("user-b1");
  const b2 = testPrincipal("user-b2");
  const matchId = await engine.createMatch({
    mode: "2v2",
    participants: [
      { userId: "user-a1", sideId: "left" },
      { userId: "user-a2", sideId: "left" },
      { userId: "user-b1", sideId: "right" },
      { userId: "user-b2", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger-v2", "even-ledger-v2"],
  });
  await engine.startRound(a1, matchId);
  await engine.beginCoding(a1, matchId);
  return { engine, judge, a1, a2, b1, b2, matchId };
}

async function setCollabSource(fx: TeamFixture, who: AuthenticatedPrincipal, source: string): Promise<number> {
  const sync = await fx.engine.collabSync(who, fx.matchId);
  const doc = new Y.Doc();
  if (sync.stateB64) Y.applyUpdate(doc, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
  const text = doc.getText("source");
  text.delete(0, text.length);
  text.insert(0, source);
  const res = await fx.engine.applyCollabUpdate(who, fx.matchId, {
    roundId: sync.roundId,
    updateB64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
  });
  doc.destroy();
  return res.revision;
}

async function readyBoth(fx: TeamFixture, revision: number): Promise<void> {
  await fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: revision });
  await fx.engine.setReady(fx.a2, fx.matchId, { ready: true, documentRevision: revision });
}

describe("TICKET-13 UTF-8 source admission limit enforcement", () => {
  const CAP = 60;
  // ASCII at boundary (60 bytes, 60 characters)
  const asciiAt = "a".repeat(CAP);
  // ASCII over boundary (61 bytes, 61 characters)
  const asciiOver = "a".repeat(CAP + 1);
  // Multibyte at boundary: Euro sign is 3 UTF-8 bytes each (20 * 3 = 60 bytes, 20 characters)
  const mbAt = "€".repeat(20);
  // Multibyte over boundary: Euro sign 21 * 3 = 63 bytes, but only 21 characters!
  // Under the old code (checking code.length), 21 <= 60 so it was incorrectly admitted.
  const mbOver = "€".repeat(21);

  describe("Run admission: byte-based validation on real engine seam", () => {
    it("admits ASCII and multibyte at boundary, rejects overboundary and empty before judge dispatch", async () => {
      const { engine, judge, left, matchId } = await setup([], { maxSourceBytes: CAP });

      // 1. ASCII at boundary (60 bytes) admitted
      const runAscii = await engine.run(left, matchId, { code: asciiAt, language: "Python" });
      expect(runAscii.tests).toBeDefined();
      expect(judge.runCalls).toBe(1);

      // 2. Multibyte at boundary (60 bytes, 20 chars) admitted
      const runMb = await engine.run(left, matchId, { code: mbAt, language: "Python" });
      expect(runMb.tests).toBeDefined();
      expect(judge.runCalls).toBe(2);

      // 3. ASCII overboundary (61 bytes, 61 chars) rejected
      await expect(engine.run(left, matchId, { code: asciiOver, language: "Python" }))
        .rejects.toThrow(ValidationError);
      expect(judge.runCalls).toBe(2);

      // 4. Multibyte overboundary (63 bytes, 21 chars) rejected
      await expect(engine.run(left, matchId, { code: mbOver, language: "Python" }))
        .rejects.toThrow(new ValidationError(`source exceeds ${CAP} bytes`));
      expect(judge.runCalls).toBe(2);

      // 5. Empty source rejected preserving emptiness limit
      await expect(engine.run(left, matchId, { code: "", language: "Python" }))
        .rejects.toThrow(new ValidationError("empty source"));
      expect(judge.runCalls).toBe(2);

      // Status remains coding, not stuck in running
      const snap = await engine.snapshot(left, matchId);
      expect(snap.sides.left?.status).toBe("coding");
    });
  });

  describe("Submit admission: byte-based validation before judge dispatch and state mutation", () => {
    it("rejects multibyte overboundary before judge dispatch and without mutating attempt/count/status/receipt", async () => {
      const { engine, judge, left, matchId } = await setup([{ score: 100 }], { maxSourceBytes: CAP });

      // Multibyte overboundary (63 bytes, 21 chars) must reject before any mutation
      await expect(engine.submit(left, matchId, { code: mbOver, language: "Python" }))
        .rejects.toThrow(new ValidationError(`source exceeds ${CAP} bytes`));

      // Verification: judge was never called
      expect(judge.evalCalls).toBe(0);

      // Verification: snapshot confirms no attempt mutation, no submission count increment, status remains coding
      const snap = await engine.snapshot(left, matchId);
      expect(snap.sides.left?.status).toBe("coding");
      expect(snap.sides.left?.submissions).toBe(0);
      expect(snap.roundPhase).toBe("CODING");
      expect(snap.reveal).toBeNull();
      expect(snap.failures).toEqual([]);

      // ASCII overboundary also rejected without mutation
      await expect(engine.submit(left, matchId, { code: asciiOver, language: "Python" }))
        .rejects.toThrow(new ValidationError(`source exceeds ${CAP} bytes`));
      expect(judge.evalCalls).toBe(0);
      expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(0);

      // Empty source rejected without mutation
      await expect(engine.submit(left, matchId, { code: "", language: "Python" }))
        .rejects.toThrow(new ValidationError("empty source"));
      expect(judge.evalCalls).toBe(0);

      // Multibyte at boundary (60 bytes, 20 chars) admitted and evaluated
      const receiptMb = await engine.submit(left, matchId, { code: mbAt, language: "Python" });
      expect(receiptMb.ok).toBe(true);
      expect(judge.evalCalls).toBe(1);
      const snapAfterMb = await engine.snapshot(left, matchId);
      expect(snapAfterMb.sides.left?.submissions).toBe(1);

      // ASCII at boundary (60 bytes, 60 chars) admitted as resubmit
      judge.queuePlan({ score: 100 });
      const receiptAscii = await engine.submit(left, matchId, { code: asciiAt, language: "Python" });
      expect(receiptAscii.ok).toBe(true);
      expect(judge.evalCalls).toBe(2);
      const snapAfterAscii = await engine.snapshot(left, matchId);
      expect(snapAfterAscii.sides.left?.submissions).toBe(2);
    });
  });

  describe("2v2 Authoritative document admission path", () => {
    it("validates actual collaborative document in UTF-8 bytes rather than client payload", async () => {
      const fx = await setup2v2([{ score: 100 }], { maxSourceBytes: CAP });

      // 1. Set collaborative document to multibyte overboundary (63 bytes, 21 chars)
      const rev1 = await setCollabSource(fx, fx.a1, mbOver);
      await readyBoth(fx, rev1);

      // Client sends a tiny payload (e.g. 1 char), but authoritative document exceeds UTF-8 bytes
      await expect(
        fx.engine.submit(fx.a1, fx.matchId, {
          code: "x",
          language: "Python",
          documentRevision: rev1,
        }),
      ).rejects.toThrow(new ValidationError(`source exceeds ${CAP} bytes`));

      // Judge never dispatched and submissions count not incremented
      expect(fx.judge.evalCalls).toBe(0);
      const snap1 = await fx.engine.snapshot(fx.a1, fx.matchId);
      expect(snap1.sides.left?.submissions).toBe(0);
      expect(snap1.sides.left?.status).toBe("coding");

      // 2. Set collaborative document to multibyte at boundary (60 bytes, 20 chars)
      const rev2 = await setCollabSource(fx, fx.a1, mbAt);
      await readyBoth(fx, rev2);

      // Client sends a huge payload (e.g. 200 chars), but authoritative document is admitted
      const receipt = await fx.engine.submit(fx.a1, fx.matchId, {
        code: "x".repeat(200),
        language: "Python",
        documentRevision: rev2,
      });
      expect(receipt.ok).toBe(true);
      expect(fx.judge.evalCalls).toBe(1);
      const snap2 = await fx.engine.snapshot(fx.a1, fx.matchId);
      expect(snap2.sides.left?.submissions).toBe(1);

      // 3. Set collaborative document to ASCII overboundary (61 bytes)
      const rev3 = await setCollabSource(fx, fx.a1, asciiOver);
      await readyBoth(fx, rev3);

      await expect(
        fx.engine.submit(fx.a1, fx.matchId, {
          code: "x",
          language: "Python",
          documentRevision: rev3,
        }),
      ).rejects.toThrow(new ValidationError(`source exceeds ${CAP} bytes`));
      expect(fx.judge.evalCalls).toBe(1);
      const snap3 = await fx.engine.snapshot(fx.a1, fx.matchId);
      expect(snap3.sides.left?.submissions).toBe(1);
    });
  });
});
