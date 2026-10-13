import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { UnauthorizedError } from "../auth/auth-principal-client.js";
import { GameGateway } from "./game.gateway.js";
import { LobbyGateway } from "./lobby.gateway.js";
import { TeamChatGateway } from "./team-chat.gateway.js";
import { CollabGateway } from "./collab.gateway.js";
import type { GameService } from "./game.service.js";
import { TeamChat } from "arena-game-engine/team-chat";

const ALICE = "alice";
const VICTIM = "victim";
const MATCH = "match-1";
const FUTURE = () => Date.now() + 60_000;

type FakeClient = {
  id: string;
  connected: boolean;
  data: Record<string, unknown>;
  handshake: { auth: Record<string, unknown>; query: Record<string, unknown>; headers?: Record<string, string> };
  rooms: string[];
  events: Array<{ event: string; body: unknown }>;
  disconnectCalls: unknown[];
  socket: Socket;
};

function testClient(auth: Record<string, unknown> = {}, query: Record<string, unknown> = {}): FakeClient {
  const c = {
    id: `s-${Math.random().toString(36).slice(2)}`,
    connected: true,
    data: {} as Record<string, unknown>,
    handshake: { auth, query, headers: {} as Record<string, string> },
    rooms: [] as string[],
    events: [] as Array<{ event: string; body: unknown }>,
    disconnectCalls: [] as unknown[],
  } as unknown as FakeClient & { socket?: Socket };
  const raw = c as unknown as Record<string, unknown>;
  raw.join = async (room: string) => { c.rooms.push(room); };
  raw.leave = async () => {};
  raw.emit = (event: string, body: unknown) => { c.events.push({ event, body }); };
  raw.disconnect = (close?: unknown) => { c.connected = false; c.disconnectCalls.push(close); };
  raw.to = (_room: string) => ({ emit: (event: string, body: unknown) => { c.events.push({ event, body }); } });
  c.socket = c as unknown as Socket;
  return c as FakeClient;
}

function verifierFor(map: Record<string, { userId: string; expiresAt: number } | Error>) {
  return {
    verify: async (token: string) => {
      const v = map[token];
      if (v instanceof Error) throw v;
      if (!v) throw new UnauthorizedError();
      return v;
    },
  };
}

function fakeGameBase(over: Record<string, unknown> = {}): GameService {
  return {
    runtimeReady: true,
    assertServing(this: { runtimeReady: boolean }) { if (!this.runtimeReady) throw new Error("unavailable"); },
    onEvent: () => () => {},
    onLobbyEvent: () => () => {},
    snapshot: async () => ({}),
    ...over,
  } as unknown as GameService;
}

afterEach(() => vi.unstubAllEnvs());

