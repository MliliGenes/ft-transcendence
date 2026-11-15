import { describe, expect, it } from "vitest";
import { ArenaEngine } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { InMemoryMatchStore, InMemorySubmissionStore } from "../src/store.js";
import { P100, SOLVED_PY, setup } from "./setup.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { testPrincipal } from "../src/principal.js";

describe("coordinator review of async invariants", () => {
  it("advances one 2v2 team's document and readiness without changing the other team", async () => {
    const engine = new ArenaEngine({ judge: new ScriptedJudge([P100]), bank: new FileBank(), clock: () => 1000000, revealGraceMs: 0 });
    const [a1, a2, b1, b2] = ["review-a1", "review-a2", "review-b1", "review-b2"].map((id) => testPrincipal(id));
    const id = await engine.createMatch({ mode: "2v2", participants: [{ userId: a1!.userId, sideId: "left" }, { userId: a2!.userId, sideId: "left" }, { userId: b1!.userId, sideId: "right" }, { userId: b2!.userId, sideId: "right" }], problemVersionIds: ["even-ledger-v2", "double-it", "sum-array"] });
    await engine.startRound(a1!, id);
    await engine.beginCoding(a1!, id);
    const oldAlpha = await engine.collabSync(a1!, id);
    const oldBeta = await engine.collabSync(b1!, id);
    for (const member of [a1!, a2!, b1!, b2!]) await engine.setReady(member, id, { ready: true, documentRevision: 1 });
    await engine.submit(a1!, id, { code: "payload is not authoritative", language: "Python", documentRevision: 1 });
    const alpha = await engine.snapshot(a2!, id);
    const beta = await engine.snapshot(b1!, id);
    expect(alpha.round).toBe(2);
    expect(beta.round).toBe(1);
    expect(alpha.teams!.find((team) => team.side === "left")!.members.every((member) => !member.ready)).toBe(true);
    const newAlpha = await engine.collabSync(a2!, id);
    const sameBeta = await engine.collabSync(b2!, id);
    expect(newAlpha.roundId).not.toBe(oldAlpha.roundId);
    expect(sameBeta.roundId).toBe(oldBeta.roundId);
    expect(newAlpha.source).not.toBe(oldAlpha.source);
    expect(sameBeta.source).toBe(oldBeta.source);
    const betaTeam = beta.teams!.find((team) => team.side === "right")!;
    expect(betaTeam.members.every((member) => member.ready)).toBe(true);
  });

  it("rejects the old cutoff action but accepts a fresh action on the next problem", async () => {
    const fx = await setup([P100], { roundDurationMs: 1000 });
    fx.advance(1000);
    await expect(fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow(/expired/);
    expect((await fx.engine.snapshot(fx.left, fx.matchId)).round).toBe(2);
    await expect(fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" })).resolves.toMatchObject({ round: 2 });
    expect((await fx.engine.snapshot(fx.left, fx.matchId)).round).toBe(3);
  });

  it("stamps the new async events with the committed revision", async () => {
    const fx = await setup([P100]);
    const events: Array<{ event: string; payload: any }> = [];
    fx.engine.on((event, payload) => events.push({ event, payload }));
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    for (const event of ["side.advanced", "progress.updated"]) {
      const matches = events.filter((item) => item.event === event);
      expect(matches).toHaveLength(1);
      expect(Number.isInteger(matches[0]!.payload.revision)).toBe(true);
      expect(matches[0]!.payload.revision).toBeGreaterThan(0);
    }
  });

  it("keeps divergent side deadlines through repeat beginCoding and an engine restart", async () => {
    let now = 1000000;
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const options = { matches, submissions, clock: () => now, bank: new FileBank(), roundDurationMs: 1000, revealGraceMs: 0 };
    const engine = new ArenaEngine({ ...options, judge: new ScriptedJudge([P100]) });
    const left = testPrincipal("review-left");
    const right = testPrincipal("review-right");
    const id = await engine.createMatch({ mode: "1v1", participants: [{ userId: left.userId, sideId: "left" }, { userId: right.userId, sideId: "right" }], problemVersionIds: ["even-ledger-v2", "even-ledger-v2", "even-ledger-v2"] });
    await engine.startRound(left, id);
    await engine.beginCoding(left, id);
    now += 200;
    await engine.submit(left, id, { code: SOLVED_PY, language: "Python" });
    const before = await engine.snapshot(left, id);
    now += 100;
    await engine.beginCoding(left, id);
    expect((await engine.snapshot(left, id)).progress).toEqual(before.progress);
    const restarted = new ArenaEngine({ ...options, judge: new ScriptedJudge([]) });
    await restarted.recover();
    expect((await restarted.snapshot(left, id)).progress).toEqual(before.progress);
    expect((await restarted.snapshot(right, id)).progress.self.problemDeadlineMs).toBe(1001000);
    expect((await restarted.snapshot(left, id)).progress.self.problemDeadlineMs).toBe(1001200);
  });

  it("resolves an end-to-end draw and protects final reveal snapshots from consumer mutation", async () => {
    const fx = await setup(Array.from({ length: 6 }, () => P100));
    for (const player of [fx.left, fx.right]) {
      for (let i = 0; i < 3; i++) await fx.engine.submit(player, fx.matchId, { code: SOLVED_PY, language: "Python" });
    }
    const snap = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snap.final).toMatchObject({ outcome: "draw", winner: null, scores: { left: 300, right: 300 } });
    snap.reveals[0]!.scores.left = -999;
    const reveal = await fx.engine.publishReveal(fx.left, fx.matchId);
    reveal.scores.left = -999;
    const fresh = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(fresh.reveals.map((round) => round.scores.left)).toEqual([100, 100, 100]);
  });
});
