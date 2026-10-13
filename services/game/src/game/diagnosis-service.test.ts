import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerJudge } from "arena-game-engine/judge";
import { StoreBackedMatchPersistence } from "arena-game-engine/persistence";
import { GameService } from "./game.service.js";

const services: GameService[] = [];
afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.onModuleDestroy()));
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("service event delivery contracts", () => {
  it.each([false, true])("delivers a committed phase event past an earlier listener (throws: %s)", async (throws) => {
    vi.stubEnv("DATABASE_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const game = new GameService();
    services.push(game);
    await game.onModuleInit();
    const observed: string[] = [];
    const engineEvents: string[] = [];
    game.inner.on((event) => engineEvents.push(event));
    game.onEvent(() => { if (throws) throw new Error("listener failed"); });
    game.onEvent((event) => observed.push(event));
    const { matchId } = await game.createMatch({ mode: "1v1", participants: [
      { userId: "u1", sideId: "left" }, { userId: "u2", sideId: "right" },
    ], problemVersionIds: ["even-ledger"] });
    await expect(game.startRound("u1", matchId)).resolves.toEqual({ ok: true });
    expect((await game.snapshot("u1", matchId)).roundPhase).toBe("ROUND_INTRO");
    expect(engineEvents).toContain("phase.changed");
    expect(observed).toContain("phase.changed");
  });
});


it.each(["closing", "row", "phase"])("retries an automatic Reveal after a failed %s save through the production timer", async (fault) => {
  vi.useFakeTimers({ now: 1000 });
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("JUDGE_BACKEND", "container");
  vi.spyOn(ContainerJudge.prototype, "evaluateSealed").mockImplementation(async (request) => ({
    groups: request.groups.map((group) => ({ name: group.name, weight: group.weight,
      results: group.tests.map((test) => ({ id: test.id, passed: true, status: "accepted" as const, runtimeMs: 1 })) })),
  }));
  const save = StoreBackedMatchPersistence.prototype.saveMatch;
  let failed = false;
  vi.spyOn(StoreBackedMatchPersistence.prototype, "saveMatch").mockImplementation(async function (this: StoreBackedMatchPersistence, match, revision) {
    const round = match.rounds[match.currentRound - 1]!;
    const target = fault === "phase" ? match.roundPhase === "SCORE_REVEAL"
      : fault === "closing" && round.closing && !round.cutoffPassed;
    if (!failed && target) {
      failed = true;
      throw new Error("transient Reveal phase save failure");
    }
    return save.call(this, match, revision);
  });
  const publish = StoreBackedMatchPersistence.prototype.publishReveal;
  vi.spyOn(StoreBackedMatchPersistence.prototype, "publishReveal").mockImplementation(async function (this: StoreBackedMatchPersistence, ...args) {
    if (!failed && fault === "row") { failed = true; throw new Error("transient Reveal row save failure"); }
    return publish.apply(this, args);
  });
  const game = new GameService();
  services.push(game);
  await game.onModuleInit();
  const events: string[] = [];
  game.onEvent((event) => events.push(event));
  const { matchId } = await game.createMatch({ mode: "1v1", participants: [
    { userId: "left", sideId: "left" }, { userId: "right", sideId: "right" },
  ], problemVersionIds: ["even-ledger", "double-it"] });
  await game.startRound("left", matchId);
  await game.beginCoding("left", matchId);
  const input = { code: "def ledger_sum(nums): return 0", language: "Python" };
  await expect(game.submit("left", matchId, input)).resolves.toMatchObject({ ok: true });
  await expect(game.submit("right", matchId, input)).resolves.toMatchObject({ ok: true });
  for (let n = 0; n < 150; n++) await Promise.resolve();
  expect(failed).toBe(true);
  expect(events.filter((event) => event === "reveal.published")).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1000);
  for (let n = 0; n < 150; n++) await Promise.resolve();
  const snapshot = await game.snapshot("left", matchId);
  expect(snapshot).toMatchObject({ roundPhase: "SCORE_REVEAL", reveal: { scores: { left: 100, right: 100 } } });
  expect(events.filter((event) => event === "reveal.published")).toHaveLength(1);
  await expect(game.advance("left", matchId)).resolves.toEqual({ ok: true });
});
