import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { GameGateway } from "./game.gateway.js";
import type { GameService } from "./game.service.js";
import { MatchSocketPresence } from "./match-socket-presence.js";

afterEach(() => vi.unstubAllEnvs());

describe("Match socket admission", () => {
  it.each(["snapshot", "Presence"])("does not join a socket that closes during %s", async (stage) => {
    vi.stubEnv("DEV_PRINCIPAL", "true");
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((done) => { entered = done; });
    const gate = new Promise<void>((done) => { release = done; });
    const states: string[] = [];
    const presence = new MatchSocketPresence({
      participantSide: async () => "left", modeOf: async () => "1v1",
      setMemberPresence: async () => {},
      setPresence: async (_, __, state) => {
        states.push(state);
        if (stage === "Presence" && state === "online") { entered(); await gate; }
      },
    });
    let reads = 0;
    const game = { runtimeReady: true, assertServing: () => {},
      onEvent: () => () => {},
      snapshot: async () => { if (stage === "snapshot" && ++reads === 1) { entered(); await gate; } return {}; },
      noteSocketOpen: (user: string, match: string, socket: string) => presence.noteSocketOpen(user, match, socket),
      noteSocketClosed: (user: string, match: string, socket: string) => presence.noteSocketClosed(user, match, socket),
    };
    const gateway = new GameGateway(game as unknown as GameService);
    const rooms: string[] = [];
    const baselines: unknown[] = [];
    const client = {
      id: "socket", connected: true, data: {},
      handshake: { auth: { userId: "alice", matchId: "match" } },
      join: async (room: string) => { rooms.push(room); },
      emit: (_: string, body: unknown) => { baselines.push(body); },
      disconnect: () => { client.connected = false; },
    };
    const opening = gateway.handleConnection(client as unknown as Socket);
    await started;
    client.connected = false;
    const closing = gateway.handleDisconnect(client as unknown as Socket);
    release();
    await Promise.all([opening, closing]);

    expect(rooms).toEqual([]);
    expect(baselines).toEqual([]);
    expect(states).toEqual(stage === "Presence" ? ["online", "offline"] : []);
  });
});
