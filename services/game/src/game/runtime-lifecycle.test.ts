import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArenaEngine } from "arena-game-engine";
import { Lobby } from "arena-game-engine/lobby";
import { RuntimeOwnershipLostError } from "arena-game-engine/persistence";
import { GameService } from "./game.service.js";

const owner = vi.hoisted(() => ({
  active: false,
  calls: [] as string[],
  loss: undefined as undefined | ((error: Error) => void),
  refusal: undefined as Error | undefined,
  closeGate: undefined as Promise<void> | undefined,
}));
vi.mock("arena-game-engine/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("arena-game-engine/persistence")>();
  const { InMemoryLobbyStore } = await import("arena-game-engine/lobby");
  return {
    ...actual,
    PostgresStores: class {
      readonly matches = new actual.InMemoryMatchStore();
      readonly persistence = new actual.StoreBackedMatchPersistence({
        matches: this.matches,
        submissions: new actual.InMemorySubmissionStore(),
        reveals: new actual.InMemoryRevealStore(),
        collab: new actual.InMemoryCollabPersist(),
      });
      readonly lobby = new InMemoryLobbyStore(undefined, undefined, this.matches);
      async acquireRuntime(options: { onLost?: (error: Error) => void } = {}) {
        owner.calls.push("acquire");
        if (owner.refusal) throw owner.refusal;
        owner.active = true;
        owner.loss = options.onLost;
      }
      async ensureSchema() { owner.calls.push("schema"); }
      assertRuntimeActive() { if (!owner.active) throw lossError(); }
      get runtimeActive() { return owner.active; }
      async close() {
        owner.calls.push("close");
        owner.active = false;
        await owner.closeGate;
      }
    },
  };
});
function lossError(): RuntimeOwnershipLostError {
  return Object.setPrototypeOf(new Error("owner session ended"),
    RuntimeOwnershipLostError.prototype) as RuntimeOwnershipLostError;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
const services: GameService[] = [];
function service() { const game = new GameService(); services.push(game); return game; }
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://unused/test");
  vi.stubEnv("DEV_PRINCIPAL", "true");
  owner.active = false; owner.calls = []; owner.loss = undefined;
  owner.refusal = undefined; owner.closeGate = undefined;
});
afterEach(async () => {
  await Promise.all(services.splice(0).map((game) => game.stop()));
  vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers();
});
describe("Game runtime activation and stop", () => {
  it("acquires before schema/recovery and becomes ready only after recovery", async () => {
    const gate = deferred();
    vi.spyOn(ArenaEngine.prototype, "recover").mockImplementation(async () => {
      owner.calls.push("recover"); await gate.promise;
      return { matches: 0, retried: 0, failed: 0 };
    });
    const game = service();
    expect(game.runtimeReady).toBe(false);
    const boot = game.onModuleInit();
    for (let n = 0; n < 12; n++) await Promise.resolve();
    expect(owner.calls).toEqual(["acquire", "schema", "recover"]);
    expect(game.runtimeReady).toBe(false);
    gate.resolve(); await boot;
    expect(game.runtimeReady).toBe(true);
    expect(() => game.assertServing()).not.toThrow();
  });
  it("refuses duplicate startup before schema/recovery", async () => {
    owner.refusal = new Error("already owned");
    const recover = vi.spyOn(ArenaEngine.prototype, "recover");
    const game = service();
    await expect(game.onModuleInit()).rejects.toThrow("already owned");
    await game.stop();
    expect(owner.calls).toEqual(["acquire", "close"]);
    expect(recover).not.toHaveBeenCalled();
    expect(game.runtimeReady).toBe(false);
  });
  it("does not become ready if ownership is lost during recovery", async () => {
    const gate = deferred();
    vi.spyOn(ArenaEngine.prototype, "recover").mockImplementation(async () => {
      await gate.promise; return { matches: 0, retried: 0, failed: 0 };
    });
    const game = service(); const observed = vi.fn();
    game.onRuntimeLoss(observed);
    const boot = game.onModuleInit();
    const rejected = expect(boot).rejects.toThrow();
    for (let n = 0; n < 12; n++) await Promise.resolve();
    owner.active = false; owner.loss!(lossError());
    expect(game.runtimeReady).toBe(false);
    expect(game.shutdownSignal.aborted).toBe(true);
    gate.resolve(); await rejected;
    expect(observed).toHaveBeenCalledTimes(1);
  });
  it("isolates loss listeners, stops once, and never schedules more sweeps", async () => {
    vi.useFakeTimers();
    const expired = vi.spyOn(ArenaEngine.prototype, "sweepExpiredMatches").mockResolvedValue([]);
    const grace = vi.spyOn(ArenaEngine.prototype, "sweepGrace").mockResolvedValue([]);
    const game = service(); await game.onModuleInit();
    expired.mockClear(); grace.mockClear(); // Recovery itself performs a deadline sweep.
    const observed = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    game.onRuntimeLoss(() => { throw new Error("listener failure"); });
    game.onRuntimeLoss(observed);
    owner.active = false; owner.loss!(lossError()); owner.loss!(lossError());
    expect(observed).toHaveBeenCalledTimes(1);
    expect(() => game.assertServing()).toThrow();
    await game.stop(); await vi.advanceTimersByTimeAsync(20000);
    expect(expired).not.toHaveBeenCalled(); expect(grace).not.toHaveBeenCalled();
    const late = vi.fn(); game.onRuntimeLoss(late);
    expect(late).toHaveBeenCalledTimes(1);
    expect(owner.calls.filter((call) => call === "close")).toHaveLength(1);
  });
  it("returns one stop promise and closes serving before storage resolves", async () => {
    const game = service(); await game.onModuleInit();
    const gate = deferred(); owner.closeGate = gate.promise;
    const first = game.stop(); const second = game.stop();
    expect(second).toBe(first);
    expect(game.runtimeReady).toBe(false); expect(game.shutdownSignal.aborted).toBe(true);
    expect(() => game.assertServing()).toThrow();
    gate.resolve(); await first;
    await expect(game.onModuleInit()).rejects.toThrow();
  });
  it("returns the same stop promise when an abort listener re-enters stop", async () => {
    const game = service(); await game.onModuleInit();
    let repeated: Promise<void> | undefined;
    game.shutdownSignal.addEventListener("abort", () => { repeated = game.stop(); }, { once: true });
    const first = game.stop(); expect(repeated).toBe(first); await first;
    expect(owner.calls.filter((call) => call === "close")).toHaveLength(1);
  });
  it("permits memory only with the explicit development flag", async () => {
    vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("DEV_PRINCIPAL", "false");
    await expect(service().onModuleInit()).rejects.toThrow(/DATABASE_URL/);
    vi.stubEnv("DEV_PRINCIPAL", "true");
    const game = service(); await game.onModuleInit();
    expect(game.runtimeReady).toBe(true); expect(owner.calls).toEqual([]);
  });
  it("stops service Game and Lobby live output", async () => {
    vi.stubEnv("DATABASE_URL", "");
    let lateLobby: Parameters<Lobby["on"]>[0] | undefined;
    vi.spyOn(Lobby.prototype, "on").mockImplementation((listener) => {
      lateLobby = listener; return () => {};
    });
    const game = service(); await game.onModuleInit();
    const gameHint = vi.fn(); const lobbyHint = vi.fn();
    game.onEvent(gameHint); game.onLobbyEvent(lobbyHint);
    const { matchId } = await game.createMatch({ mode: "1v1", participants: [
      { userId: "a", sideId: "left" }, { userId: "b", sideId: "right" },
    ], problemVersionIds: ["even-ledger"] });
    const room = await game.createPrivateRoom("host", "1v1");
    gameHint.mockClear(); lobbyHint.mockClear();
    const engine = game.inner; const principal = game.principalFor("a");
    await game.stop();
    await engine.startRound(principal, matchId);
    // Direct domain calls test that a late event is filtered, not service admission.
    expect(gameHint).not.toHaveBeenCalled();
    lateLobby!("lobby.roomUpdated", { roomId: room.room.id });
    expect(lobbyHint).not.toHaveBeenCalled();
    expect(room.room.id).toBeTypeOf("string");
  });
});
