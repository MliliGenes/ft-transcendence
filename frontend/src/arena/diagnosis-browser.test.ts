import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { TestSocket } from "../../test/socket.js";
import { MockArenaTransport } from "./mock.js";
import { CollabClient, type CollabSyncPayload } from "./collab.js";
import { LobbySession, type LobbySessionClient } from "./lobby-session.js";
import type { RoomWithMembers } from "./lobby.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
const sockets: TestSocket[] = [];
const cleanup: Array<() => void> = [];
const config = { baseUrl: "http://arena.test", userId: "user-a", matchId: "match-a" };

function baseline(source: string, language = "Python", revision = 1): CollabSyncPayload {
  const doc = new Y.Doc();
  doc.getText("source").insert(0, source);
  const stateB64 = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  doc.destroy();
  return { roomId: "room-a", roundId: "round-a", side: "left", stateB64, source, language, revision };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { for (let n = 0; n < 10; n++) await Promise.resolve(); }
const room: RoomWithMembers = {
  room: { id: "room-a", code: "ABCDEF", mode: "1v1", ownerUserId: "user-a", status: "open", createdAt: 1, expiresAt: 1000, matchId: null },
  members: [{ roomId: "room-a", userId: "user-a", sideId: "left", ready: true, joinedAt: 1 }],
};
function lobbyClient(overrides: Partial<LobbySessionClient> = {}): LobbySessionClient {
  return {
    getActive: vi.fn(async () => ({ room, queue: null })),
    cancelQueue: vi.fn(async () => ({ cancelled: true, matched: false })),
    createRoom: vi.fn(async () => room), joinRoom: vi.fn(async () => room),
    setSide: vi.fn(async () => room), setReady: vi.fn(async () => room),
    leaveRoom: vi.fn(async () => ({ left: true, closed: false })),
    startRoom: vi.fn(async () => ({ matchId: "new-match" })),
    connectSocket: vi.fn(() => () => {}), joinRoomChannel: vi.fn(), leaveRoomChannel: vi.fn(),
    ...overrides,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(io).mockReset().mockImplementation(() => {
    const socket = new TestSocket(); sockets.push(socket);
    return socket as unknown as ReturnType<typeof io>;
  });
});
afterEach(() => { cleanup.splice(0).forEach((stop) => stop()); sockets.length = 0; vi.useRealTimers(); });

describe("diagnosis: live frontend lifetime contracts", () => {
  it("restores authoritative source after a language change during disconnection", async () => {
    const client = new CollabClient({ ...config, displayName: "User A" });
    cleanup.push(() => client.dispose());
    const serverDoc = new Y.Doc();
    cleanup.push(() => serverDoc.destroy());
    const text = serverDoc.getText("source");
    text.insert(0, "python source");
    const oldBaseline = { ...baseline("python source"), stateB64: Buffer.from(Y.encodeStateAsUpdate(serverDoc)).toString("base64") };
    const wait = client.connect();
    sockets[0]!.server("sync", oldBaseline);
    await wait;
    sockets[0]!.server("disconnect");
    sockets[0]!.connect();
    serverDoc.transact(() => { text.delete(0, text.length); text.insert(0, "C++ source"); });
    sockets[0]!.server("sync", { ...baseline("C++ source", "C++", 2), stateB64: Buffer.from(Y.encodeStateAsUpdate(serverDoc)).toString("base64") });
    await client.reconcile(2, "C++");
    expect(client.connection()).toBe("connected");
    expect(client.language).toBe("C++");
    expect(client.getSource()).toBe("C++ source");
    expect(sockets[0]!.outgoing).toHaveLength(0);
  });

  it("does not route from an old Start Match reply after Lobby session stops", async () => {
    const receipt = deferred<{ matchId: string }>();
    const onMatchFound = vi.fn();
    const session = new LobbySession(lobbyClient({ startRoom: vi.fn(() => receipt.promise) }), onMatchFound);
    await session.start();
    await flush();
    const start = session.startRoom();
    session.stop();
    receipt.resolve({ matchId: "old-match" });
    await start;
    expect(onMatchFound).not.toHaveBeenCalled();
  });
});


describe("diagnosis: fixture match completion", () => {
  it("retains all round totals and the last Reveal when the mock Match completes", async () => {
    const transport = new MockArenaTransport("1v1");
    await transport.setLanguage("C++");
    for (let round = 1; round <= 3; round++) {
      await transport.beginCoding();
      expect(transport.snapshot().language).toBe("C++");
      await transport.submit({ code: "long long ledger_sum(vector<int> nums) { return 1; }", language: "C++" });
      transport.fixtureControls().publishReveal();
      expect(transport.snapshot().reveal?.totals).toEqual({ you: round * 100, opponent: round * 65 });
      await transport.advance();
    }
    const snapshot = transport.snapshot();
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.matchFinal).toMatchObject({ you: 300, opponent: 195, outcome: "You win the match." });
    expect(snapshot.reveal).not.toBeNull();
  });
});


