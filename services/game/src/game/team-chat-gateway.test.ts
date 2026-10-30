import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { TeamChatGateway } from "./team-chat.gateway.js";
import type { GameService } from "./game.service.js";
import { TeamChat } from "arena-game-engine/team-chat";
import type { AuthPrincipalClient } from "../auth/auth-principal-client.js";

function makeGame(initialReady = true) {
  let ready = initialReady;
  const game = {
    get runtimeReady() {
      return ready;
    },
    set runtimeReady(val: boolean) {
      ready = val;
    },
    assertServing: vi.fn(),
    resolveTeamChatContext: vi.fn(async (userId: string, matchId: string) => ({
      sideId: "left",
      roomId: `arena:${matchId}:team:left`,
      active: true,
    })),
  };
  return game as unknown as GameService & typeof game;
}

function makeSocket(id = "sender-1") {
  const events = new EventEmitter();
  const rooms = new Set<string>();
  const client = {
    id,
    connected: true,
    rooms,
    data: {
      sideId: "left",
      roomId: "arena:m1:team:left",
      arenaPrincipal: {
        userId: "u1",
        matchId: "m1",
        expiresAt: Date.now() + 60000,
      },
    } as Record<string, unknown>,
    handshake: {
      auth: { userId: "u1", matchId: "m1" },
      query: {},
    },
    disconnect: vi.fn((_close?: boolean) => {
      client.connected = false;
      events.emit("disconnect");
    }),
    join: vi.fn(async (room: string) => {
      rooms.add(room);
    }),
    leave: vi.fn(async (room: string) => {
      rooms.delete(room);
    }),
    emit: vi.fn(),
    once: events.once.bind(events),
    off: events.off.bind(events),
    on: events.on.bind(events),
  };
  return client as unknown as Socket & typeof client & { rooms: Set<string> };
}

function makeServer(recipients: Socket[] = []) {
  return {
    in: vi.fn((_room: string) => ({
      fetchSockets: vi.fn(async () => recipients),
    })),
  };
}

