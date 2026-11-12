import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { GameGateway } from "./game.gateway.js";
import { socketPrincipal } from "./socket-auth.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GameGateway reconnect cleanup", () => {
  it("keeps the verified principal available if the socket drops during the baseline snapshot", async () => {
    vi.stubEnv("DEV_PRINCIPAL", "true");

    let finishSnapshot!: () => void;
    let signalSnapshotStarted!: () => void;
    const pendingSnapshot = new Promise<unknown>((resolve) => { finishSnapshot = () => resolve({}); });
    const snapshotStarted = new Promise<void>((resolve) => { signalSnapshotStarted = resolve; });
    const game = {
      onEvent: vi.fn(),
      onAccountDeleted: vi.fn(),
      registerActiveSocketEnumerator: vi.fn(),
      assertAccountActive: vi.fn(async () => undefined),
      snapshot: vi.fn(async () => {
        signalSnapshotStarted();
        return pendingSnapshot;
      }),
      noteSocketOpen: vi.fn(async () => undefined),
      noteSocketClosed: vi.fn(async () => undefined),
    };
    const gateway = new GameGateway(game as never);
    let connected = true;
    const join = vi.fn(async () => undefined);
    const client = {
      id: "socket-1",
      data: {},
      handshake: { auth: { userId: "alice", matchId: "match-1" }, query: {}, headers: {} },
      get connected() { return connected; },
      join,
      emit: vi.fn(),
      disconnect: vi.fn(() => { connected = false; }),
    } as unknown as Socket;

    const connecting = gateway.handleConnection(client);
    await snapshotStarted;
    expect(socketPrincipal(client, { matchIdRequired: true })).toEqual({ userId: "alice", matchId: "match-1" });

    connected = false;
    await gateway.handleDisconnect(client);
    finishSnapshot();
    await connecting;

    expect(game.noteSocketClosed).toHaveBeenCalledWith("alice", "match-1", "socket-1");
    expect(game.noteSocketOpen).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
  });
});
