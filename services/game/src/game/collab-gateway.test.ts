import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { AuthPrincipalClient, UnauthorizedError } from "../auth/auth-principal-client.js";
import { attachSocketPrincipal, type MatchSocketPrincipal } from "./socket-auth.js";
import { CollabGateway } from "./collab.gateway.js";
import type { GameService } from "./game.service.js";

type FakeClient = {
  id: string;
  connected: boolean;
  data: Record<string, unknown>;
  handshake: { auth: Record<string, unknown>; query: Record<string, unknown>; headers?: Record<string, string> };
  rooms: string[];
  events: Array<{ event: string; body: unknown }>;
  disconnectCalls: unknown[];
  join: (room: string) => Promise<void>;
  leave: (room: string) => Promise<void>;
  emit: (event: string, body: unknown) => void;
  disconnect: (close?: unknown) => void;
  to: (room: string) => { emit: (event: string, body: unknown) => void };
  socket: Socket;
};

function createClient(id = "c1", auth: Record<string, unknown> = {}): FakeClient {
  const rooms: string[] = [];
  const events: Array<{ event: string; body: unknown }> = [];
  const disconnectCalls: unknown[] = [];
  const client: FakeClient = {
    id,
    connected: true,
    data: {},
    handshake: { auth, query: {}, headers: {} },
    rooms,
    events,
    disconnectCalls,
    join: vi.fn(async (r: string) => { rooms.push(r); }),
    leave: vi.fn(async (r: string) => {
      const idx = rooms.indexOf(r);
      if (idx >= 0) rooms.splice(idx, 1);
    }),
    emit: vi.fn((e: string, b: unknown) => { events.push({ event: e, body: b }); }),
    disconnect: vi.fn((close?: unknown) => {
      client.connected = false;
      disconnectCalls.push(close);
    }),
    to: vi.fn((_room: string) => ({
      emit: vi.fn((e: string, b: unknown) => { events.push({ event: e, body: b }); }),
    })),
    socket: undefined as unknown as Socket,
  };
  client.socket = client as unknown as Socket;
  return client;
}

function createVerifier(map: Record<string, { userId: string; expiresAt: number } | Error> = {}) {
  return {
    verify: vi.fn(async (token: string) => {
      const v = map[token];
      if (v instanceof Error) throw v;
      if (!v) throw new UnauthorizedError();
      return v;
    }),
  } as unknown as AuthPrincipalClient;
}

function createGame(overrides: Partial<GameService> = {}): GameService {
  const game = {
    runtimeReady: true,
    assertServing(this: { runtimeReady?: boolean }) {
      if (!this.runtimeReady) throw new Error("unavailable");
    },
    collabSync: vi.fn(async (_userId: string, _matchId: string) => ({
      roomId: "match-1:round-2:left",
      roundId: "round-2",
      side: "left",
      stateB64: "base64state",
      source: "code",
      revision: 2,
      language: "python",
    })),
    applyCollabUpdate: vi.fn(async (_userId: string, _matchId: string, _update: unknown) => ({
      revision: 2,
      changed: true,
      source: "code",
    })),
  } as unknown as GameService;
  Object.defineProperties(game, Object.getOwnPropertyDescriptors(overrides));
  return game;
}

function createServer(peers: FakeClient[] = []) {
  return {
    in: vi.fn((_room: string) => ({
      fetchSockets: vi.fn(async () => peers.map((p) => ({
        id: p.id,
        connected: p.connected,
        data: p.data,
        emit: p.emit,
      }))),
    })),
  } as unknown as CollabGateway["server"];
}

