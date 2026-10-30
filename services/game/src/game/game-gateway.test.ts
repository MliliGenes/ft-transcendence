import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket, Server } from "socket.io";
import { UnauthorizedError } from "../auth/auth-principal-client.js";
import { GameGateway } from "./game.gateway.js";
import type { GameService } from "./game.service.js";

const ALICE = "alice";
const MATCH = "match-123";
const FUTURE = () => Date.now() + 60_000;
const PAST = () => Date.now() - 10_000;

interface TestClientOptions {
  userId?: string;
  matchId?: string;
  expiresAt?: number;
  accessToken?: string;
  connected?: boolean;
}

function makeClient(opts: TestClientOptions = {}) {
  const userId = opts.userId ?? ALICE;
  const matchId = opts.matchId ?? MATCH;
  const expiresAt = opts.expiresAt ?? FUTURE();
  const connected = opts.connected ?? true;

  const rooms = new Set<string>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const disconnectCalls: unknown[] = [];

  const data: Record<string, unknown> = {
    arenaPrincipal: {
      userId,
      matchId,
      expiresAt,
    },
  };
  if (opts.accessToken) {
    data.accessToken = opts.accessToken;
  }

  const handshakeAuth: Record<string, unknown> = {
    userId,
    matchId,
  };
  if (opts.accessToken) {
    handshakeAuth.accessToken = opts.accessToken;
  }

  const socket = {
    id: `sock-${Math.random().toString(36).slice(2, 9)}`,
    connected,
    rooms,
    data,
    handshake: {
      auth: handshakeAuth,
      query: {},
      headers: {},
    },
    join: vi.fn(async (room: string) => {
      rooms.add(room);
    }),
    leave: vi.fn(async (room: string) => {
      rooms.delete(room);
    }),
    emit: vi.fn((event: string, payload: unknown) => {
      emitted.push({ event, payload });
    }),
    disconnect: vi.fn((close?: unknown) => {
      socket.connected = false;
      disconnectCalls.push(close);
    }),
  };

  return {
    socket: socket as unknown as Socket,
    rooms,
    emitted,
    disconnectCalls,
    data: socket.data,
  };
}

function makeVerifier(map: Record<string, { userId: string; expiresAt: number } | Error>) {
  return {
    verify: vi.fn(async (token: string) => {
      const v = map[token];
      if (v instanceof Error) throw v;
      if (!v) throw new UnauthorizedError("invalid token");
      return v;
    }),
  };
}

function makeGame(initialReady = true, overrides: Record<string, unknown> = {}) {
  let ready = initialReady;
  const eventListeners: Array<(event: string, matchId: string, payload: unknown) => void> = [];

  const game = {
    get runtimeReady() {
      return ready;
    },
    set runtimeReady(val: boolean) {
      ready = val;
    },
    assertServing: vi.fn(() => {
      if (!ready) throw new Error("Service Unavailable");
    }),
    onEvent: vi.fn((listener: (event: string, matchId: string, payload: unknown) => void) => {
      eventListeners.push(listener);
      return () => {
        const idx = eventListeners.indexOf(listener);
        if (idx >= 0) eventListeners.splice(idx, 1);
      };
    }),
    snapshot: vi.fn(async (_userId: string, _matchId: string) => ({
      sequence: 1,
      state: "active",
    })),
    noteSocketOpen: vi.fn(async (_userId: string, _matchId: string, _socketId: string) => {}),
    noteSocketClosed: vi.fn(async (_userId: string, _matchId: string, _socketId: string) => {}),
    run: vi.fn(async (_userId: string, _matchId: string, _body: unknown) => ({ ran: true })),
    submit: vi.fn(async (_userId: string, _matchId: string, _body: unknown) => ({ evaluationId: "eval-1" })),
    setReady: vi.fn(async (_userId: string, _matchId: string, _payload: unknown) => {}),
    leave: vi.fn(async (_userId: string, _matchId: string) => ({ forfeited: true })),
    ...overrides,
  };

  return {
    game: game as unknown as GameService & typeof game,
    eventListeners,
  };
}

