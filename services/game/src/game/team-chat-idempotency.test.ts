import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { TeamChatGateway } from "./team-chat.gateway.js";
import type { GameService } from "./game.service.js";
import { attachSocketPrincipal } from "./socket-auth.js";

afterEach(() => vi.unstubAllEnvs());

describe("Team chat retry identity during a pending lifecycle lookup", () => {
  it("broadcasts one message when a retry overlaps the original request", async () => {
    // DEV-fixture socket (no token): runs behind the DEV_PRINCIPAL seam.
    vi.stubEnv("DEV_PRINCIPAL", "true");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const game = { runtimeReady: true, assertServing: () => {}, resolveTeamChatContext: vi.fn(async () => {
      await pending;
      return { active: true };
    }) } as unknown as GameService;
    const gateway = new TeamChatGateway(game);
    const broadcast = vi.fn();
    const socket = { id: "socket-1", connected: true, data: { roomId: "m1:left:chat", sideId: "left" } } as unknown as Socket;
    attachSocketPrincipal(socket, { userId: "u1", matchId: "m1", expiresAt: Number.MAX_SAFE_INTEGER });
    gateway.server = { in: () => ({ fetchSockets: async () => [{ id: "recipient", connected: true, data: socket.data, emit: broadcast }] }) } as never;
    const message = { text: "Check the edge case", clientMessageId: "unconfirmed-1" };
    const first = gateway.onMessage(socket, message);
    const retry = gateway.onMessage(socket, message);
    release();
    const results = await Promise.all([first, retry]);
    expect(results[0]).toEqual({ ok: true, id: expect.any(String) });
    expect(results[1]).toEqual(results[0]);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(gateway.getRecentHistory("m1:left:chat")).toHaveLength(1);
  });
});