describe("socket namespaces: handshake + per-message verification", () => {
  it("namespaces reject missing/forged/expired; per-message re-verify; deleted-between-messages 401", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
    const exp = FUTURE();
    const good = verifierFor({ "valid-token": { userId: ALICE, expiresAt: exp } });
    const forged = verifierFor({});
    const expiredV = verifierFor({ "expired-token": { userId: ALICE, expiresAt: Date.now() - 1000 } });

    // Game: missing/forged/expired refused with zero room/emit.
    for (const [auth, v] of [
      [{ matchId: MATCH }, good],
      [{ accessToken: "forged", matchId: MATCH }, forged],
      [{ accessToken: "expired-token", matchId: MATCH }, expiredV],
    ] as const) {
      const game = fakeGameBase({
        snapshot: async () => ({}),
        noteSocketOpen: async () => {},
        noteSocketClosed: async () => {},
      });
      const gw = new GameGateway(game, v as never);
      const c = testClient({ ...(auth as Record<string, unknown>) });
      await gw.handleConnection(c.socket);
      expect(c.connected).toBe(false);
      expect(c.rooms).toEqual([]);
      expect(c.events).toEqual([]);
    }

    // Game: valid token admitted, stores token privately.
    {
      const game = fakeGameBase({ snapshot: async () => ({ ok: 1 }), noteSocketOpen: async () => {}, noteSocketClosed: async () => {} });
      const gw = new GameGateway(game, good as never);
      const c = testClient({ accessToken: "valid-token", matchId: MATCH });
      await gw.handleConnection(c.socket);
      expect(c.connected).toBe(true);
      expect(c.rooms).toEqual([`match:${MATCH}`]);
      expect(c.data.accessToken).toBe("valid-token");
      expect(c.data.arenaPrincipal).toEqual({ userId: ALICE, expiresAt: exp, matchId: MATCH });

      // Per-message re-verify: deleted-between-messages disconnects before engine.
      let engineCalls = 0;
      (game as unknown as Record<string, unknown>).run = async () => { engineCalls += 1; return {}; };
      const gone = verifierFor({});
      const gw2 = new GameGateway(game, gone as never);
      // Reuse the same attached socket (token deleted upstream).
      const res = await gw2.onRun(c.socket, { code: "1", language: "python" });
      expect(c.connected).toBe(false);
      expect(engineCalls).toBe(0);
      expect(res).toEqual({ ok: false, error: expect.any(String) });
    }

    // Lobby: valid token admitted; forged refused.
    {
      const game = fakeGameBase();
      const gw = new LobbyGateway(game, good as never);
      const c = testClient({ accessToken: "valid-token" });
      await gw.handleConnection(c.socket);
      expect(c.connected).toBe(true);
      const bad = new LobbyGateway(game, forged as never);
      const c2 = testClient({ accessToken: "forged" });
      await bad.handleConnection(c2.socket);
      expect(c2.connected).toBe(false);
    }

    // Chat + collab: forged refused with zero bytes.
    {
      const game = fakeGameBase({ resolveTeamChatContext: async () => ({ sideId: "left", roomId: "r" }), collabSync: async () => ({ roomId: "r", roundId: "rd" }) });
      const chat = new TeamChatGateway(game, new TeamChat({ resolveContext: async () => ({ sideId: "left", roomId: "r", active: true }) as never }), forged as never);
      const c = testClient({ accessToken: "forged", matchId: MATCH });
      await chat.handleConnection(c.socket);
      expect(c.connected).toBe(false);
      expect(c.events).toEqual([]);
      const collab = new CollabGateway(game, forged as never);
      const c2 = testClient({ accessToken: "forged", matchId: MATCH });
      await collab.handleConnection(c2.socket);
      expect(c2.connected).toBe(false);
      expect(c2.events).toEqual([]);
    }
  });

  it("expired RPC result suppressed (no success/error ack); expiry before every output category stops emission", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
    const exp = FUTURE();
    const good = verifierFor({ "valid-token": { userId: ALICE, expiresAt: exp } });

    // Expired stored token suppresses success ack and emits nothing.
    {
      let engineCalls = 0;
      const game = fakeGameBase({
        snapshot: async () => ({}),
        noteSocketOpen: async () => {},
        noteSocketClosed: async () => {},
        run: async () => { engineCalls += 1; return { ran: true }; },
      });
      const gw = new GameGateway(game, good as never);
      const c = testClient({ accessToken: "valid-token", matchId: MATCH });
      await gw.handleConnection(c.socket);
      expect(c.connected).toBe(true);
      c.events.length = 0;
      // Expire between messages.
      (c.data.arenaPrincipal as Record<string, unknown>).expiresAt = Date.now() - 1000;
      const ack = await gw.onRun(c.socket, { code: "1", language: "python" });
      expect(ack).toBeUndefined();
      expect(engineCalls).toBe(0);
      expect(c.events).toEqual([]);
      expect(c.disconnectCalls).toEqual([true]);
    }

    // Late error also suppressed (no {ok:false}).
    {
      const game = fakeGameBase({
        snapshot: async () => ({}),
        noteSocketOpen: async () => {},
        noteSocketClosed: async () => {},
        run: async () => { throw new Error("late engine boom"); },
      });
      const gw = new GameGateway(game, good as never);
      const c = testClient({ accessToken: "valid-token", matchId: MATCH });
      await gw.handleConnection(c.socket);
      (c.data.arenaPrincipal as Record<string, unknown>).expiresAt = Date.now() - 1000;
      const ack = await gw.onRun(c.socket, { code: "1", language: "python" });
      expect(ack).toBeUndefined();
    }

    // Expiry before every output category stops emission.
    {
      const { canEmitTo, broadcastGated } = await import("./socket-auth.js");
      const live = testClient();
      live.data.arenaPrincipal = { userId: ALICE, expiresAt: FUTURE() };
      const dead = testClient();
      dead.data.arenaPrincipal = { userId: ALICE, expiresAt: Date.now() - 1000 };
      expect(canEmitTo(live.socket, true)).toBe(true);
      expect(canEmitTo(dead.socket, true)).toBe(false);
      // Gated broadcast delivers only to live recipients (game events, lobby
      // hints, chat/pings, collab updates/cursors/peer-left share this gate).
      const delivered: unknown[] = [];
      const server = {
        in: (room: string) => ({
          fetchSockets: async () => [
            { id: "live", data: live.data, connected: true, emit: (e: string, p: unknown) => { delivered.push([room, e, p]); } },
            { id: "dead", data: dead.data, connected: true, emit: () => { throw new Error("expired socket emitted"); } },
          ],
        }),
      };
      await broadcastGated(server, ["room-1"], "message", { text: "hi" }, true);
      expect(delivered).toEqual([["room-1", "message", { text: "hi" }]]);
      // Runtime loss also stops emission.
      delivered.length = 0;
      await broadcastGated(server, ["room-1"], "message", { text: "hi" }, false);
      expect(delivered).toEqual([]);
    }

    // Snapshot/sync/history gated on expiry.
    {
      const game = fakeGameBase({
        snapshot: async () => ({ snap: true }),
        noteSocketOpen: async () => {},
        noteSocketClosed: async () => {},
      });
      const expiredV = verifierFor({ "valid-token": { userId: ALICE, expiresAt: Date.now() - 1000 } });
      const gwExp = new GameGateway(game, expiredV as never);
      const c = testClient({ accessToken: "valid-token", matchId: MATCH });
      await gwExp.handleConnection(c.socket);
      expect(c.events).toEqual([]);
      expect(c.connected).toBe(false);
    }
  });

  it("token replacement via payload/auth event rejected; fixture auth.userId/query fails DEV-disabled", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
    const exp = FUTURE();
    const good = verifierFor({ "valid-token": { userId: ALICE, expiresAt: exp } });
    let actedAs = "";
    const game = fakeGameBase({
      snapshot: async () => ({}),
      noteSocketOpen: async () => {},
      noteSocketClosed: async () => {},
      run: async (userId: string) => { actedAs = userId; return {}; },
    });
    const gw = new GameGateway(game, good as never);
    const c = testClient({ accessToken: "valid-token", matchId: MATCH });
    await gw.handleConnection(c.socket);
    expect(c.connected).toBe(true);
    // Forged payload identity ignored; stored token untouched.
    const ack = await gw.onRun(c.socket, { code: "1", language: "python", userId: VICTIM, accessToken: "forged" } as never);
    expect(ackedOk(ack)).toBe(true);
    expect(actedAs).toBe(ALICE);
    expect(c.data.accessToken).toBe("valid-token");
    expect(c.data.arenaPrincipal).toMatchObject({ userId: ALICE, matchId: MATCH });

    // Fixture handshake without a token fails closed with DEV disabled.
    const lobbyGame = fakeGameBase();
    for (const auth of [{ userId: ALICE }, { userId: ALICE, matchId: MATCH }] as const) {
      const lgw = new LobbyGateway(lobbyGame, good as never);
      const fc = testClient({ ...(auth as Record<string, unknown>) });
      await lgw.handleConnection(fc.socket);
      expect(fc.connected).toBe(false);
    }
    const q = testClient({}, { userId: ALICE });
    await new LobbyGateway(lobbyGame, good as never).handleConnection(q.socket);
    expect(q.connected).toBe(false);
  });

  it("delayed verify after close/runtime loss cleans presence; accepted submit still completes, never failed evaluation", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
    const exp = FUTURE();
    // Delayed verify after close: presence cleanup runs, no baseline emitted.
    {
      let opened = 0;
      let closed = 0;
      const game = fakeGameBase({
        snapshot: async () => ({}),
        noteSocketOpen: async () => { opened += 1; },
        noteSocketClosed: async () => { closed += 1; },
      });
      let release!: () => void;
      const gate = new Promise<void>((r) => { release = r; });
      let entered!: () => void;
      const reached = new Promise<void>((r) => { entered = r; });
      const hanging = { verify: async () => { entered(); await gate; return { userId: ALICE, expiresAt: exp }; } };
      const gw = new GameGateway(game, hanging as never);
      const c = testClient({ accessToken: "valid-token", matchId: MATCH });
      const opening = gw.handleConnection(c.socket);
      await reached;
      (c.socket as unknown as { connected: boolean }).connected = false;
      await gw.handleDisconnect(c.socket);
      release();
      await opening;
      // Presence never opened for a closed socket (no leak); disconnect-time
      // cleanup still runs once the principal exists.
      expect(opened).toBe(0);
      await gw.handleDisconnect(c.socket);
      expect(closed).toBe(1);
      expect(c.events).toEqual([]);
      expect(c.rooms).toEqual([]);
    }
    // Accepted submit still completes; late ack suppressed, never failed.
    {
      let committed = false;
      let release!: () => void;
      const gate = new Promise<void>((r) => { release = r; });
      let entered!: () => void;
      const reached = new Promise<void>((r) => { entered = r; });
      const game = fakeGameBase({
        snapshot: async () => ({}),
        noteSocketOpen: async () => {},
        noteSocketClosed: async () => {},
        submit: async () => { committed = true; entered(); await gate; return { evaluationId: "e1" }; },
      });
      const good = verifierFor({ "valid-token": { userId: ALICE, expiresAt: exp } });
      const gw = new GameGateway(game, good as never);
      const c = testClient({ accessToken: "valid-token", matchId: MATCH });
      await gw.handleConnection(c.socket);
      const submitting = gw.onSubmit(c.socket, { code: "1", language: "python" });
      await reached;
      // Expire while the engine works.
      (c.data.arenaPrincipal as Record<string, unknown>).expiresAt = Date.now() - 1000;
      release();
      const ack = await submitting;
      expect(committed).toBe(true);
      expect(ack).toBeUndefined();
    }
  });
});