const mutations = [
  { method: "createRoom", invoke: (session: LobbySession) => session.createRoom() },
  { method: "joinRoom", invoke: (session: LobbySession) => session.joinRoom("ABCDEF") },
  { method: "setSide", invoke: (session: LobbySession) => session.setSide("right") },
  { method: "setReady", invoke: (session: LobbySession) => session.setReady(false) },
  { method: "leaveRoom", invoke: (session: LobbySession) => session.leaveRoom() },
  { method: "startRoom", invoke: (session: LobbySession) => session.startRoom() },
] as const;

describe("diagnosis: restarted Lobby lifetime", () => {
  it.each(mutations)("ignores a stale $method receipt or error after stop and restart", async ({ method, invoke }) => {
    for (const failure of [false, true]) {
      const receipt = deferred<unknown>();
      const client = lobbyClient({ [method]: vi.fn(() => receipt.promise) } as Partial<LobbySessionClient>);
      const onMatchFound = vi.fn();
      const session = new LobbySession(client, onMatchFound);
      cleanup.push(() => session.stop());
      await session.start();
      await flush();
      const action = invoke(session);
      session.stop();
      await session.start();
      await flush();
      const current = session.getSnapshot();
      const requests = vi.mocked(client.getActive).mock.calls.length;
      if (failure) receipt.reject(new Error("old error"));
      else receipt.resolve({ matchId: "old-match", ...room });
      await action;
      expect(session.getSnapshot()).toBe(current);
      expect(client.getActive).toHaveBeenCalledTimes(requests);
      expect(onMatchFound).not.toHaveBeenCalled();
    }
  });

  it("ignores old socket callbacks after the Lobby has restarted", async () => {
    const callbacks: Array<Parameters<LobbySessionClient["connectSocket"]>[0]> = [];
    const client = lobbyClient({ connectSocket: vi.fn((callback) => { callbacks.push(callback); return () => {}; }) });
    const session = new LobbySession(client, vi.fn());
    cleanup.push(() => session.stop());
    await session.start();
    await flush();
    session.stop();
    await session.start();
    await flush();
    const current = session.getSnapshot();
    const requests = vi.mocked(client.getActive).mock.calls.length;
    callbacks[0]!.onConnect?.();
    callbacks[0]!.onRoomUpdated?.({ roomId: room.room.id, room: room.room, members: room.members });
    callbacks[0]!.onMatchFound?.({ roomId: room.room.id, matchId: "old-match" });
    callbacks[0]!.onQueueMatched?.({ matchId: "old-match" });
    await flush();
    expect(session.getSnapshot()).toBe(current);
    expect(client.getActive).toHaveBeenCalledTimes(requests);
  });
});


describe("diagnosis: fixture leave totals", () => {
  it.each([false, true])("includes earlier rounds and the current counted score once when leaving (revealed=%s)", async (revealed) => {
    const transport = new MockArenaTransport("1v1");
    await transport.beginCoding();
    await transport.submit({ code: "solved source", language: "Python" });
    transport.fixtureControls().publishReveal();
    await transport.advance();
    await transport.beginCoding();
    await transport.submit({ code: "def ledger_sum(nums):\n    return 0\n", language: "Python" });
    if (revealed) transport.fixtureControls().publishReveal();
    await transport.leave();
    expect(transport.snapshot().matchFinal).toMatchObject({ you: 100, opponent: 130 });
  });
});
