import { describe, expect, it } from "vitest";
import { ArenaEngine } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { InMemoryCollabPersist } from "../src/collab.js";
import { StoreBackedMatchPersistence } from "../src/persistence.js";
import { testPrincipal } from "../src/principal.js";
import { InMemoryMatchStore, InMemoryRevealStore, InMemorySubmissionStore } from "../src/store.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { tick } from "./setup.js";

describe("account deletion erasure", () => {
  it("forfeits an active match, anonymizes the deleted participant, and removes that side's code", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const collab = new InMemoryCollabPersist();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions,
      reveals: new InMemoryRevealStore(),
      collab,
    });
    const engine = new ArenaEngine({ judge: new ScriptedJudge([]), bank: new FileBank(), persistence });
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "deleted-user", sideId: "left" },
        { userId: "left-mate", sideId: "left" },
        { userId: "right-a", sideId: "right" },
        { userId: "right-b", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "double-it", "sum-array"],
    });
    const match = (await persistence.loadMatch(matchId))!;
    const roundId = match.rounds[0]!.roundId;

    match.memberPresence = { "deleted-user": "offline", "left-mate": "online" };
    match.memberOfflineSinceMs = { "deleted-user": 123 };
    match.rounds[0]!.readiness = {
      "deleted-user": { userId: "deleted-user", ready: true, documentRevision: 1, updatedAt: 123 },
    };
    await persistence.saveMatch(match);

    await persistence.recordSubmission({
      submissionId: "left-submission",
      evaluationId: "left-evaluation",
      matchId,
      roundId,
      sideId: "left",
      problemVersionId: "even-ledger",
      language: "Python",
      source: "private left source",
      sourceHash: "left-hash",
      documentRevision: 1,
      submittedAt: 123,
      elapsedMatchMs: 1,
      status: "completed",
      score: 100,
      scoreBp: 10000,
      groups: [],
      testStatuses: [],
      failureCode: null,
    });
    await persistence.recordSubmission({
      submissionId: "right-submission",
      evaluationId: "right-evaluation",
      matchId,
      roundId,
      sideId: "right",
      problemVersionId: "even-ledger",
      language: "Python",
      source: "retained right source",
      sourceHash: "right-hash",
      documentRevision: null,
      submittedAt: 124,
      elapsedMatchMs: 2,
      status: "completed",
      score: 50,
      scoreBp: 5000,
      groups: [],
      testStatuses: [],
      failureCode: null,
    });
    await persistence.saveTeamDocument(matchId, roundId, "left", 1, "Python", "bGVmdCBkb2N1bWVudA==");
    await persistence.saveTeamDocument(matchId, roundId, "right", 1, "Python", "cmlnaHQgZG9jdW1lbnQ=");

    await engine.eraseAccount("deleted-user");

    const erased = (await persistence.loadMatch(matchId))!;
    expect(erased.roundPhase).toBe("MATCH_COMPLETE");
    expect(erased.forfeit).toMatchObject({ winner: "right", loser: "left", reason: "leave" });
    expect(erased.participants).not.toContainEqual(expect.objectContaining({ userId: "deleted-user" }));
    expect(erased.participants).toContainEqual(expect.objectContaining({ sideId: "left", anonymized: true }));
    expect(erased.memberPresence).not.toHaveProperty("deleted-user");
    expect(erased.memberOfflineSinceMs).not.toHaveProperty("deleted-user");
    expect(erased.rounds[0]!.readiness).not.toHaveProperty("deleted-user");
    expect(JSON.stringify(erased)).not.toContain("deleted-user");

    const remaining = await persistence.listRoundSubmissions(matchId, roundId);
    expect(remaining.map((row) => row.sideId)).toEqual(["right"]);
    expect(remaining.map((row) => row.source)).toEqual(["retained right source"]);
    expect(await persistence.loadTeamDocument(matchId, roundId, "left")).toBeUndefined();
    expect(await persistence.loadTeamDocument(matchId, roundId, "right")).toMatchObject({ language: "Python" });
    const snapshot = await engine.snapshot(testPrincipal("left-mate"), matchId);
    expect(snapshot.teams?.find((team) => team.side === "left")?.members.map((member) => member.userId)).toEqual([
      null,
      "left-mate",
    ]);
  });

  it("waits for an accepted judge evaluation before purging its source", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions,
      reveals: new InMemoryRevealStore(),
      collab: new InMemoryCollabPersist(),
    });
    const judge = new ScriptedJudge([{ defer: true }]);
    const engine = new ArenaEngine({ judge, bank: new FileBank(), persistence });
    const target = testPrincipal("deleted-during-judge");
    const opponent = testPrincipal("opponent");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: target.userId, sideId: "left" },
        { userId: opponent.userId, sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(target, matchId);
    await engine.beginCoding(target, matchId);

    const submitted = engine.submit(target, matchId, { code: "private code", language: "Python" });
    await tick();
    expect(judge.evalCalls).toBe(1);

    let erased = false;
    const erasure = engine.eraseAccount(target.userId).then(() => { erased = true; });
    await tick();
    expect(erased).toBe(false);
    judge.release({ score: 100 });
    await Promise.all([submitted, erasure]);

    const match = (await persistence.loadMatch(matchId))!;
    expect(match.roundPhase).toBe("MATCH_COMPLETE");
    expect(match.participants.some((participant) => participant.userId === target.userId)).toBe(false);
    expect(await persistence.listRoundSubmissions(matchId, match.rounds[0]!.roundId)).toEqual([]);
  });
});