describe("TeamChatGateway characterization suite", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_PRINCIPAL", "true");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("handles message happy path, broadcasts entry, and returns ack", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const peer = makeSocket("peer-1");
    gateway.server = makeServer([peer]) as never;

    const sender = makeSocket("sender-1");
    const ack = await gateway.onMessage(sender, { text: "Hello team", clientMessageId: "cmsg-1" });

    expect(ack).toEqual({ ok: true, id: expect.any(String) });
    expect(peer.emit).toHaveBeenCalledWith(
      "message",
      expect.objectContaining({
        text: "Hello team",
        senderUserId: "u1",
        sideId: "left",
        type: "text",
      }),
    );
    expect(gateway.getRecentHistory("arena:m1:team:left")).toHaveLength(1);
    expect(game.assertServing).toHaveBeenCalled();
  });

  it("handles ping happy path, broadcasts ping entry, and returns ack", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const peer = makeSocket("peer-1");
    gateway.server = makeServer([peer]) as never;

    const sender = makeSocket("sender-1");
    const ack = await gateway.onPing(sender, { ping: "READY" });

    expect(ack).toEqual({ ok: true, id: expect.any(String) });
    expect(peer.emit).toHaveBeenCalledWith(
      "ping",
      expect.objectContaining({
        ping: "READY",
        senderUserId: "u1",
        sideId: "left",
        type: "ping",
      }),
    );
  });

  it("deduplicates retries with same clientMessageId without duplicate broadcast or history", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const peer = makeSocket("peer-1");
    gateway.server = makeServer([peer]) as never;

    const sender = makeSocket("sender-1");
    const msg = { text: "Duplicate test", clientMessageId: "dedup-msg-1" };

    const first = await gateway.onMessage(sender, msg);
    const retry = await gateway.onMessage(sender, msg);

    expect(first).toEqual({ ok: true, id: expect.any(String) });
    expect(retry).toEqual(first);
    expect(peer.emit).toHaveBeenCalledTimes(1);
    expect(gateway.getRecentHistory("arena:m1:team:left")).toHaveLength(1);
  });

  it("ignores identity and sideId in client payload", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const peer = makeSocket("peer-1");
    gateway.server = makeServer([peer]) as never;

    const sender = makeSocket("sender-1");
    const forgedBody = {
      text: "Forged message",
      senderUserId: "mallory",
      sideId: "right",
      roomId: "arena:m1:team:right",
    };

    const ack = await gateway.onMessage(sender, forgedBody as never);
    expect(ack).toEqual({ ok: true, id: expect.any(String) });
    expect(peer.emit).toHaveBeenCalledWith(
      "message",
      expect.objectContaining({
        text: "Forged message",
        senderUserId: "u1",
        sideId: "left",
      }),
    );
  });

  it("returns unauthorized when socket authorization fails and runtime is ready", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
    const game = makeGame();
    const verifier = { verify: vi.fn(async () => null) } as unknown as AuthPrincipalClient;
    const gateway = new TeamChatGateway(game, undefined, verifier);

    const senderMsg = makeSocket("sender-msg");
    senderMsg.data = {}; // no principal
    const ack = await gateway.onMessage(senderMsg, { text: "Should fail" });
    expect(ack).toEqual({ ok: false, error: "unauthorized" });

    const senderPing = makeSocket("sender-ping");
    senderPing.data = {}; // no principal
    const pingAck = await gateway.onPing(senderPing, { ping: "READY" });
    expect(pingAck).toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns unauthorized when socket principal lacks matchId", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);

    const sender = makeSocket("sender-no-match");
    sender.data.arenaPrincipal = {
      userId: "u1",
      expiresAt: Date.now() + 60000,
    };
    const ack = await gateway.onMessage(sender, { text: "No match ID" });
    expect(ack).toEqual({ ok: false, error: "unauthorized" });

    const pingSender = makeSocket("sender-ping-no-match");
    pingSender.data.arenaPrincipal = {
      userId: "u1",
      expiresAt: Date.now() + 60000,
    };
    const pingAck = await gateway.onPing(pingSender, { ping: "READY" });
    expect(pingAck).toEqual({ ok: false, error: "unauthorized" });
  });

  it("suppresses unauthorized error (returns undefined) when runtime is not ready", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
    const game = makeGame(false); // runtimeReady: false
    const verifier = { verify: vi.fn(async () => null) } as unknown as AuthPrincipalClient;
    const gateway = new TeamChatGateway(game, undefined, verifier);

    const sender = makeSocket("sender-1");
    sender.data = {};

    const ack = await gateway.onMessage(sender, { text: "Should be undefined" });
    expect(ack).toBeUndefined();
    expect(game.assertServing).not.toHaveBeenCalled();

    const senderPing = makeSocket("sender-ping");
    senderPing.data = {};
    const pingAck = await gateway.onPing(senderPing, { ping: "READY" });
    expect(pingAck).toBeUndefined();
    expect(game.assertServing).not.toHaveBeenCalled();
  });

  it("returns unauthorized when sideId or roomId is missing from client.data", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const sender = makeSocket("sender-1");

    // Missing sideId
    delete (sender.data as Record<string, unknown>).sideId;
    expect(await gateway.onMessage(sender, { text: "No side" })).toEqual({ ok: false, error: "unauthorized" });
    expect(await gateway.onPing(sender, { ping: "READY" })).toEqual({ ok: false, error: "unauthorized" });

    // Missing roomId
    sender.data.sideId = "left";
    delete (sender.data as Record<string, unknown>).roomId;
    expect(await gateway.onMessage(sender, { text: "No room" })).toEqual({ ok: false, error: "unauthorized" });
    expect(await gateway.onPing(sender, { ping: "READY" })).toEqual({ ok: false, error: "unauthorized" });
  });

  it("disconnects and returns undefined when client is already disconnected without calling assertServing", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const sender = makeSocket("sender-1");
    sender.connected = false;

    const ack = await gateway.onMessage(sender, { text: "Disconnected" });
    expect(ack).toBeUndefined();
    expect(sender.disconnect).toHaveBeenCalledWith(true);
    expect(game.assertServing).not.toHaveBeenCalled();

    sender.disconnect.mockClear();
    const pingAck = await gateway.onPing(sender, { ping: "READY" });
    expect(pingAck).toBeUndefined();
    expect(sender.disconnect).toHaveBeenCalledWith(true);
    expect(game.assertServing).not.toHaveBeenCalled();
  });

  it("disconnects and returns undefined on exact expiry equality (expiresAt === Date.now())", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const sender = makeSocket("sender-1");

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    (sender.data as Record<string, unknown>).arenaPrincipal = { expiresAt: now };

    const ack = await gateway.onMessage(sender, { text: "Exact expiry" });
    expect(ack).toBeUndefined();
    expect(sender.disconnect).toHaveBeenCalledWith(true);
    expect(game.assertServing).not.toHaveBeenCalled();

    sender.disconnect.mockClear();
    const pingAck = await gateway.onPing(sender, { ping: "READY" });
    expect(pingAck).toBeUndefined();
    expect(sender.disconnect).toHaveBeenCalledWith(true);
    expect(game.assertServing).not.toHaveBeenCalled();
  });

  it("disconnects and returns undefined when raw arenaPrincipal is malformed but has expired timestamp", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const sender = makeSocket("sender-1");

    // Missing userId, malformed shape, but expiresAt is an expired number
    (sender.data as Record<string, unknown>).arenaPrincipal = { expiresAt: 1000 };

    const ack = await gateway.onMessage(sender, { text: "Malformed expired" });
    expect(ack).toBeUndefined();
    expect(sender.disconnect).toHaveBeenCalledWith(true);

    sender.disconnect.mockClear();
    const pingAck = await gateway.onPing(sender, { ping: "READY" });
    expect(pingAck).toBeUndefined();
    expect(sender.disconnect).toHaveBeenCalledWith(true);
  });

  it.each([
    {
      caseName: "onMessage(null)",
      method: "onMessage" as const,
      payload: null,
      expectedError: "invalid message payload",
    },
    {
      caseName: "onMessage(undefined)",
      method: "onMessage" as const,
      payload: undefined,
      expectedError: "invalid message payload",
    },
    {
      caseName: "onPing(null)",
      method: "onPing" as const,
      payload: null,
      expectedError: "invalid ping type",
    },
    {
      caseName: "onPing(undefined)",
      method: "onPing" as const,
      payload: undefined,
      expectedError: "invalid ping type",
    },
  ])(
    "$caseName rejects safely without broadcasting or recording history",
    async ({ method, payload, expectedError }) => {
      const game = makeGame();
      const gateway = new TeamChatGateway(game);
      const peer = makeSocket("peer-1");
      gateway.server = makeServer([peer]) as never;
      const sender = makeSocket("sender-malformed");

      const ack =
        method === "onMessage"
          ? await gateway.onMessage(sender, payload as never)
          : await gateway.onPing(sender, payload as never);

      expect(ack).toEqual({ ok: false, error: expectedError });
      expect(peer.emit).not.toHaveBeenCalled();
      expect(gateway.getRecentHistory("arena:m1:team:left")).toHaveLength(0);
    },
  );

  it("handles acceptMessage/acceptPing failure with Error or non-Error fallback", async () => {
    const game = makeGame();
    const chat = new TeamChat({ resolveContext: async () => ({ sideId: "left", roomId: "r1", active: true }) });
    const gateway = new TeamChatGateway(game, chat);
    const sender = makeSocket("sender-1");

    // Error instance failure
    vi.spyOn(chat, "acceptMessage").mockRejectedValueOnce(new Error("custom message error"));
    expect(await gateway.onMessage(sender, { text: "boom" })).toEqual({ ok: false, error: "custom message error" });

    // Non-Error fallback
    vi.spyOn(chat, "acceptMessage").mockRejectedValueOnce("string exception");
    expect(await gateway.onMessage(sender, { text: "boom" })).toEqual({ ok: false, error: "message failed" });

    // Ping Error instance failure
    vi.spyOn(chat, "acceptPing").mockRejectedValueOnce(new Error("custom ping error"));
    expect(await gateway.onPing(sender, { ping: "BAD" })).toEqual({ ok: false, error: "custom ping error" });

    // Ping non-Error fallback
    vi.spyOn(chat, "acceptPing").mockRejectedValueOnce("string ping exception");
    expect(await gateway.onPing(sender, { ping: "BAD" })).toEqual({ ok: false, error: "ping failed" });
  });

  it("suppresses error response when runtime is unavailable during catch block", async () => {
    const game = makeGame();
    const chat = new TeamChat({ resolveContext: async () => ({ sideId: "left", roomId: "r1", active: true }) });
    const gateway = new TeamChatGateway(game, chat);
    const sender = makeSocket("sender-1");

    // If canEmitTo is false in catch block
    vi.spyOn(chat, "acceptMessage").mockImplementationOnce(async () => {
      game.runtimeReady = false;
      throw new Error("failed after stop");
    });
    expect(await gateway.onMessage(sender, { text: "msg" })).toBeUndefined();

    // If assertServing throws in catch block
    game.runtimeReady = true;
    vi.spyOn(chat, "acceptPing").mockImplementationOnce(async () => {
      game.assertServing = vi.fn(() => {
        throw new Error("assertServing failed in catch");
      });
      throw new Error("error triggering catch");
    });
    expect(await gateway.onPing(sender, { ping: "READY" })).toBeUndefined();
  });

  it("pins accepted-entry broadcast with suppressed sender ack when sender expires during fetchSockets", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const peer = makeSocket("peer-1");
    const sender = makeSocket("sender-1");

    // During fetchSockets, sender expires before final ack check
    gateway.server = {
      in: vi.fn(() => ({
        fetchSockets: async () => {
          // Sender expires right during broadcast fetchSockets
          (sender.data as Record<string, unknown>).arenaPrincipal = { expiresAt: Date.now() - 1000 };
          return [peer];
        },
      })),
    } as never;

    const ack = await gateway.onMessage(sender, { text: "Broadcast survives, ack suppressed", clientMessageId: "exp-1" });

    // Peer must still receive the broadcast!
    expect(peer.emit).toHaveBeenCalledWith("message", expect.objectContaining({ text: "Broadcast survives, ack suppressed" }));
    // But sender's final ack is suppressed (undefined) because sender expired!
    expect(ack).toBeUndefined();
  });

  it("handleConnection admits valid connection and sends authorized + history", async () => {
    const game = makeGame();
    const chat = new TeamChat({ resolveContext: async () => ({ sideId: "left", roomId: "arena:m1:team:left", active: true }) });
    // Pre-populate one history entry
    await chat.acceptMessage({
      connectionId: "c0",
      userId: "u0",
      matchId: "m1",
      sideId: "left",
      roomId: "arena:m1:team:left",
      text: "Initial history message",
    });

    const gateway = new TeamChatGateway(game, chat);
    const client = makeSocket("new-client");

    await gateway.handleConnection(client);

    expect(client.rooms.has("arena:m1:team:left")).toBe(true);
    expect(client.emit).toHaveBeenCalledWith(
      "authorized",
      expect.objectContaining({ sideId: "left", roomId: "arena:m1:team:left" }),
    );
    expect(client.emit).toHaveBeenCalledWith(
      "history",
      expect.arrayContaining([expect.objectContaining({ text: "Initial history message" })]),
    );
    expect(client.connected).toBe(true);
  });

  it("handleConnection does not emit history when recent history is empty", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const client = makeSocket("empty-history-client");

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith(
      "authorized",
      expect.objectContaining({ sideId: "left", roomId: "arena:m1:team:left" }),
    );
    expect(client.emit).not.toHaveBeenCalledWith("history", expect.anything());
  });

  it("handleConnection disconnects when handshake lacks matchId", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);
    const client = makeSocket("no-handshake-match");
    delete (client.handshake.auth as Record<string, unknown>).matchId;

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(game.resolveTeamChatContext).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalled();
  });

  it("handleConnection disconnects best-effort if canEmitTo is false at any admission check", async () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);

    // Fail after authenticateHandshake
    const c1 = makeSocket("c1");
    game.runtimeReady = false;
    await gateway.handleConnection(c1);
    expect(c1.disconnect).toHaveBeenCalledWith(true);
    expect(game.resolveTeamChatContext).not.toHaveBeenCalled();
    expect(c1.join).not.toHaveBeenCalled();
    expect(c1.emit).not.toHaveBeenCalled();

    // Fail after resolveTeamChatContext
    game.runtimeReady = true;
    const c2 = makeSocket("c2");
    vi.spyOn(game, "resolveTeamChatContext").mockImplementationOnce(async () => {
      game.runtimeReady = false;
      return { sideId: "left", roomId: "r2", active: true };
    });
    await gateway.handleConnection(c2);
    expect(c2.disconnect).toHaveBeenCalledWith(true);
    expect(c2.join).not.toHaveBeenCalled();
    expect(c2.emit).not.toHaveBeenCalled();

    // Fail after join
    game.runtimeReady = true;
    const c3 = makeSocket("c3");
    c3.join = vi.fn(async (_room: string) => {
      game.runtimeReady = false;
    });
    await gateway.handleConnection(c3);
    expect(c3.disconnect).toHaveBeenCalledWith(true);
    expect(c3.emit).not.toHaveBeenCalled();

    // Fail when assertServing throws during connection
    game.runtimeReady = true;
    const c4 = makeSocket("c4");
    game.assertServing = vi.fn(() => {
      throw new Error("assertServing not available");
    });
    await gateway.handleConnection(c4);
    expect(c4.disconnect).toHaveBeenCalledWith(true);
  });

  it("handleDisconnect clears socket expiry and releases chat connection", async () => {
    const game = makeGame();
    const chat = new TeamChat({ resolveContext: async () => ({ sideId: "left", roomId: "r1", active: true }) });
    const releaseSpy = vi.spyOn(chat, "releaseConnection");
    const gateway = new TeamChatGateway(game, chat);
    const client = makeSocket("client-disc");

    await gateway.handleDisconnect(client);

    expect(releaseSpy).toHaveBeenCalledWith("client-disc");
  });

  it("getRecentHistory asserts serving before fetching", () => {
    const game = makeGame();
    const gateway = new TeamChatGateway(game);

    gateway.getRecentHistory("any-room");
    expect(game.assertServing).toHaveBeenCalledTimes(1);

    game.assertServing = vi.fn(() => {
      throw new Error("service unavailable");
    });
    expect(() => gateway.getRecentHistory("any-room")).toThrow("service unavailable");
  });
});
