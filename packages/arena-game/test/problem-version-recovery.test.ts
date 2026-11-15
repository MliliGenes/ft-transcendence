import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ArenaEngine } from "../src/engine.js";
import { ContainerJudge } from "../src/container-judge.js";
import { FileBank } from "../src/file-bank.js";
import { SPIKE_LIMITS } from "../src/judge.js";
import { testPrincipal } from "../src/principal.js";
import { InMemoryMatchStore, InMemoryRevealStore, InMemorySubmissionStore } from "../src/store.js";

describe("problem versions across deployment recovery", () => {
  it("recovers a pending legacy Even Ledger snippet with its original tests and score", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const options = {
      matches,
      submissions,
      reveals,
      bank: new FileBank(),
      judge: new ContainerJudge(),
      clock: () => 1_000_000,
      revealGraceMs: 0,
      limits: { ...SPIKE_LIMITS, runWallMs: 8000, compileWallMs: 60000 },
    };
    const beforeRestart = new ArenaEngine(options);
    const left = testPrincipal("legacy-left");
    const matchId = await beforeRestart.createMatch({
      mode: "1v1",
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: "legacy-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await beforeRestart.startRound(left, matchId);
    await beforeRestart.beginCoding(left, matchId);
    const match = await matches.load(matchId);
    const roundId = match!.rounds[0]!.roundId;
    const source = "def ledger_sum(nums):\n    return sum(v if i % 2 == 0 else -v for i, v in enumerate(nums))\n";

    // Durable input left by the previous deployment before its judge returned.
    await submissions.append({
      submissionId: "legacy-submission",
      evaluationId: "legacy-evaluation",
      matchId,
      roundId,
      sideId: "left",
      problemVersionId: "even-ledger",
      language: "Python",
      source,
      sourceHash: createHash("sha256").update(source).digest("hex"),
      documentRevision: null,
      submittedAt: 1_000_000,
      elapsedMatchMs: 0,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    });

    const afterRestart = new ArenaEngine(options);
    await expect(afterRestart.recover()).resolves.toMatchObject({ retried: 1, failed: 0 });
    const right = testPrincipal("legacy-right");
    await afterRestart.leaveMatch(right, matchId);
    const reveal = await afterRestart.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  }, 120000);
});
