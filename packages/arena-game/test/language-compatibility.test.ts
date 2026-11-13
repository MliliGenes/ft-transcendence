import { describe, expect, it } from "vitest";
import { testPrincipal } from "../src/principal.js";
import { setup } from "./setup.js";

describe("playable problem languages", () => {
  it("advertises only executable starters for a snippet round", async () => {
    const { engine, left, matchId } = await setup();
    const snapshot = await engine.snapshot(left, matchId);
    expect(Object.keys(snapshot.problem.starters)).toEqual(["Python"]);
    expect(snapshot.problem.starters.Python).toContain("ledger_sum");
  });
  it("rejects unavailable snippet submissions before creating a competitive attempt", async () => {
    const { engine, left, matchId } = await setup();
    await expect(engine.submit(left, matchId, { code: "int main() {}", language: "C++" }))
      .rejects.toMatchObject({ code: 400, message: expect.stringContaining("not available for this problem") });
    const snapshot = await engine.snapshot(left, matchId);
    expect(snapshot.sides.left?.submissions).toBe(0);
    expect(snapshot.sides.left?.status).toBe("coding");
    expect(snapshot.pendingEvaluation).toBe(false);
  });

  it("rejects unavailable visible runs without leaving the side running", async () => {
    const { engine, left, matchId } = await setup();
    await expect(engine.run(left, matchId, { code: "int main() {}", language: "C" }))
      .rejects.toMatchObject({ code: 400, message: expect.stringContaining("not available for this problem") });
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("coding");
  });

  it("keeps compiled stdio choices and resets a team to Python when advancing to snippets", async () => {
    const { engine, left, right } = await setup();
    const leftMate = testPrincipal("left-mate");
    const rightMate = testPrincipal("right-mate");
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: left.userId, sideId: "left" },
        { userId: leftMate.userId, sideId: "left" },
        { userId: right.userId, sideId: "right" },
        { userId: rightMate.userId, sideId: "right" },
      ],
      problemVersionIds: ["double-it", "even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    expect(Object.keys((await engine.snapshot(left, matchId)).problem.starters)).toEqual(["C++", "Python", "C"]);
    await engine.setTeamLanguage(left, matchId, "C++");
    for (const member of [left, leftMate]) await engine.setReady(member, matchId, { ready: true, documentRevision: 2 });
    for (const member of [right, rightMate]) await engine.setReady(member, matchId, { ready: true, documentRevision: 1 });
    await engine.submit(left, matchId, { code: "", language: "C++", documentRevision: 2 });
    await engine.submit(right, matchId, { code: "", language: "Python", documentRevision: 1 });
    await engine.publishReveal(left, matchId);
    await engine.nextRound(left, matchId);
    await engine.beginCoding(left, matchId);
    const snapshot = await engine.snapshot(left, matchId);
    expect(snapshot.teams?.find((team) => team.side === "left")?.language).toBe("Python");
    expect((await engine.collabSync(left, matchId)).source).toContain("ledger_sum");
    await expect(engine.setTeamLanguage(left, matchId, "C++"))
      .rejects.toMatchObject({ code: 400 });
  });

});