function ackedOk(ack: unknown): unknown {
  return (ack as { ok?: unknown } | undefined)?.ok;
}

describe("task 5 fix round: admission gate disconnect + provider wiring", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("game admission disconnects when the session expires during the membership check", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "false");
    const exp = FUTURE();
    const good = verifierFor({ "valid-token": { userId: ALICE, expiresAt: exp } });
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let entered!: () => void;
    const reached = new Promise<void>((r) => { entered = r; });
    const game = fakeGameBase({
      snapshot: async () => { entered(); await gate; return {}; },
      noteSocketOpen: async () => { throw new Error("presence must not open for an expired socket"); },
      noteSocketClosed: async () => {},
    });
    const gw = new GameGateway(game, good as never);
    const c = testClient({ accessToken: "valid-token", matchId: MATCH });
    const opening = gw.handleConnection(c.socket);
    await reached;
    (c.data.arenaPrincipal as Record<string, unknown>).expiresAt = Date.now() - 1000;
    release();
    await opening;
    expect(c.connected).toBe(false);
    expect(c.disconnectCalls).toEqual([true]);
    expect(c.rooms).toEqual([]);
    expect(c.events).toEqual([]);
  });

  it("team-chat gateway needs no TeamChat provider (optional default)", async () => {
    const { MODULE_METADATA } = await import("@nestjs/common/constants.js");
    const { GameModule } = await import("./game.module.js");
    const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, GameModule) ?? []) as unknown[];
    expect(providers.length).toBeGreaterThan(0);
    expect(providers).not.toContain(TeamChat);
    // Direct construction without a chat instance still serves history.
    vi.stubEnv("DEV_PRINCIPAL", "true");
    const gw = new TeamChatGateway(fakeGameBase());
    expect(gw.getRecentHistory("no-room")).toEqual([]);
  });
});
