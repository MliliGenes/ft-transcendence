import { ServiceUnavailableException, type CallHandler, type ExecutionContext } from "@nestjs/common";
import { afterEach, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { GameService } from "./game.service.js";
import { CollabGateway } from "./collab.gateway.js";

const games: GameService[] = [];
afterEach(async () => {
  await Promise.all(games.splice(0).map((game) => game.stop()));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function teamGame() {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("DEV_PRINCIPAL", "true");
  vi.stubEnv("JUDGE_BACKEND", "container");
  const game = new GameService();
  games.push(game);
  await game.onModuleInit();
  const { matchId } = await game.createMatch({
    mode: "2v2",
    participants: [
      { userId: "gate-a", sideId: "left" },
      { userId: "gate-mate", sideId: "left" },
      { userId: "gate-b", sideId: "right" },
      { userId: "gate-other", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger"],
  });
  await game.startRound("gate-a", matchId);
  await game.beginCoding("gate-a", matchId);
  return { game, matchId };
}

function testSocket(matchId: string) {
  const rooms: string[] = [];
  const events: Array<{ event: string; body: unknown }> = [];
  const client = {
    id: "gate-socket", connected: true, data: {},
    handshake: { auth: { userId: "gate-a", matchId }, query: {} },
    join: async (room: string) => { rooms.push(room); },
    leave: async () => {},
    emit: (event: string, body: unknown) => { events.push({ event, body }); },
    disconnect: () => { client.connected = false; },
    to: (_room: string) => ({
      emit: (event: string, body: unknown) => { events.push({ event, body }); },
    }),
  };
  return { client, socket: client as unknown as Socket, rooms, events };
}

it("discards a valid collab baseline when the runtime stops during admission", async () => {
  const { game, matchId } = await teamGame();
  const originalSync = game.collabSync.bind(game);
  let reached!: () => void;
  let release!: () => void;
  const atRead = new Promise<void>((resolve) => { reached = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(game, "collabSync").mockImplementationOnce(async (...args) => {
    const saved = await originalSync(...args);
    reached();
    await gate;
    return saved;
  });
  const gateway = new CollabGateway(game);
  const client = testSocket(matchId);
  const opening = gateway.handleConnection(client.socket);
  await atRead;
  await game.stop();
  release();
  await opening;
  expect(client.rooms).toEqual([]);
  expect(client.events).toEqual([]);
  expect(client.client.connected).toBe(false);
});

it("does not relay a cursor or peer-left after the runtime stops", async () => {
  const { game, matchId } = await teamGame();
  const gateway = new CollabGateway(game);
  const client = testSocket(matchId);
  await gateway.handleConnection(client.socket);
  client.events.length = 0;
  gateway.server = { to: () => ({
    emit: (event: string, body: unknown) => { client.events.push({ event, body }); },
  }) } as unknown as CollabGateway["server"];
  await game.stop();
  gateway.onCursor(client.socket, { clientId: 7, anchor: 0, head: 1 });
  await gateway.handleDisconnect(client.socket);
  expect(client.events).toEqual([]);
});

import { GameGateway } from "./game.gateway.js";
import { LobbyGateway } from "./lobby.gateway.js";
import { TeamChatGateway } from "./team-chat.gateway.js";
import { TeamChat } from "arena-game-engine/team-chat";

it("discards a delayed Game baseline after socket admission", async () => {
  const { game, matchId } = await teamGame();
  const read = game.snapshot.bind(game);
  let entered!: () => void; let release!: () => void;
  const reached = new Promise<void>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  let reads = 0;
  vi.spyOn(game, "snapshot").mockImplementation(async (...args) => {
    const value = await read(...args);
    if (++reads === 2) { entered(); await held; }
    return value;
  });
  const client = testSocket(matchId);
  const connection = new GameGateway(game).handleConnection(client.socket);
  await reached; await game.stop(); release(); await connection;
  expect(client.rooms).toEqual([`match:${matchId}`]); expect(client.events).toEqual([]);
  expect(client.client.connected).toBe(false);
});

it("discards delayed chat authorization before room and history output", async () => {
  const { game, matchId } = await teamGame();
  const read = game.resolveTeamChatContext.bind(game);
  let entered!: () => void; let release!: () => void;
  const reached = new Promise<void>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(game, "resolveTeamChatContext").mockImplementationOnce(async (...args) => {
    const value = await read(...args); entered(); await held; return value;
  });
  const client = testSocket(matchId);
  const connection = new TeamChatGateway(game).handleConnection(client.socket);
  await reached; await game.stop(); release(); await connection;
  expect(client.rooms).toEqual([]); expect(client.events).toEqual([]);
  expect(client.client.connected).toBe(false);
});

it("does not join a Lobby room after delayed authorization and stop", async () => {
  const { game, matchId } = await teamGame();
  const room = await game.createPrivateRoom("lobby-host", "1v1");
  const client = testSocket(matchId); client.client.handshake.auth.userId = "lobby-host";
  const gateway = new LobbyGateway(game);
  await gateway.handleConnection(client.socket); client.rooms.length = 0;
  const read = game.roomForMember.bind(game);
  let entered!: () => void; let release!: () => void;
  const reached = new Promise<void>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(game, "roomForMember").mockImplementationOnce(async (...args) => {
    const value = await read(...args); entered(); await held; return value;
  });
  const join = gateway.onJoinRoom(client.socket, { roomId: room.room.id });
  await reached; await game.stop(); release();
  expect((await join).ok).toBe(false);
  expect(client.rooms).toEqual([]); expect(client.events).toEqual([]);
});

it("does not broadcast a chat acceptance after stop", async () => {
  const { game, matchId } = await teamGame();
  const chat = new TeamChat({ resolveContext: (userId, id) => game.resolveTeamChatContext(userId, id) });
  const gateway = new TeamChatGateway(game, chat); const client = testSocket(matchId);
  await gateway.handleConnection(client.socket); client.events.length = 0;
  gateway.server = { to: () => ({ emit: (event: string, body: unknown) => {
    client.events.push({ event, body });
  } }) } as unknown as TeamChatGateway["server"];
  const accept = chat.acceptMessage.bind(chat);
  let entered!: () => void; let release!: () => void;
  const reached = new Promise<void>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(chat, "acceptMessage").mockImplementationOnce(async (...args) => {
    const value = await accept(...args); entered(); await held; return value;
  });
  const message = gateway.onMessage(client.socket, { text: "held output", clientMessageId: "runtime-held" });
  const rejected = expect(message).rejects.toBeInstanceOf(ServiceUnavailableException);
  await reached; await game.stop(); release(); await rejected;
  expect(client.events).toEqual([]);
});


import { defer, lastValueFrom, of } from "rxjs";
import { GameRuntimeInterceptor } from "./runtime-availability.interceptor.js";

const contextFor = (kind: "http" | "ws") => ({ getType: () => kind }) as unknown as ExecutionContext;

it("rejects a delayed HTTP result after stop", async () => {
  const { game } = await teamGame();
  let release!: (value: unknown) => void;
  const held = new Promise<unknown>((resolve) => { release = resolve; });
  const next: CallHandler = { handle: () => defer(() => held) };
  const result = lastValueFrom(new GameRuntimeInterceptor(game).intercept(contextFor("http"), next));
  const failure = expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
  await game.stop();
  release({ source: "cached result" });
  await failure;
});

it("does not call a socket handler after stop", async () => {
  const { game } = await teamGame();
  await game.stop();
  let calls = 0;
  const next: CallHandler = { handle: () => { calls += 1; return of({ ok: true }); } };
  const result = await lastValueFrom(
    new GameRuntimeInterceptor(game).intercept(contextFor("ws"), next),
    { defaultValue: "no acknowledgement" },
  );
  expect(result).toBe("no acknowledgement");
  expect(calls).toBe(0);
});

it("discards a delayed socket error after stop", async () => {
  const { game } = await teamGame();
  let fail!: (error: Error) => void;
  const held = new Promise<unknown>((_resolve, reject) => { fail = reject; });
  const next: CallHandler = { handle: () => defer(() => held) };
  const result = lastValueFrom(new GameRuntimeInterceptor(game).intercept(contextFor("ws"), next),
    { defaultValue: "no acknowledgement" });
  await game.stop(); fail(new Error("late domain failure"));
  expect(await result).toBe("no acknowledgement");
});

it("keeps an accepted command when stop suppresses its delayed HTTP reply", async () => {
  const { game, matchId } = await teamGame();
  const engine = game.inner; const principal = game.principalFor("gate-a");
  let committed!: () => void; let release!: () => void;
  const atCommit = new Promise<void>((resolve) => { committed = resolve; });
  const reply = new Promise<void>((resolve) => { release = resolve; });
  const before = await engine.snapshot(principal, matchId);
  const next: CallHandler = { handle: () => defer(async () => {
    const result = await game.leave("gate-a", matchId);
    committed(); await reply; return result;
  }) };
  const result = lastValueFrom(new GameRuntimeInterceptor(game).intercept(contextFor("http"), next));
  const rejected = expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
  await atCommit; await game.stop(); release(); await rejected;
  const saved = await engine.snapshot(principal, matchId);
  expect(saved.roundPhase).toBe("MATCH_COMPLETE");
  expect(saved.revision).toBeGreaterThan(before.revision);
  expect(saved.final?.forfeit).not.toBeNull();
});
