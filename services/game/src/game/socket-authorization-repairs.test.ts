import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { AuthPrincipalClient, VerificationUnavailableError } from "../auth/auth-principal-client.js";
import { PrincipalMiddleware } from "./principal.js";
import { authenticateHandshake, attachSocketPrincipal, broadcastGated, relayGated } from "./socket-auth.js";
import { GameGateway } from "./game.gateway.js";
import { LobbyGateway } from "./lobby.gateway.js";
import { TeamChatGateway } from "./team-chat.gateway.js";
import { CollabGateway } from "./collab.gateway.js";
import type { GameService } from "./game.service.js";

function socket(id = "sender") {
  const events = new EventEmitter();
  const client = {
    id, connected: true, data: {}, handshake: { auth: { accessToken: "token", matchId: "match" }, query: {} },
    once: events.once.bind(events), off: events.off.bind(events),
    disconnect: vi.fn(() => { if (client.connected) { client.connected = false; events.emit("disconnect"); } }),
    join: vi.fn(async () => {}), leave: vi.fn(async () => {}), emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })),
  };
  return client as unknown as Socket & typeof client;
}
function game() {
  return {
    runtimeReady: true, assertServing() {}, onEvent: () => () => {}, onLobbyEvent: () => () => {},
    snapshot: vi.fn(async () => ({})), noteSocketOpen: vi.fn(async () => {}), noteSocketClosed: vi.fn(async () => {}),
    collabSync: async () => ({ roomId: "room", roundId: "round" }),
    resolveTeamChatContext: async () => ({ sideId: "left", roomId: "room", active: true }),
  } as unknown as GameService;
}
function gateway(kind: string, service: GameService, expiresAt: number) {
  const verifier = { verify: async () => ({ userId: "alice", expiresAt }) } as unknown as AuthPrincipalClient;
  if (kind === "Game") return new GameGateway(service, verifier);
  if (kind === "Lobby") return new LobbyGateway(service, verifier);
  if (kind === "Chat") return new TeamChatGateway(service, undefined, verifier);
  return new CollabGateway(service, verifier);
}
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("DEV_PRINCIPAL", "false"); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(["Game", "Lobby", "Chat", "Collab"])("%s disconnects an idle expired session and clears its timer", async (kind) => {
  const service = game();
  const owner = gateway(kind, service, Date.now() + 1000);
  const client = socket();
  let closed: Promise<void> | undefined;
  client.once("disconnect", () => { closed = owner.handleDisconnect(client); });
  await owner.handleConnection(client);
  expect(client.connected).toBe(true);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(1000);
  await closed;
  expect(client.connected).toBe(false);
  expect(client.disconnect).toHaveBeenCalledWith(true);
  expect(vi.getTimerCount()).toBe(0);
  if (kind === "Game") expect(service.noteSocketClosed).toHaveBeenCalledWith("alice", "match", "sender");
});

it("expiry during a delayed admission never opens Presence or publishes a baseline", async () => {
  const service = game();
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  vi.mocked(service.snapshot).mockImplementation(async () => { await held; return {} as never; });
  const client = socket();
  const owner = gateway("Game", service, Date.now() + 1000);
  client.once("disconnect", () => { void owner.handleDisconnect(client); });
  const admission = owner.handleConnection(client);
  await Promise.resolve(); await Promise.resolve();
  await vi.advanceTimersByTimeAsync(1000);
  expect(client.connected).toBe(false);
  release(); await admission;
  expect(service.noteSocketOpen).not.toHaveBeenCalled();
  expect(client.emit).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("disconnect and denied admission clear idle-expiry timers", async () => {
  const client = socket();
  await authenticateHandshake(client, { verify: async () => ({ userId: "alice", expiresAt: Date.now() + 1000 }) });
  expect(vi.getTimerCount()).toBe(1);
  client.disconnect(true);
  expect(vi.getTimerCount()).toBe(0);
  const denied = socket("denied");
  const service = game();
  vi.mocked(service.snapshot).mockRejectedValue(new Error("not a member"));
  await gateway("Game", service, Date.now() + 1000).handleConnection(denied);
  expect(denied.connected).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["broadcast", "relay"])("%s sends nothing when recipient lookup fails or is unavailable", async (kind) => {
  const sender = socket();
  attachSocketPrincipal(sender, { userId: "alice", expiresAt: Date.now() + 1000 });
  const fallback = vi.fn();
  for (const server of [undefined, { to: () => ({ emit: fallback }) }, { in: () => ({ fetchSockets: async () => { throw new Error("adapter down"); } }), to: () => ({ emit: fallback }) }]) {
    if (kind === "broadcast") await broadcastGated(server, "room", "message", {}, () => true);
    else await relayGated(sender, server, "room", "message", {}, () => true);
  }
  expect(fallback).not.toHaveBeenCalled();
  expect(sender.to).not.toHaveBeenCalled();
});

it.each(["broadcast", "relay"])("%s checks current readiness after lookup and before each recipient", async (kind) => {
  const sender = socket();
  const first = socket("first");
  const second = socket("second");
  for (const client of [sender, first, second]) attachSocketPrincipal(client, { userId: "alice", expiresAt: Date.now() + 1000 });
  let ready = true;
  let release!: (value: Socket[]) => void;
  const lookup = new Promise<Socket[]>((resolve) => { release = resolve; });
  const server = { in: () => ({ fetchSockets: () => lookup }) };
  const send = () => kind === "broadcast" ? broadcastGated(server, "room", "message", {}, () => ready)
    : relayGated(sender, server, "room", "message", {}, () => ready);
  const pending = send();
  ready = false; release([sender, first, second]); await pending;
  expect(first.emit).not.toHaveBeenCalled();
  expect(second.emit).not.toHaveBeenCalled();
  ready = true;
  first.emit.mockImplementation(() => { ready = false; return true; });
  await send();
  expect(first.emit).toHaveBeenCalledOnce();
  expect(second.emit).not.toHaveBeenCalled();
  if (kind === "relay") expect(sender.emit).not.toHaveBeenCalled();
});

it("relay rechecks its sender after an awaited recipient lookup", async () => {
  const sender = socket(); const recipient = socket("recipient");
  for (const client of [sender, recipient]) attachSocketPrincipal(client, { userId: "alice", expiresAt: Date.now() + 1000 });
  let release!: (value: Socket[]) => void;
  const lookup = new Promise<Socket[]>((resolve) => { release = resolve; });
  const pending = relayGated(sender, { in: () => ({ fetchSockets: () => lookup }) }, "room", "update", {}, () => true);
  sender.disconnect(true); release([recipient]); await pending;
  expect(recipient.emit).not.toHaveBeenCalled();
});

it.each([null, [], "text", 42, true])("malformed principal body %j is unavailable and HTTP returns 503", async (body) => {
  vi.stubGlobal("fetch", async () => Response.json(body));
  const verifier = new AuthPrincipalClient("http://owned-auth.test");
  await expect(verifier.verify("token")).rejects.toBeInstanceOf(VerificationUnavailableError);
  const middleware = new PrincipalMiddleware(verifier);
  const request = { method: "GET", path: "/matches/m/snapshot", header: () => "Bearer token" } as never;
  let status = 0;
  const response = { status(code: number) { status = code; return { json() {} }; } } as never;
  const next = vi.fn(); await middleware.use(request, response, next);
  expect(status).toBe(503); expect(next).not.toHaveBeenCalled();
});