describe("CollabGateway Characterization", () => {
  const FUTURE = () => Date.now() + 60_000;

  beforeEach(() => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("onUpdate", () => {
    it("returns undefined and disconnects when client is disconnected", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      c.connected = false;

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined and disconnects when stored principal is expired", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined and disconnects when stored principal expiresAt is exactly Date.now()", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      const now = 1_700_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: now, matchId: "m1" }, "tok");

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns unauthorized error and suppresses game mutation when stored principal lacks matchId", async () => {
      const game = createGame();
      const exp = FUTURE();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: exp } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: exp } as MatchSocketPrincipal, "tok");

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toEqual({ ok: false, error: "unauthorized socket" });
      expect(game.applyCollabUpdate).not.toHaveBeenCalled();
    });

    it("returns error object when token re-verification fails while runtime is ready", async () => {
      const game = createGame();
      const verifier = createVerifier({});
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "invalid-token");

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toEqual({ ok: false, error: "unauthorized socket" });
    });

    it("returns undefined when token re-verification fails and runtime is not ready", async () => {
      const game = createGame({ runtimeReady: false });
      const verifier = createVerifier({});
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "invalid-token");

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
    });

    it("rejects malformed body with roundId/updateB64 validation errors", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");

      expect(await gw.onUpdate(c.socket, null as never)).toEqual({ ok: false, error: "malformed collab update" });
      expect(await gw.onUpdate(c.socket, { roundId: 123, updateB64: "abc" } as never)).toEqual({ ok: false, error: "malformed collab update" });
      expect(await gw.onUpdate(c.socket, { roundId: "r1", updateB64: 456 } as never)).toEqual({ ok: false, error: "malformed collab update" });
    });

    it("rejects payload exceeding size limits", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");

      const hugeUpdate = "a".repeat(262145);
      expect(await gw.onUpdate(c.socket, { roundId: "r1", updateB64: hugeUpdate })).toEqual({
        ok: false,
        error: "collab update frame exceeds limit",
      });

      const maxUpdate = "a".repeat(262144);
      expect(await gw.onUpdate(c.socket, { roundId: "r1", updateB64: maxUpdate })).toEqual({
        ok: true,
        revision: 2,
        changed: true,
      });

      const longRound = "r".repeat(129);
      expect(await gw.onUpdate(c.socket, { roundId: longRound, updateB64: "abc" })).toEqual({
        ok: false,
        error: "collab update frame exceeds limit",
      });

      const maxRound = "r".repeat(128);
      expect(await gw.onUpdate(c.socket, { roundId: maxRound, updateB64: "abc" })).toEqual({
        ok: true,
        revision: 2,
        changed: true,
      });
    });

    it("returns undefined when catch handler encounters non-serving or un-emittable state", async () => {
      let serving = true;
      const game = createGame({
        applyCollabUpdate: vi.fn(async () => {
          serving = false;
          throw new Error("engine failure");
        }),
        get runtimeReady() { return serving; },
        assertServing() { if (!serving) throw new Error("unavailable"); },
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
    });

    it("successfully applies update in same round, relays remote-update and returns result", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";

      const peer = createClient("c2");
      attachSocketPrincipal(peer.socket, { userId: "bob", expiresAt: FUTURE(), matchId: "m1" }, "tok2");
      gw.server = createServer([c, peer]);

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "update-bytes" });
      expect(res).toEqual({ ok: true, revision: 2, changed: true });
      expect(game.applyCollabUpdate).toHaveBeenCalledWith("alice", "m1", { roundId: "r1", updateB64: "update-bytes" });
      expect(peer.events).toContainEqual({
        event: "remote-update",
        body: { updateB64: "update-bytes", revision: 2, roundId: "r1" },
      });
      expect(c.events).toEqual([]);
    });

    it("migrates socket to new room when round has advanced", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";

      const peer = createClient("c2");
      attachSocketPrincipal(peer.socket, { userId: "bob", expiresAt: FUTURE(), matchId: "m1" }, "tok2");
      gw.server = createServer([c, peer]);

      const res = await gw.onUpdate(c.socket, { roundId: "r2", updateB64: "update-bytes" });
      expect(res).toEqual({ ok: true, revision: 2, changed: true });
      expect(game.collabSync).toHaveBeenCalledWith("alice", "m1");
      expect(c.leave).toHaveBeenCalledWith("m1:r1:left");
      expect(c.join).toHaveBeenCalledWith("match-1:round-2:left");
      expect(c.data.room).toBe("match-1:round-2:left");
      expect(c.data.roundId).toBe("round-2");
      expect(c.events).toContainEqual({
        event: "sync",
        body: expect.objectContaining({ roomId: "match-1:round-2:left", roundId: "round-2" }),
      });
    });

    it("returns error response when applyCollabUpdate throws", async () => {
      const game = createGame({
        applyCollabUpdate: vi.fn(async () => {
          throw new Error("stale round rejected");
        }),
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toEqual({ ok: false, error: "stale round rejected" });
    });

    it("suppresses output and returns undefined when runtime ready is lost after applyCollabUpdate", async () => {
      let ready = true;
      const game = createGame({
        applyCollabUpdate: vi.fn(async () => {
          ready = false;
          return { revision: 2, changed: true, source: "code" };
        }),
        get runtimeReady() { return ready; },
        assertServing() { if (!ready) throw new Error("unavailable"); },
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
    });

    it("returns undefined and disconnects when client expires during collabSync round migration", async () => {
      const c = createClient();
      const game = createGame({
        collabSync: vi.fn(async () => {
          attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");
          return {
            roomId: "m:r2:left",
            roundId: "r2",
            side: "left",
            stateB64: "b64",
            source: "src",
            revision: 2,
            language: "python",
          };
        }),
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r2", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined and disconnects when client expires during leave in round migration", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      c.leave = vi.fn(async () => {
        attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");
      });
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r2", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined and disconnects when client expires during join in round migration", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      c.join = vi.fn(async () => {
        attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");
      });
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r2", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined when runtimeReady is lost during leave in round migration", async () => {
      let ready = true;
      const game = createGame({
        get runtimeReady() { return ready; },
        assertServing() { if (!ready) throw new Error("unavailable"); },
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      c.leave = vi.fn(async () => {
        ready = false;
      });
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r2", updateB64: "abc" });
      expect(res).toBeUndefined();
    });

    it("returns undefined when runtimeReady is lost during join in round migration", async () => {
      let ready = true;
      const game = createGame({
        get runtimeReady() { return ready; },
        assertServing() { if (!ready) throw new Error("unavailable"); },
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      c.join = vi.fn(async () => {
        ready = false;
      });
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m:r1:left";
      c.data.roundId = "r1";

      const res = await gw.onUpdate(c.socket, { roundId: "r2", updateB64: "abc" });
      expect(res).toBeUndefined();
    });

    it("returns undefined, disconnects sender, and does not relay update when client expires immediately after sync in round migration", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";

      const peer = createClient("c2");
      attachSocketPrincipal(peer.socket, { userId: "bob", expiresAt: FUTURE(), matchId: "m1" }, "tok2");
      gw.server = createServer([c, peer]);

      const originalEmit = c.emit;
      c.emit = vi.fn((event: string, body: unknown) => {
        originalEmit(event, body);
        if (event === "sync") {
          attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");
        }
      });

      const res = await gw.onUpdate(c.socket, { roundId: "r2", updateB64: "update-bytes" });

      expect(c.events).toContainEqual({
        event: "sync",
        body: expect.objectContaining({ roomId: "match-1:round-2:left", roundId: "round-2" }),
      });
      expect(game.applyCollabUpdate).toHaveBeenCalledTimes(1);
      expect(peer.events).toEqual([]);
      expect(c.disconnectCalls).toEqual([true]);
      expect(c.connected).toBe(false);
      expect(res).toBeUndefined();
    });

    it("returns undefined and disconnects when client expires after applyCollabUpdate before relay", async () => {
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";
      const game = createGame({
        applyCollabUpdate: vi.fn(async () => {
          attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");
          return { revision: 2, changed: true, source: "code" };
        }),
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined and disconnects when sender expires during relay in onUpdate", async () => {
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      gw.server = {
        in: () => ({
          fetchSockets: async () => {
            attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");
            return [];
          },
        }),
      } as never;

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined when runtimeReady is lost during relay in onUpdate", async () => {
      let ready = true;
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      c.data.roundId = "r1";
      const game = createGame({
        get runtimeReady() { return ready; },
        assertServing() { if (!ready) throw new Error("unavailable"); },
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      gw.server = {
        in: () => ({
          fetchSockets: async () => {
            ready = false;
            return [];
          },
        }),
      } as never;

      const res = await gw.onUpdate(c.socket, { roundId: "r1", updateB64: "abc" });
      expect(res).toBeUndefined();
    });
  });

  describe("onCursor", () => {
    it("returns undefined and disconnects when client is disconnected", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      c.connected = false;

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined and disconnects when stored principal is expired", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: Date.now() - 1000, matchId: "m1" }, "tok");

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns undefined and disconnects when stored principal expiresAt is exactly Date.now()", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      const now = 1_700_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: now, matchId: "m1" }, "tok");

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toBeUndefined();
      expect(c.disconnectCalls).toEqual([true]);
    });

    it("returns unauthorized error when stored/verified principal lacks matchId", async () => {
      const game = createGame();
      const exp = FUTURE();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: exp } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      c.data.room = "m1:r1:left";
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: exp } as MatchSocketPrincipal, "tok");

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toEqual({ ok: false, error: "unauthorized socket" });
    });

    it("returns error object when token re-verification fails while runtime is ready", async () => {
      const game = createGame();
      const verifier = createVerifier({});
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "invalid-token");

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toEqual({ ok: false, error: "unauthorized socket" });
    });

    it("returns undefined when token re-verification fails and runtime is not ready", async () => {
      const game = createGame({ runtimeReady: false });
      const verifier = createVerifier({});
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "invalid-token");

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toBeUndefined();
    });

    it("returns error when room is not set on socket data", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toEqual({ ok: false, error: "unauthorized" });
    });



    it("sanitizes cursor payload (truncating displayName to 40 and color to 16, normalizing non-numbers to null)", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";

      const peer = createClient("c2");
      attachSocketPrincipal(peer.socket, { userId: "bob", expiresAt: FUTURE(), matchId: "m1" }, "tok2");
      gw.server = createServer([c, peer]);

      const res = await gw.onCursor(c.socket, {
        clientId: 42,
        anchor: 10,
        head: 15,
        displayName: "A".repeat(50),
        color: "#1234567890abcdefextra",
      });

      expect(res).toEqual({ ok: true });
      expect(peer.events).toContainEqual({
        event: "peer-cursor",
        body: {
          userId: "alice",
          clientId: 42,
          anchor: 10,
          head: 15,
          displayName: "A".repeat(40),
          color: "#1234567890abcde",
        },
      });
    });

    it("handles null / non-type cursor fields gracefully", async () => {
      const game = createGame();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";

      const peer = createClient("c2");
      attachSocketPrincipal(peer.socket, { userId: "bob", expiresAt: FUTURE(), matchId: "m1" }, "tok2");
      gw.server = createServer([c, peer]);

      const res = await gw.onCursor(c.socket, {
        clientId: "invalid" as never,
        anchor: undefined,
        head: null as never,
        displayName: 123 as never,
        color: false as never,
      });

      expect(res).toEqual({ ok: true });
      expect(peer.events).toContainEqual({
        event: "peer-cursor",
        body: {
          userId: "alice",
          clientId: null,
          anchor: null,
          head: null,
          displayName: null,
          color: null,
        },
      });
    });

    it("returns undefined when runtime ready is false before cursor relay", async () => {
      const game = createGame({ runtimeReady: false });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toBeUndefined();
    });

    it("returns undefined when onCursor catch handler encounters non-serving state", async () => {
      let serving = true;
      const game = createGame({
        get runtimeReady() { return serving; },
        assertServing() { if (!serving) throw new Error("unavailable"); },
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      serving = false;

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toBeUndefined();
    });

    it("returns undefined when runtimeReady is lost during cursor relay", async () => {
      let ready = true;
      const game = createGame({
        get runtimeReady() { return ready; },
        assertServing() { if (!ready) throw new Error("unavailable"); },
      });
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: FUTURE() } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      gw.server = {
        in: () => ({
          fetchSockets: async () => {
            ready = false;
            return [];
          },
        }),
      } as never;

      const res = await gw.onCursor(c.socket, { clientId: 1 });
      expect(res).toBeUndefined();
    });
  });

  describe("handleConnection", () => {
    it("successfully connects, attaches room/roundId, joins room and emits sync", async () => {
      const game = createGame();
      const exp = FUTURE();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: exp } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1", { accessToken: "tok", matchId: "m1" });

      await gw.handleConnection(c.socket);
      expect(c.data.room).toBe("match-1:round-2:left");
      expect(c.data.roundId).toBe("round-2");
      expect(c.join).toHaveBeenCalledWith("match-1:round-2:left");
      expect(c.events).toContainEqual({
        event: "sync",
        body: expect.objectContaining({ roomId: "match-1:round-2:left", roundId: "round-2" }),
      });
      expect(c.disconnectCalls).toEqual([]);
    });

    it("disconnects client when game.assertServing throws initially", async () => {
      const game = createGame({
        assertServing() { throw new Error("engine offline"); },
      });
      const gw = new CollabGateway(game);
      const c = createClient();

      await gw.handleConnection(c.socket);
      expect(c.disconnectCalls).toEqual([true]);
      expect(c.events).toEqual([]);
    });

    it("disconnects client when handshake authentication fails", async () => {
      const game = createGame();
      const verifier = createVerifier({});
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1", { accessToken: "bad-tok", matchId: "m1" });

      await gw.handleConnection(c.socket);
      expect(c.disconnectCalls).toEqual([true]);
      expect(c.events).toEqual([]);
    });

    it("disconnects client when handshake principal lacks matchId", async () => {
      const game = createGame();
      const exp = FUTURE();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: exp } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1", { accessToken: "tok" });

      await gw.handleConnection(c.socket);
      expect(c.disconnectCalls).toEqual([true]);
      expect(game.collabSync).not.toHaveBeenCalled();
      expect(c.events).toEqual([]);
    });

    it("disconnects client when client is disconnected or cannot emit after handshake", async () => {
      const game = createGame();
      const exp = FUTURE();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: exp } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1", { accessToken: "tok", matchId: "m1" });
      c.connected = false;

      await gw.handleConnection(c.socket);
      expect(c.disconnectCalls).toEqual([true]);
      expect(c.events).toEqual([]);
    });

    it("disconnects client when runtimeReady is lost after collabSync", async () => {
      let ready = true;
      const game = createGame({
        collabSync: vi.fn(async () => {
          ready = false;
          return { roomId: "m:r1:left", roundId: "r1", side: "left", stateB64: "", source: "", revision: 1, language: "python" };
        }),
        get runtimeReady() { return ready; },
        assertServing() { if (!ready) throw new Error("unavailable"); },
      });
      const exp = FUTURE();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: exp } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1", { accessToken: "tok", matchId: "m1" });

      await gw.handleConnection(c.socket);
      expect(c.disconnectCalls).toEqual([true]);
      expect(c.events).toEqual([]);
    });

    it("disconnects client when runtimeReady is lost after join", async () => {
      let ready = true;
      const game = createGame({
        get runtimeReady() { return ready; },
        assertServing() { if (!ready) throw new Error("unavailable"); },
      });
      const exp = FUTURE();
      const verifier = createVerifier({ "tok": { userId: "alice", expiresAt: exp } });
      const gw = new CollabGateway(game, verifier);
      const c = createClient("c1", { accessToken: "tok", matchId: "m1" });
      c.join = vi.fn(async () => {
        ready = false;
      });

      await gw.handleConnection(c.socket);
      expect(c.disconnectCalls).toEqual([true]);
      expect(c.events).toEqual([]);
    });
  });

  describe("handleDisconnect", () => {
    it("returns immediately without broadcast when runtimeReady is false", async () => {
      const game = createGame({ runtimeReady: false });
      const gw = new CollabGateway(game);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";
      gw.server = createServer([]);

      await gw.handleDisconnect(c.socket);
      expect(gw.server.in).not.toHaveBeenCalled();
    });

    it("broadcasts peer-left to surviving teammates when room is set and principal exists", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      c.data.room = "m1:r1:left";

      const peer = createClient("c2");
      attachSocketPrincipal(peer.socket, { userId: "bob", expiresAt: FUTURE(), matchId: "m1" }, "tok2");
      gw.server = createServer([c, peer]);

      await gw.handleDisconnect(c.socket);
      expect(gw.server.in).toHaveBeenCalledWith("m1:r1:left");
      expect(peer.events).toContainEqual({
        event: "peer-left",
        body: { userId: "alice" },
      });
    });

    it("does not broadcast when room is missing from socket data", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE(), matchId: "m1" }, "tok");
      gw.server = createServer([]);

      await gw.handleDisconnect(c.socket);
      expect(gw.server.in).not.toHaveBeenCalled();
    });

    it("does not broadcast when socket lacks principal", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient();
      c.data.room = "m1:r1:left";
      gw.server = createServer([]);

      await gw.handleDisconnect(c.socket);
      expect(gw.server.in).not.toHaveBeenCalled();
    });

    it("does not broadcast when socket principal lacks matchId", async () => {
      const game = createGame();
      const gw = new CollabGateway(game);
      const c = createClient("c1");
      attachSocketPrincipal(c.socket, { userId: "alice", expiresAt: FUTURE() } as MatchSocketPrincipal, "tok");
      c.data.room = "m1:r1:left";
      gw.server = createServer([]);

      await gw.handleDisconnect(c.socket);
      expect(gw.server.in).not.toHaveBeenCalled();
    });


  });
});