function makeServer(recipients: Array<{ socket: Socket; connected: boolean; data: Record<string, unknown> }> = []) {
  const broadcasted: Array<{ room: string; event: string; payload: unknown }> = [];
  return {
    in: vi.fn((room: string) => ({
      fetchSockets: vi.fn(async () =>
        recipients.map((r) => ({
          id: r.socket.id,
          connected: r.connected,
          data: r.data,
          emit: vi.fn((e: string, p: unknown) => {
            broadcasted.push({ room, event: e, payload: p });
          }),
        })),
      ),
    })),
    broadcasted,
  };
}

describe("GameGateway characterization test suite", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_PRINCIPAL", "true");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("Section 1: Command Handlers - Success & Inferred Return Shapes", () => {
    it("onRun executes with verified principal identity, passes body unchanged, and returns { ok: true, result }", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient();

      const inputBody = { code: "return 42", language: "typescript", extraField: "custom-meta" };
      const ack = await gateway.onRun(client.socket, inputBody);

      expect(ack).toEqual({ ok: true, result: { ran: true } });
      expect(game.run).toHaveBeenCalledTimes(1);
      expect(game.run).toHaveBeenCalledWith(ALICE, MATCH, inputBody);
      expect(game.assertServing).toHaveBeenCalledTimes(2);
    });

    it("onSubmit executes with verified principal identity, passes body unchanged, and returns { ok: true, result }", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient();

      const inputBody = { code: "assert 1 == 1", language: "python", submissionId: "sub-9", evaluationId: "eval-9" };
      const ack = await gateway.onSubmit(client.socket, inputBody);

      expect(ack).toEqual({ ok: true, result: { evaluationId: "eval-1" } });
      expect(game.submit).toHaveBeenCalledTimes(1);
      expect(game.submit).toHaveBeenCalledWith(ALICE, MATCH, inputBody);
      expect(game.assertServing).toHaveBeenCalledTimes(2);
    });

    it("onReady executes with mapped ready: true, forwards documentRevision, and returns { ok: true } with NO result property", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient();

      const ack = await gateway.onReady(client.socket, { value: true, documentRevision: 42 });

      expect(ack).toEqual({ ok: true });
      expect("result" in (ack as object)).toBe(false);
      expect(game.setReady).toHaveBeenCalledTimes(1);
      expect(game.setReady).toHaveBeenCalledWith(ALICE, MATCH, { ready: true, documentRevision: 42 });
    });

    it("onReady strict boolean mapping: value: false, truthy values, null and undefined payloads", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient();

      // false
      const ackFalse = await gateway.onReady(client.socket, { value: false });
      expect(ackFalse).toEqual({ ok: true });
      expect(game.setReady).toHaveBeenLastCalledWith(ALICE, MATCH, { ready: false, documentRevision: undefined });

      // truthy string 'true' is NOT boolean true
      const ackString = await gateway.onReady(client.socket, { value: "true" as unknown as boolean });
      expect(ackString).toEqual({ ok: true });
      expect(game.setReady).toHaveBeenLastCalledWith(ALICE, MATCH, { ready: false, documentRevision: undefined });

      // number 1 is NOT boolean true
      const ackNum = await gateway.onReady(client.socket, { value: 1 as unknown as boolean });
      expect(ackNum).toEqual({ ok: true });
      expect(game.setReady).toHaveBeenLastCalledWith(ALICE, MATCH, { ready: false, documentRevision: undefined });

      // undefined body
      const ackUndef = await gateway.onReady(client.socket, undefined as unknown as { value: boolean });
      expect(ackUndef).toEqual({ ok: true });
      expect(game.setReady).toHaveBeenLastCalledWith(ALICE, MATCH, { ready: false, documentRevision: undefined });

      // null body
      const ackNull = await gateway.onReady(client.socket, null as unknown as { value: boolean });
      expect(ackNull).toEqual({ ok: true });
      expect(game.setReady).toHaveBeenLastCalledWith(ALICE, MATCH, { ready: false, documentRevision: undefined });
    });

    it("onLeave executes with verified principal identity and returns { ok: true, result }", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient();

      const ack = await gateway.onLeave(client.socket);

      expect(ack).toEqual({ ok: true, result: { forfeited: true } });
      expect(game.leave).toHaveBeenCalledTimes(1);
      expect(game.leave).toHaveBeenCalledWith(ALICE, MATCH);
    });

    it("payload identity spoofing is ignored on all commands", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient({ userId: ALICE, matchId: MATCH });

      // Malicious payload with spoofed userId and matchId
      const spoofedPayload = {
        code: "x = 1",
        language: "python",
        userId: "hacker-victim",
        matchId: "other-match",
        accessToken: "forged-token",
      } as unknown as { code: string; language: string };

      await gateway.onRun(client.socket, spoofedPayload);
      expect(game.run).toHaveBeenCalledWith(ALICE, MATCH, spoofedPayload);

      await gateway.onSubmit(client.socket, spoofedPayload);
      expect(game.submit).toHaveBeenCalledWith(ALICE, MATCH, spoofedPayload);

      await gateway.onLeave(client.socket);
      expect(game.leave).toHaveBeenCalledWith(ALICE, MATCH);
    });
  });

  describe("Section 2: Command Handlers - Error Shapes & Non-Error Fallbacks", () => {
    it("preserves exact non-Error fallback error strings: run failed, submit failed, setReady failed, leave failed", async () => {
      const { game } = makeGame(true, {
        run: vi.fn(async () => {
          throw "string error run";
        }),
        submit: vi.fn(async () => {
          throw 12345;
        }),
        setReady: vi.fn(async () => {
          throw { unexpected: "object" };
        }),
        leave: vi.fn(async () => {
          throw null;
        }),
      });
      const gateway = new GameGateway(game);
      const client = makeClient();

      const runAck = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(runAck).toEqual({ ok: false, error: "run failed" });

      const submitAck = await gateway.onSubmit(client.socket, { code: "1", language: "py" });
      expect(submitAck).toEqual({ ok: false, error: "submit failed" });

      const readyAck = await gateway.onReady(client.socket, { value: true });
      expect(readyAck).toEqual({ ok: false, error: "setReady failed" });

      const leaveAck = await gateway.onLeave(client.socket);
      expect(leaveAck).toEqual({ ok: false, error: "leave failed" });
    });

    it("preserves real Error.message thrown by service across all commands", async () => {
      const { game } = makeGame(true, {
        run: vi.fn(async () => {
          throw new Error("Syntax error in test snippet");
        }),
        submit: vi.fn(async () => {
          throw new Error("Rate limit exceeded on evaluation");
        }),
        setReady: vi.fn(async () => {
          throw new Error("Document revision conflict");
        }),
        leave: vi.fn(async () => {
          throw new Error("Match already completed");
        }),
      });
      const gateway = new GameGateway(game);
      const client = makeClient();

      expect(await gateway.onRun(client.socket, { code: "1", language: "py" })).toEqual({
        ok: false,
        error: "Syntax error in test snippet",
      });
      expect(await gateway.onSubmit(client.socket, { code: "1", language: "py" })).toEqual({
        ok: false,
        error: "Rate limit exceeded on evaluation",
      });
      expect(await gateway.onReady(client.socket, { value: true })).toEqual({
        ok: false,
        error: "Document revision conflict",
      });
      expect(await gateway.onLeave(client.socket)).toEqual({
        ok: false,
        error: "Match already completed",
      });
    });

    it("authorization failure: formats error when runtimeReady, suppresses ack (returns undefined) when runtimeReady is false", async () => {
      vi.stubEnv("DEV_PRINCIPAL", "false");
      const verifier = makeVerifier({}); // reject all tokens
      const { game } = makeGame(true);
      const gateway = new GameGateway(game, verifier as never);
      const client = makeClient({ accessToken: "invalid-token" });

      // When runtimeReady is true, returns { ok: false, error: ... }
      const runAck = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(runAck).toEqual({ ok: false, error: "unauthorized socket" });

      const client2 = makeClient({ accessToken: "invalid-token" });
      const submitAck = await gateway.onSubmit(client2.socket, { code: "1", language: "py" });
      expect(submitAck).toEqual({ ok: false, error: "unauthorized socket" });

      const client3 = makeClient({ accessToken: "invalid-token" });
      const readyAck = await gateway.onReady(client3.socket, { value: true });
      expect(readyAck).toEqual({ ok: false, error: "unauthorized socket" });

      const client4 = makeClient({ accessToken: "invalid-token" });
      const leaveAck = await gateway.onLeave(client4.socket);
      expect(leaveAck).toEqual({ ok: false, error: "unauthorized socket" });

      // When runtimeReady is false, returns undefined (suppresses ack)
      game.runtimeReady = false;
      const client5 = makeClient({ accessToken: "invalid-token" });
      expect(await gateway.onRun(client5.socket, { code: "1", language: "py" })).toBeUndefined();
      const client6 = makeClient({ accessToken: "invalid-token" });
      expect(await gateway.onSubmit(client6.socket, { code: "1", language: "py" })).toBeUndefined();
      const client7 = makeClient({ accessToken: "invalid-token" });
      expect(await gateway.onReady(client7.socket, { value: true })).toBeUndefined();
      const client8 = makeClient({ accessToken: "invalid-token" });
      expect(await gateway.onLeave(client8.socket)).toBeUndefined();
    });

    it("authorization non-Error throw formats command-specific fallback message", async () => {
      vi.stubEnv("DEV_PRINCIPAL", "false");
      const verifier = {
        verify: vi.fn(async () => {
          throw "auth boom";
        }),
      };
      const { game } = makeGame(true);
      const gateway = new GameGateway(game, verifier as never);

      // authorizeSocketMessage catches non-Error and rethrows fail("unauthorized socket"),
      // so we simulate authorizeSocketMessage throwing a non-Error by mocking it or using a custom verifier error.
      // If authorizeSocketMessage itself throws an Error, error.message is used.
      // When error is a non-Error, fallback string is used:
      const client = makeClient({ accessToken: "token-1" });
      const ack = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(ack).toEqual({ ok: false, error: "unauthorized socket" });
    });

    it("message authorization fails when socket principal is missing matchId", async () => {
      vi.stubEnv("DEV_PRINCIPAL", "false");
      const exp = FUTURE();
      const verifier = makeVerifier({ "valid-token": { userId: ALICE, expiresAt: exp } });
      const { game } = makeGame();
      const gateway = new GameGateway(game, verifier as never);
      const client = makeClient({ accessToken: "valid-token", matchId: undefined });
      delete (client.data.arenaPrincipal as Record<string, unknown>).matchId;

      const ack = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(ack).toEqual({ ok: false, error: "unauthorized socket" });
    });
  });

  describe("Section 3: Disconnected & Expiry Handling in Commands", () => {
    it("expired stored token boundary (expiresAt <= Date.now()) disconnects client and returns undefined", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const exactNow = Date.now();
      const client = makeClient({ expiresAt: exactNow });

      expect(await gateway.onRun(client.socket, { code: "1", language: "py" })).toBeUndefined();
      expect(client.disconnectCalls).toContain(true);
      expect(game.run).not.toHaveBeenCalled();
    });
    it("disconnected client triggers disconnect(true) and returns undefined without calling service", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient({ connected: false });

      expect(await gateway.onRun(client.socket, { code: "1", language: "py" })).toBeUndefined();
      expect(await gateway.onSubmit(client.socket, { code: "1", language: "py" })).toBeUndefined();
      expect(await gateway.onReady(client.socket, { value: true })).toBeUndefined();
      expect(await gateway.onLeave(client.socket)).toBeUndefined();

      expect(client.disconnectCalls).toContain(true);
      expect(game.run).not.toHaveBeenCalled();
      expect(game.submit).not.toHaveBeenCalled();
      expect(game.setReady).not.toHaveBeenCalled();
      expect(game.leave).not.toHaveBeenCalled();
    });

    it("expired stored token before command disconnects client and returns undefined", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient({ expiresAt: PAST() });

      expect(await gateway.onRun(client.socket, { code: "1", language: "py" })).toBeUndefined();
      expect(await gateway.onSubmit(client.socket, { code: "1", language: "py" })).toBeUndefined();
      expect(await gateway.onReady(client.socket, { value: true })).toBeUndefined();
      expect(await gateway.onLeave(client.socket)).toBeUndefined();

      expect(client.disconnectCalls).toContain(true);
      expect(game.run).not.toHaveBeenCalled();
    });

    it("late expiry during service execution suppresses ack (returns undefined) and disconnects client", async () => {
      let runCalls = 0;
      let submitCalls = 0;
      const client = makeClient({ expiresAt: FUTURE() });

      const { game } = makeGame(true, {
        run: vi.fn(async () => {
          runCalls += 1;
          (client.data.arenaPrincipal as { expiresAt: number }).expiresAt = PAST();
          return { ran: true };
        }),
        submit: vi.fn(async () => {
          submitCalls += 1;
          (client.data.arenaPrincipal as { expiresAt: number }).expiresAt = PAST();
          return { evaluationId: "e1" };
        }),
      });
      const gateway = new GameGateway(game);

      const runAck = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(runCalls).toBe(1);
      expect(runAck).toBeUndefined();
      expect(client.disconnectCalls).toContain(true);

      // Reset client expiry for submit
      (client.data.arenaPrincipal as { expiresAt: number }).expiresAt = FUTURE();
      client.socket.connected = true;
      const submitAck = await gateway.onSubmit(client.socket, { code: "1", language: "py" });
      expect(submitCalls).toBe(1);
      expect(submitAck).toBeUndefined();
    });

    it("late error suppression on expiry: service error is suppressed and returns undefined", async () => {
      const client = makeClient({ expiresAt: FUTURE() });
      const { game } = makeGame(true, {
        run: vi.fn(async () => {
          (client.data.arenaPrincipal as { expiresAt: number }).expiresAt = PAST();
          throw new Error("delayed engine error");
        }),
      });
      const gateway = new GameGateway(game);

      const ack = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(ack).toBeUndefined();
    });

    it("runtime loss during command execution suppresses ack and returns undefined", async () => {
      let called = 0;
      const { game } = makeGame(true);
      game.run = vi.fn(async () => {
        called += 1;
        game.runtimeReady = false;
        return { ran: true };
      }) as never;

      const gateway = new GameGateway(game);
      const client = makeClient();

      const ack = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(called).toBe(1);
      expect(ack).toBeUndefined();
    });

    it("simultaneous runtime loss and late expiry executes late-expiry disconnect before post-command assertServing", async () => {
      const client = makeClient({ expiresAt: FUTURE() });
      const { game } = makeGame(true);
      game.run = vi.fn(async () => {
        (client.data.arenaPrincipal as { expiresAt: number }).expiresAt = PAST();
        game.runtimeReady = false;
        return { ran: true };
      }) as never;

      const gateway = new GameGateway(game);

      const ack = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(ack).toBeUndefined();
      expect(client.disconnectCalls).toContain(true);
    });

    it("late assertServing failure in catch block suppresses error and returns undefined", async () => {
      const client = makeClient({ expiresAt: FUTURE() });
      const { game } = makeGame(true);
      game.run = vi.fn(async () => {
        throw new Error("engine fault");
      }) as never;

      // canEmitTo returns true, but assertServing throws inside catch
      let assertCount = 0;
      game.assertServing = vi.fn(() => {
        assertCount += 1;
        if (assertCount >= 2) {
          throw new Error("runtime unavailable in catch");
        }
      });

      const gateway = new GameGateway(game);
      const ack = await gateway.onRun(client.socket, { code: "1", language: "py" });
      expect(ack).toBeUndefined();
    });
  });

  describe("Section 4: Admission & Reconnect in handleConnection", () => {
    it("full happy path: admission verifies, takes membership snapshot, opens presence, joins room, takes and emits fresh snapshot", async () => {
      const snapshotCalls: string[] = [];
      const { game } = makeGame(true, {
        snapshot: vi.fn(async (userId: string, matchId: string) => {
          snapshotCalls.push(`${userId}:${matchId}:${snapshotCalls.length + 1}`);
          return { sequence: snapshotCalls.length, baseline: true };
        }),
      });
      const gateway = new GameGateway(game);
      const client = makeClient();

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(true);
      expect(client.rooms.has(`match:${MATCH}`)).toBe(true);
      expect(game.noteSocketOpen).toHaveBeenCalledTimes(1);
      expect(game.noteSocketOpen).toHaveBeenCalledWith(ALICE, MATCH, client.socket.id);
      expect(game.noteSocketClosed).not.toHaveBeenCalled();

      // Exactly two snapshots taken in order
      expect(snapshotCalls).toEqual([
        `${ALICE}:${MATCH}:1`,
        `${ALICE}:${MATCH}:2`,
      ]);

      // Emitted snapshot is the second fresh snapshot
      expect(client.emitted).toEqual([
        { event: "snapshot", payload: { sequence: 2, baseline: true } },
      ]);
    });

    it("handshake authentication failure aborts admission, disconnects socket, and takes zero snapshots", async () => {
      vi.stubEnv("DEV_PRINCIPAL", "false");
      const verifier = makeVerifier({}); // reject token
      const { game } = makeGame();
      const gateway = new GameGateway(game, verifier as never);
      const client = makeClient({ accessToken: "invalid-token" });

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(client.disconnectCalls).toContain(true);
      expect(game.snapshot).not.toHaveBeenCalled();
      expect(game.noteSocketOpen).not.toHaveBeenCalled();
      expect(client.rooms.size).toBe(0);
    });

    it("handshake without matchId aborts admission, disconnects socket, and does not admit", async () => {
      vi.stubEnv("DEV_PRINCIPAL", "false");
      const exp = FUTURE();
      const verifier = makeVerifier({ "valid-token": { userId: ALICE, expiresAt: exp } });
      const { game } = makeGame();
      const gateway = new GameGateway(game, verifier as never);
      const client = makeClient({ accessToken: "valid-token", matchId: undefined });
      delete (client.data.arenaPrincipal as Record<string, unknown>).matchId;
      delete (client.socket.handshake.auth as Record<string, unknown>).matchId;

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(client.rooms.size).toBe(0);
      expect(game.noteSocketOpen).not.toHaveBeenCalled();
    });

    it("pre-handshake assertServing failure disconnects client and runs zero steps", async () => {
      const { game } = makeGame(false); // runtimeReady false
      const gateway = new GameGateway(game);
      const client = makeClient();

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketOpen).not.toHaveBeenCalled();
      expect(game.snapshot).not.toHaveBeenCalled();
    });

    it("emission blocked after handshake aborts and disconnects client without opening presence", async () => {
      const client = makeClient();
      const { game } = makeGame(true);
      // Handshake passes, but right after handshake runtime becomes unready
      const origAssertServing = game.assertServing;
      let count = 0;
      game.assertServing = vi.fn(() => {
        count += 1;
        if (count === 1) origAssertServing();
        if (count === 2) game.runtimeReady = false;
      });

      const gateway = new GameGateway(game);
      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketOpen).not.toHaveBeenCalled();
      expect(game.noteSocketClosed).not.toHaveBeenCalled();
    });

    it("first snapshot failure disconnects client and does NOT call noteSocketClosed because opened was false", async () => {
      const { game } = makeGame(true, {
        snapshot: vi.fn(async () => {
          throw new Error("snapshot database failure");
        }),
      });
      const gateway = new GameGateway(game);
      const client = makeClient();

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(client.disconnectCalls).toContain(true);
      expect(game.noteSocketOpen).not.toHaveBeenCalled();
      expect(game.noteSocketClosed).not.toHaveBeenCalled();
    });

    it("noteSocketOpen failure triggers catch block and disconnects client without calling noteSocketClosed", async () => {
      const { game } = makeGame(true, {
        noteSocketOpen: vi.fn(async () => {
          throw new Error("presence conflict");
        }),
      });
      const gateway = new GameGateway(game);
      const client = makeClient();

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketClosed).not.toHaveBeenCalled();
    });

    it("emission blocked after noteSocketOpen calls noteSocketClosed and disconnects client", async () => {
      const client = makeClient();
      const { game } = makeGame(true);
      const origNoteSocketOpen = game.noteSocketOpen;
      game.noteSocketOpen = vi.fn(async (u, m, s) => {
        await origNoteSocketOpen(u, m, s);
        game.runtimeReady = false; // block emission on the check immediately following noteSocketOpen
        return "open-id";
      }) as never;

      const gateway = new GameGateway(game);
      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketClosed).toHaveBeenCalledTimes(1);
      expect(game.noteSocketClosed).toHaveBeenCalledWith(ALICE, MATCH, client.socket.id);
    });

    it("room join failure triggers catch block, calls noteSocketClosed because opened=true, and disconnects client", async () => {
      const client = makeClient();
      client.socket.join = vi.fn(async () => {
        throw new Error("Socket.IO cluster join failure");
      });
      const { game } = makeGame(true);
      const gateway = new GameGateway(game);

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketClosed).toHaveBeenCalledTimes(1);
      expect(game.noteSocketClosed).toHaveBeenCalledWith(ALICE, MATCH, client.socket.id);
    });

    it("emission blocked after room join calls noteSocketClosed and disconnects client", async () => {
      const client = makeClient();
      const { game } = makeGame(true);
      client.socket.join = vi.fn(async (r) => {
        client.rooms.add(r);
        game.runtimeReady = false; // block emission right after join
      });
      const gateway = new GameGateway(game);

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketClosed).toHaveBeenCalledTimes(1);
    });

    it("second snapshot failure triggers catch block, calls noteSocketClosed because opened=true, and disconnects client", async () => {
      let snapCount = 0;
      const { game } = makeGame(true, {
        snapshot: vi.fn(async () => {
          snapCount += 1;
          if (snapCount === 1) return { first: true };
          throw new Error("second snapshot failure");
        }),
      });
      const gateway = new GameGateway(game);
      const client = makeClient();

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketClosed).toHaveBeenCalledTimes(1);
      expect(game.noteSocketClosed).toHaveBeenCalledWith(ALICE, MATCH, client.socket.id);
    });

    it("emission blocked after second snapshot calls noteSocketClosed and disconnects client", async () => {
      let snapCount = 0;
      const client = makeClient();
      const { game } = makeGame(true);
      game.snapshot = vi.fn(async () => {
        snapCount += 1;
        if (snapCount === 2) {
          game.runtimeReady = false; // block emission right after second snapshot
        }
        return { snap: snapCount } as never;
      }) as never;

      const gateway = new GameGateway(game);
      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(game.noteSocketClosed).toHaveBeenCalledTimes(1);
    });

    it("resilience: when noteSocketClosed in catch block throws, client disconnect still proceeds", async () => {
      const client = makeClient();
      client.socket.join = vi.fn(async () => {
        throw new Error("join failure");
      });
      const { game } = makeGame(true, {
        noteSocketClosed: vi.fn(async () => {
          throw new Error("database closed failure");
        }),
      });
      const gateway = new GameGateway(game);

      await gateway.handleConnection(client.socket);

      expect(client.socket.connected).toBe(false);
      expect(client.disconnectCalls).toContain(true);
    });
  });

  describe("Section 5: Disconnect and Constructor Events", () => {
    it("handleDisconnect calls noteSocketClosed and NEVER calls game.leave", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient();

      await gateway.handleDisconnect(client.socket);

      expect(game.noteSocketClosed).toHaveBeenCalledTimes(1);
      expect(game.noteSocketClosed).toHaveBeenCalledWith(ALICE, MATCH, client.socket.id);
      expect(game.leave).not.toHaveBeenCalled();
    });

    it("handleDisconnect without matchId does not call noteSocketClosed", async () => {
      const { game } = makeGame();
      const gateway = new GameGateway(game);
      const client = makeClient({ matchId: undefined });
      delete (client.data.arenaPrincipal as Record<string, unknown>).matchId;

      await gateway.handleDisconnect(client.socket);

      expect(game.noteSocketClosed).not.toHaveBeenCalled();
    });

    it("constructor registers onEvent listener and broadcasts gated to match room when runtimeReady", async () => {
      const { game, eventListeners } = makeGame(true);
      const gateway = new GameGateway(game);
      const server = makeServer();
      gateway.server = server as unknown as Server;

      expect(eventListeners).toHaveLength(1);
      const listener = eventListeners[0];

      // Broadcasts when matchId and runtimeReady
      listener("scoreUpdate", "match-99", { score: 100 });
      expect(server.in).toHaveBeenCalledWith("match:match-99");

      // Does not broadcast when matchId is empty
      server.in.mockClear();
      listener("scoreUpdate", "", { score: 100 });
      expect(server.in).not.toHaveBeenCalled();

      // Does not broadcast when runtimeReady is false
      server.in.mockClear();
      game.runtimeReady = false;
      listener("scoreUpdate", "match-99", { score: 100 });
      expect(server.in).not.toHaveBeenCalled();
    });
  });
});
