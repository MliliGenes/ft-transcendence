import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameService } from "./game.service.js";
import { LobbyGateway } from "./lobby.gateway.js";

beforeEach(() => { vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("DEV_PRINCIPAL", "true"); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("LobbyGateway boot ordering and lifecycle subscription", () => {
  it("delays subscription to onApplicationBootstrap, registers once, and cleans up onModuleDestroy", async () => {
    const game = new GameService();
    const gateway = new LobbyGateway(game);

    // Mock WebSocketServer namespace
    const emittedToUser: Array<{ userChannel: string; event: string; payload: unknown }> = [];
    gateway.server = {
      to: (channels: string | string[]) => ({
        emit: (event: string, payload: unknown) => {
          const list = Array.isArray(channels) ? channels : [channels];
          for (const ch of list) emittedToUser.push({ userChannel: ch, event, payload });
        },
      }),
    } as any;

    // Simulate async delay before GameService.onModuleInit completes
    let delayedInitFinished = false;
    const initPromise = new Promise<void>((resolve) => {
      setTimeout(async () => {
        await game.onModuleInit();
        delayedInitFinished = true;
        resolve();
      }, 50);
    });

    // Before init completes, onApplicationBootstrap has NOT been called yet
    expect(delayedInitFinished).toBe(false);
    await initPromise;
    expect(delayedInitFinished).toBe(true);

    // Now application bootstrap hook fires (NestJS order)
    gateway.onApplicationBootstrap();

    // Verify hints route through gateway to sockets
    const host = `boot-host-${Date.now()}`;
    const guest = `boot-guest-${Date.now()}`;
    const room = await game.createPrivateRoom(host, "1v1");
    await game.joinPrivateRoom(guest, room.room.code);

    expect(emittedToUser.length).toBeGreaterThan(0);
    expect(emittedToUser).toContainEqual({
      userChannel: `user:${host}`,
      event: "lobby.roomUpdated",
      payload: expect.objectContaining({ roomId: room.room.id }),
    });

    // Verify cleanup on shutdown
    emittedToUser.length = 0;
    gateway.onModuleDestroy();

    // Subsequent events must not reach the destroyed gateway's server
    await game.setRoomMemberReady(guest, room.room.id, true);
    expect(emittedToUser).toHaveLength(0);

    // Bootstrap again must not create duplicate listeners if re-booted
    gateway.onApplicationBootstrap();
    emittedToUser.length = 0;
    await game.setRoomMemberReady(host, room.room.id, true);

    const matchesForHost = emittedToUser.filter((e) => e.userChannel === `user:${host}` && e.event === "lobby.roomUpdated");
    expect(matchesForHost).toHaveLength(1);

    gateway.onModuleDestroy();
    await game.onModuleDestroy();
  });
});
