import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameService } from "./game.service.js";

describe("Lobby live hint isolation and committed command preservation", () => {
  let game: GameService;

  beforeEach(async () => {
    game = new GameService();
    await game.onModuleInit();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await game?.onModuleDestroy();
  });

  it("isolates throwing first listener and delivers hints to later listeners for Join, Side, and Ready", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = `host-${Date.now()}`;
    const guest = `guest-${Date.now()}`;

    const created = await game.createPrivateRoom(host, "1v1");
    const roomId = created.room.id;
    const code = created.room.code;

    const receivedEvents: Array<{ event: string; payload: unknown }> = [];
    game.onLobbyEvent(() => {
      throw new Error("injected listener failure");
    });
    game.onLobbyEvent((event, payload) => {
      receivedEvents.push({ event, payload });
    });

    // 1. Join
    const joined = await game.joinPrivateRoom(guest, code);
    expect(joined.room.id).toBe(roomId);
    expect(joined.members).toHaveLength(2);
    expect(receivedEvents).toContainEqual({
      event: "lobby.roomUpdated",
      payload: expect.objectContaining({ roomId }),
    });

    // 2. Side
    receivedEvents.length = 0;
    const sideUpdated = await game.setRoomMemberSide(guest, roomId, "right");
    expect(sideUpdated.members.find((m) => m.userId === guest)?.sideId).toBe("right");
    expect(receivedEvents).toContainEqual({
      event: "lobby.roomUpdated",
      payload: expect.objectContaining({ roomId }),
    });

    // 3. Ready
    receivedEvents.length = 0;
    const readyUpdated = await game.setRoomMemberReady(guest, roomId, true);
    expect(readyUpdated.members.find((m) => m.userId === guest)?.ready).toBe(true);
    expect(receivedEvents).toContainEqual({
      event: "lobby.roomUpdated",
      payload: expect.objectContaining({ roomId }),
    });

    expect(errorSpy).toHaveBeenCalled();
  });

  it("isolates throwing first listener for Leave and Start, returning committed results", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = `host-${Date.now()}`;
    const guest = `guest-${Date.now()}`;

    const created = await game.createPrivateRoom(host, "1v1");
    const roomId = created.room.id;
    await game.joinPrivateRoom(guest, created.room.code);

    const receivedEvents: Array<{ event: string; payload: unknown }> = [];
    game.onLobbyEvent(() => {
      throw new Error("injected listener failure");
    });
    game.onLobbyEvent((event, payload) => {
      receivedEvents.push({ event, payload });
    });

    // Leave
    const leaveRes = await game.leavePrivateRoom(guest, roomId);
    expect(leaveRes).toEqual({ left: true, closed: false });
    expect(receivedEvents).toContainEqual({
      event: "lobby.roomUpdated",
      payload: expect.objectContaining({ roomId }),
    });

    // Rejoin, ready up, and test Start
    await game.joinPrivateRoom(guest, created.room.code);
    await game.setRoomMemberReady(guest, roomId, true);
    await game.setRoomMemberReady(host, roomId, true);

    receivedEvents.length = 0;
    const startRes = await game.startPrivateRoom(host, roomId);
    expect(startRes.matchId).toBeDefined();
    expect(receivedEvents).toContainEqual({
      event: "lobby.matchFound",
      payload: expect.objectContaining({ roomId, matchId: startRes.matchId }),
    });

    expect(errorSpy).toHaveBeenCalled();
  });

  it("preserves committed Leave and Start results when post-commit room lookup fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = `host-${Date.now()}`;
    const guest = `guest-${Date.now()}`;

    const created = await game.createPrivateRoom(host, "1v1");
    const roomId = created.room.id;
    await game.joinPrivateRoom(guest, created.room.code);

    // Make getRoomWithMembers fail on subsequent reads
    const origGetRoom = (game as any).lobbyStore.getRoomWithMembers.bind((game as any).lobbyStore);
    (game as any).lobbyStore.getRoomWithMembers = async (rId: string) => {
      throw new Error("injected post-commit read failure");
    };

    // Leave must still succeed
    const leaveResult = await game.leavePrivateRoom(guest, roomId);
    expect(leaveResult).toEqual({ left: true, closed: false });

    // Restore getRoom to set up Start
    (game as any).lobbyStore.getRoomWithMembers = origGetRoom;
    await game.joinPrivateRoom(guest, created.room.code);
    await game.setRoomMemberReady(guest, roomId, true);
    await game.setRoomMemberReady(host, roomId, true);

    // Injected failure for Start's post-commit read
    (game as any).lobbyStore.getRoomWithMembers = async (rId: string) => {
      throw new Error("injected post-commit read failure");
    };

    const startResult = await game.startPrivateRoom(host, roomId);
    expect(startResult.matchId).toBeDefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("preserves committed queue join when post-commit matchmaking or queue status refresh fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = `q-user-${Date.now()}`;

    // Force triggerMatchmaking or queueStatus to fail
    (game as any).lobbyStore.queueStatus = async () => {
      throw new Error("injected queueStatus failure");
    };

    const entry = await game.joinQueue(user, "1v1");
    expect(entry.userId).toBe(user);
    expect(entry.mode).toBe("1v1");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("isolates throwing listener during queue matchmaking", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const u1 = `q1-${Date.now()}`;
    const u2 = `q2-${Date.now()}`;

    const receivedEvents: Array<{ event: string; payload: unknown }> = [];
    game.onLobbyEvent(() => {
      throw new Error("injected matcher listener failure");
    });
    game.onLobbyEvent((event, payload) => {
      receivedEvents.push({ event, payload });
    });

    await game.joinQueue(u1, "1v1");
    await game.joinQueue(u2, "1v1");

    expect(receivedEvents).toContainEqual({
      event: "lobby.queueMatched",
      payload: expect.objectContaining({ matchId: expect.any(String), userIds: expect.arrayContaining([u1, u2]) }),
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("keeps failures before durable acceptance visible and emits no hint", async () => {
    const receivedEvents: Array<{ event: string; payload: unknown }> = [];
    game.onLobbyEvent((event, payload) => {
      receivedEvents.push({ event, payload });
    });

    // 1. Join with nonexistent invite code
    await expect(game.joinPrivateRoom("bad-user", "NONEXISTENT")).rejects.toThrow();
    expect(receivedEvents).toHaveLength(0);

    // 2. Start room that is not ready
    const host = `host-${Date.now()}`;
    const room = await game.createPrivateRoom(host, "1v1");
    await expect(game.startPrivateRoom(host, room.room.id)).rejects.toThrow();
    expect(receivedEvents).toHaveLength(0);

    // 3. Start by non-host
    const guest = `guest-${Date.now()}`;
    await game.joinPrivateRoom(guest, room.room.code);
    await game.setRoomMemberReady(guest, room.room.id, true);
    await game.setRoomMemberReady(host, room.room.id, true);
    receivedEvents.length = 0;

    await expect(game.startPrivateRoom(guest, room.room.id)).rejects.toThrow();
    expect(receivedEvents).toHaveLength(0);
  });
});
