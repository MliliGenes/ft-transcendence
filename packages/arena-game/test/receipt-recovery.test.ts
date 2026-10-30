import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ArenaEngine, IllegalStateError, NotMemberError, testPrincipal, type SubmissionRecord } from "../src/index.js";
import { FileBank } from "../src/judge.js";
import { DuplicateError, inMemoryPersistence } from "../src/persistence.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P100, P40, P85, SOLVED_PY, STARTER_PY, setup } from "./setup.js";

describe("Receipt recovery after Reveal (#6)", () => {
  it("exact retry recovers durable receipt after Reveal without re-judging or state mutation", async () => {
    const { engine, judge, left, matchId } = await setup([{ score: 100 }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-lost-ack",
      evaluationId: "eval-lost-ack",
    };

    // First submit succeeds
    const receipt = await engine.submit(left, matchId, input);
    expect(receipt).toEqual({
      ok: true,
      round: 1,
      submissionId: "sub-lost-ack",
      evaluationId: "eval-lost-ack",
    });
    expect(judge.evalCalls).toBe(1);

    // Reveal is published
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);

    const snapBeforeRetry = await engine.snapshot(left, matchId);
    expect(snapBeforeRetry.roundPhase).toBe("SCORE_REVEAL");
    expect(snapBeforeRetry.sides.left?.submissions).toBe(1);

    // Exact retry after Reveal
    const recovered = await engine.submit(left, matchId, input);
    expect(recovered).toEqual(receipt);

    // Verify invariants: no new judge execution, no counter bump, no score change
    expect(judge.evalCalls).toBe(1);
    const snapAfterRetry = await engine.snapshot(left, matchId);
    expect(snapAfterRetry.sides.left?.submissions).toBe(1);
    expect(snapAfterRetry.reveal?.scores.left).toBe(100);
  });

  it("negative: rejects changed code with same identifiers after Reveal", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-change-code",
      evaluationId: "eval-change-code",
    };
    await engine.submit(left, matchId, input);
    await engine.publishReveal(left, matchId);

    await expect(
      engine.submit(left, matchId, {
        ...input,
        code: STARTER_PY,
      }),
    ).rejects.toBeInstanceOf(DuplicateError);
  });

  it("negative: rejects changed language with same identifiers after Reveal", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-change-lang",
      evaluationId: "eval-change-lang",
    };
    await engine.submit(left, matchId, input);
    await engine.publishReveal(left, matchId);

    await expect(
      engine.submit(left, matchId, {
        ...input,
        language: "C++",
      }),
    ).rejects.toBeInstanceOf(DuplicateError);
  });

  it("negative: rejects outsider attempting to recover receipt after Reveal", async () => {
    const { engine, left, stranger, matchId } = await setup([{ score: 100 }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-outsider",
      evaluationId: "eval-outsider",
    };
    await engine.submit(left, matchId, input);
    await engine.publishReveal(left, matchId);

    await expect(engine.submit(stranger, matchId, input)).rejects.toBeInstanceOf(NotMemberError);
  });

  it("negative: rejects opponent attempting to recover other side receipt after Reveal", async () => {
    const { engine, left, right, matchId } = await setup([{ score: 100 }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-opponent-steal",
      evaluationId: "eval-opponent-steal",
    };
    await engine.submit(left, matchId, input);
    await engine.publishReveal(left, matchId);

    await expect(engine.submit(right, matchId, input)).rejects.toBeInstanceOf(DuplicateError);
  });

  it("negative: rejects new late submit requests after Reveal", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine.publishReveal(left, matchId);

    // Fresh submit with new/unseen IDs is rejected
    await expect(
      engine.submit(left, matchId, {
        code: SOLVED_PY,
        language: "Python",
        submissionId: "new-late-sub",
        evaluationId: "new-late-eval",
      }),
    ).rejects.toBeInstanceOf(IllegalStateError);

    // Fresh submit with generated IDs is rejected
    await expect(
      engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" }),
    ).rejects.toBeInstanceOf(IllegalStateError);
  });

  it("recovers Round 1 receipt in Round 2 without reinterpreting as Round 2 submission", async () => {
    const { engine, judge, left, matchId } = await setup([{ score: 100 }, P85]);
    const round1Input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-r1",
      evaluationId: "eval-r1",
    };
    const r1Receipt = await engine.submit(left, matchId, round1Input);
    expect(r1Receipt.round).toBe(1);
    await engine.publishReveal(left, matchId);

    // Advance to Round 2
    await engine.nextRound(left, matchId);
    await engine.beginCoding(left, matchId);

    const snapR2 = await engine.snapshot(left, matchId);
    expect(snapR2.round).toBe(2);
    expect(snapR2.roundPhase).toBe("CODING");

    // Exact retry of Round 1 submission in Round 2
    const recovered = await engine.submit(left, matchId, round1Input);
    expect(recovered).toEqual(r1Receipt);
    expect(recovered.round).toBe(1); // Not round 2!
    expect(judge.evalCalls).toBe(1);

    // Verify Round 2 state was not touched
    const snapAfter = await engine.snapshot(left, matchId);
    expect(snapAfter.round).toBe(2);
    expect(snapAfter.sides.left?.submissions).toBe(0); // Round 2 has 0 submissions
  });

  it("recovers Round 1 receipt after Match completion", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-to-complete",
      evaluationId: "eval-to-complete",
    };
    const receipt = await engine.submit(left, matchId, input);
    await engine.publishReveal(left, matchId);
    await engine.nextRound(left, matchId); // Round 1 was total 1 round in fixture setup or advance

    // Deliberate leave / match complete
    const snap = await engine.snapshot(left, matchId);
    if (snap.roundPhase !== "MATCH_COMPLETE") {
      await engine.leaveMatch(left, matchId);
    }
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe("MATCH_COMPLETE");

    // Exact retry after MATCH_COMPLETE
    const recovered = await engine.submit(left, matchId, input);
    expect(recovered).toEqual(receipt);
  });

  it("recovers receipt across engine restart from durable persistence", async () => {
    const persistence = inMemoryPersistence();
    let now = 1_000_000;
    const judge1 = new ScriptedJudge([{ score: 100 }]);
    const engine1 = new ArenaEngine({
      judge: judge1,
      bank: new FileBank(),
      persistence,
      clock: () => now,
    });
    const left = testPrincipal("p-restart-left");
    const right = testPrincipal("p-restart-right");
    const matchId = await engine1.createMatch({
      mode: "1v1",
      problemVersionIds: ["even-ledger"],
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: right.userId, sideId: "right" },
      ],
    });
    await engine1.startRound(left, matchId);
    await engine1.beginCoding(left, matchId);

    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-restart",
      evaluationId: "eval-restart",
    };
    const receipt1 = await engine1.submit(left, matchId, input);
    await engine1.publishReveal(left, matchId);

    // Reboot engine on same persistence
    const judge2 = new ScriptedJudge([]);
    const engine2 = new ArenaEngine({
      judge: judge2,
      bank: new FileBank(),
      persistence,
      clock: () => now,
    });

    const recovered = await engine2.submit(left, matchId, input);
    expect(recovered).toEqual(receipt1);
    expect(judge2.evalCalls).toBe(0);
  });

  it("2v2: exact retry recovers receipt after Reveal and rejects changed revision/payload", async () => {
    let now = 1_000_000;
    const judge = new ScriptedJudge([{ score: 100 }]);
    const engine = new ArenaEngine({ judge, bank: new FileBank(), clock: () => now, revealGraceMs: 0 });
    const a1 = testPrincipal("user-a1");
    const a2 = testPrincipal("user-a2");
    const b1 = testPrincipal("user-b1");
    const b2 = testPrincipal("user-b2");
    const stranger = testPrincipal("user-stranger");
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "user-a1", sideId: "left" },
        { userId: "user-a2", sideId: "left" },
        { userId: "user-b1", sideId: "right" },
        { userId: "user-b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger"],
    });
    await engine.startRound(a1, matchId);
    await engine.beginCoding(a1, matchId);

    // Ready both Alpha teammates on revision 1
    await engine.setReady(a1, matchId, { ready: true, documentRevision: 1 });
    await engine.setReady(a2, matchId, { ready: true, documentRevision: 1 });

    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-2v2-exact",
      evaluationId: "eval-2v2-exact",
      documentRevision: 1,
    };
    const receipt = await engine.submit(a1, matchId, input);
    expect(receipt.ok).toBe(true);
    expect(receipt.round).toBe(1);

    await engine.publishReveal(a1, matchId);

    // Teammate a2 (or a1) exact retry
    const recovered = await engine.submit(a2, matchId, input);
    expect(recovered).toEqual(receipt);
    expect(judge.evalCalls).toBe(1);

    // Negative: changed documentRevision
    await expect(
      engine.submit(a1, matchId, { ...input, documentRevision: 2 }),
    ).rejects.toBeInstanceOf(DuplicateError);

    // Negative: missing/omitted documentRevision after Reveal is rejected for late recovery
    const { documentRevision: _omitted, ...inputWithoutRevision } = input;
    await expect(
      engine.submit(a1, matchId, inputWithoutRevision),
    ).rejects.toBeInstanceOf(DuplicateError);

    // Positive: retry with matching documentRevision succeeds even if raw input.code differs from frozen source
    const recoveredWithDiffRawCode = await engine.submit(a1, matchId, {
      ...input,
      code: "def completely_different_client_buffer(): pass\n",
    });
    expect(recoveredWithDiffRawCode).toEqual(receipt);

    // Negative: opponent team b1 retry
    await expect(
      engine.submit(b1, matchId, input),
    ).rejects.toBeInstanceOf(DuplicateError);

    // Negative: stranger retry
    await expect(
      engine.submit(stranger, matchId, input),
    ).rejects.toBeInstanceOf(NotMemberError);
  });

  it("preserves original failure semantics: failed submission replays failure on exact retry after Reveal", async () => {
    const { engine, left, matchId } = await setup([{ infra: "hidden suite timeout" }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-failed-reveal",
      evaluationId: "eval-failed-reveal",
    };
    await expect(engine.submit(left, matchId, input)).rejects.toThrow("hidden suite timeout");
    await engine.publishReveal(left, matchId);

    // Exact retry after Reveal replays failure, does not return ok
    await expect(engine.submit(left, matchId, input)).rejects.toThrow("hidden suite timeout");
  });

  it("orphan pending retry outside competitive window does not re-drive evaluation or call judge", async () => {
    const persistence = inMemoryPersistence();
    const judge = new ScriptedJudge([{ score: 100 }]);
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge,
      bank: new FileBank(),
      persistence,
      clock: () => now,
      revealGraceMs: 0,
    });

    const left = testPrincipal("user-left");
    const right = testPrincipal("user-right");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: right.userId, sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);

    const match = (await persistence.loadMatch(matchId))!;
    const roundId = match.rounds[0]!.roundId;

    const sourceHash = createHash("sha256").update(SOLVED_PY, "utf8").digest("hex");
    const pendingRecord: SubmissionRecord = {
      submissionId: "sub-orphan-pending",
      evaluationId: "eval-orphan-pending",
      matchId,
      roundId,
      sideId: "left",
      problemVersionId: "even-ledger",
      language: "Python",
      source: SOLVED_PY,
      sourceHash,
      documentRevision: null,
      submittedAt: now,
      elapsedMatchMs: 100,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    };
    await persistence.recordSubmission(pendingRecord);

    // Close competitive window (publish Reveal)
    await engine.publishReveal(left, matchId);
    expect(judge.evalCalls).toBe(0);

    const snapBefore = await engine.snapshot(left, matchId);
    expect(snapBefore.roundPhase).toBe("SCORE_REVEAL");
    expect(snapBefore.sides.left?.submissions).toBe(0);

    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-orphan-pending",
      evaluationId: "eval-orphan-pending",
    };
    await expect(engine.submit(left, matchId, input)).rejects.toBeInstanceOf(IllegalStateError);

    expect(judge.evalCalls).toBe(0);
    const snapAfter = await engine.snapshot(left, matchId);
    expect(snapAfter.sides.left?.submissions).toBe(0);
    expect(snapAfter.roundPhase).toBe("SCORE_REVEAL");

    const stored = await persistence.findSubmissionByEvaluationId("eval-orphan-pending");
    expect(stored?.status).toBe("pending");
  });

  it("pending retry after Reveal joins the original evaluation outside the Match lock", async () => {
    const judge = new ScriptedJudge([{ defer: true }]);
    const persistence = inMemoryPersistence();
    let now = 1_000_000;
    const engine = new ArenaEngine({
      judge,
      bank: new FileBank(),
      persistence,
      clock: () => now,
      revealGraceMs: 0,
    });
    const left = testPrincipal("user-left");
    const right = testPrincipal("user-right");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: right.userId, sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);

    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-in-flight",
      evaluationId: "eval-in-flight",
    };

    let firstSettled = false;
    let retrySettled = false;
    let retryPromise: ReturnType<typeof engine.submit> | undefined;
    let snapshotTimeout: ReturnType<typeof setTimeout> | undefined;
    const firstSubmitPromise = engine.submit(left, matchId, input);
    void firstSubmitPromise.then(
      () => { firstSettled = true; },
      () => { firstSettled = true; },
    );

    try {
      await vi.waitFor(() => expect(judge.evalCalls).toBe(1));
      await engine.publishReveal(left, matchId, { graceMs: 0 });
      expect((await persistence.loadMatch(matchId))?.rounds[0]?.cutoffPassed).toBe(true);

      retryPromise = engine.submit(left, matchId, input);
      void retryPromise.then(
        () => { retrySettled = true; },
        () => { retrySettled = true; },
      );

      // This command queues behind retry preparation and must acquire the lock
      // while both callers are still waiting for the original Judge result.
      const snapshot = await Promise.race([
        engine.snapshot(left, matchId),
        new Promise<never>((_, reject) => {
          snapshotTimeout = setTimeout(() => reject(new Error("retry held the Match lock")), 1000);
        }),
      ]);
      expect(snapshot.roundPhase).toBe("SCORE_REVEAL");
      expect(firstSettled).toBe(false);
      expect(retrySettled).toBe(false);
      expect(judge.evalCalls).toBe(1);
      await expect(persistence.findSubmissionByEvaluationId(input.evaluationId)).resolves.toMatchObject({ status: "pending" });
    } finally {
      if (snapshotTimeout !== undefined) clearTimeout(snapshotTimeout);
      if (judge.evalCalls > 0) judge.release({ score: 100 });
      await Promise.allSettled(retryPromise ? [firstSubmitPromise, retryPromise] : [firstSubmitPromise]);
    }

    const [firstReceipt, retryReceipt] = await Promise.all([firstSubmitPromise, retryPromise]);
    expect(firstReceipt).toEqual({
      ok: true,
      round: 1,
      submissionId: "sub-in-flight",
      evaluationId: "eval-in-flight",
    });
    expect(retryReceipt).toEqual(firstReceipt);
    expect(judge.evalCalls).toBe(1);
  });

  it.each([
    ["unknown evaluation partner", "sub-known", "eval-missing"],
    ["unknown submission partner", "sub-missing", "eval-known"],
    ["evaluation belongs to another submission", "sub-known", "eval-other"],
    ["submission belongs to another evaluation", "sub-other", "eval-known"],
  ])("rejects conflicting receipt identifiers: %s", async (_case, submissionId, evaluationId) => {
    const { engine, judge, left, right, matchId } = await setup([{ score: 100 }, { score: 100 }]);
    const original = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-known",
      evaluationId: "eval-known",
    };
    const receipt = await engine.submit(left, matchId, original);
    await engine.submit(right, matchId, {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-other",
      evaluationId: "eval-other",
    });
    await engine.publishReveal(left, matchId);
    const before = await engine.snapshot(left, matchId);

    await expect(engine.submit(left, matchId, {
      ...original,
      submissionId,
      evaluationId,
    })).rejects.toBeInstanceOf(DuplicateError);

    await expect(engine.submit(left, matchId, original)).resolves.toEqual(receipt);
    expect(judge.evalCalls).toBe(2);
    await expect(engine.snapshot(left, matchId)).resolves.toEqual(before);
  });

  it("rejects explicit empty identifiers and accepts retries with one identifier", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    const valid = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-symm-1",
      evaluationId: "eval-symm-1",
    };
    const receipt = await engine.submit(left, matchId, valid);
    expect(receipt.ok).toBe(true);
    await engine.publishReveal(left, matchId);

    // Negative 1: explicit empty evaluationId must not be silently replaced by stored partner
    await expect(
      engine.submit(left, matchId, {
        ...valid,
        evaluationId: "",
      }),
    ).rejects.toBeInstanceOf(DuplicateError);

    // Negative 2: explicit empty submissionId must not be silently replaced by stored partner
    await expect(
      engine.submit(left, matchId, {
        ...valid,
        submissionId: "",
      }),
    ).rejects.toBeInstanceOf(DuplicateError);

    // Negative 3: initial submit with explicit empty ID is rejected
    await expect(
      engine.submit(left, matchId, {
        code: SOLVED_PY,
        language: "Python",
        submissionId: "",
      }),
    ).rejects.toBeInstanceOf(DuplicateError);
    await expect(
      engine.submit(left, matchId, {
        code: SOLVED_PY,
        language: "Python",
        evaluationId: "",
      }),
    ).rejects.toBeInstanceOf(DuplicateError);

    // Positive 1: single-ID retry providing only submissionId (omitting evaluationId)
    const singleSubReceipt = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-symm-1",
    });
    expect(singleSubReceipt).toEqual(receipt);

    // Positive 2: single-ID retry providing only evaluationId (omitting submissionId)
    const singleEvalReceipt = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: "Python",
      evaluationId: "eval-symm-1",
    });
    expect(singleEvalReceipt).toEqual(receipt);
  });
});
