import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchMode } from "arena-model";
import {
  GAME_SCHEMA,
  InMemoryMatchStore,
} from "../src/persistence.js";
import {
  InMemoryLobbyStore,
  Lobby,
  LobbyError,
  LobbyStore,
  type ILobbyStore,
  type LobbyEvent,
} from "../src/lobby.js";

const pgUrl = process.env.TEST_PG_URL ?? process.env.DATABASE_URL;

describe.each(["memory", "postgres"])("Lobby module (%s adapter)", (adapterKind) => {
  if (adapterKind === "postgres" && !pgUrl) return;

  const schema = `lobby_mod_${randomUUID().replaceAll("-", "")}`;
  let admin: Pool | undefined;
  let pool: Pool | undefined;
  let store: ILobbyStore;
  let lobby: Lobby;
  let now = 1_000_000;
  const createdMatches: Array<{ input: any; matchId: string }> = [];

  beforeAll(async () => {
    if (adapterKind === "postgres") {
      admin = new Pool({ connectionString: pgUrl });
      await admin.query(`CREATE SCHEMA ${schema}`);
      pool = new Pool({ connectionString: pgUrl, options: `-c search_path=${schema}` });
      await pool.query(GAME_SCHEMA);
      store = new LobbyStore(pool, () => now);
      await store.ensureSchema();
    } else {
      store = new InMemoryLobbyStore(() => now, randomUUID, new InMemoryMatchStore());
    }
  });

  afterAll(async () => {
    if (adapterKind === "postgres") {
      await pool?.end();
      await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin?.end();
    }
  });

  beforeEach(async () => {
    now = 1_000_000;
    createdMatches.length = 0;
    if (adapterKind === "postgres" && pool) {
      await pool.query("TRUNCATE arena_queue_entries, arena_private_rooms, arena_private_room_members, matches CASCADE");
    } else {
      store = new InMemoryLobbyStore(() => now, randomUUID, new InMemoryMatchStore());
    }
    lobby = new Lobby({
      store,
      clock: () => now,
      createMatch: async (input, save) => {
        const matchId = `match-${randomUUID()}`;
        createdMatches.push({ input, matchId });
        if (save) {
          await save({
            id: matchId,
            mode: input.mode,
            roundPhase: "MATCH_FOUND",
            currentRound: 1,
            totalRounds: input.problemVersionIds.length,
            durationMs: 1800000,
            startedAt: now,
            participants: input.participants.map((p) => ({ userId: p.userId, sideId: p.sideId as any })),
            rounds: input.problemVersionIds.map((pvid) => ({
              roundId: `round-${randomUUID()}`,
              problemVersionId: pvid,
              hiddenSuiteId: "hidden",
              counted: {},
              attempts: {},
              activities: {},
              runTests: {},
              reveal: null,
              closing: false,
              cutoffPassed: false,
              superseded: [],
            })),
            failures: [],
            revision: 0,
            presence: {},
            offlineSinceMs: {},
            forfeit: null,
          });
        }
        return matchId;
      },
      availableProblems: ["even-ledger", "double-it"],
    });
  });

  it("complete invitation, readiness, and start workflow with typed hints", async () => {
    const hints: Array<{ event: LobbyEvent; payload: any }> = [];
    lobby.on((event, payload) => hints.push({ event, payload }));

    const host = "user-host";
    const guest = "user-guest";

    // 1. Create room
    const created = await lobby.createPrivateRoom(host, "1v1");
    expect(created.room.status).toBe("open");
    expect(created.members).toHaveLength(1);
    expect(created.members[0].sideId).toBe("left");

    // 2. Join room
    const joined = await lobby.joinPrivateRoom(guest, created.room.code);
    expect(joined.members).toHaveLength(2);
    expect(joined.members.find((m) => m.userId === guest)?.sideId).toBe("right");
    expect(hints).toContainEqual({
      event: "lobby.roomUpdated",
      payload: expect.objectContaining({
        roomId: created.room.id,
        audienceUserIds: expect.arrayContaining([host, guest]),
      }),
    });

    // 3. Side change
    hints.length = 0;
    const moved = await lobby.setRoomMemberSide(guest, created.room.id, "right");
    expect(moved.members.find((m) => m.userId === guest)?.sideId).toBe("right");

    // 4. Ready-up
    await lobby.setRoomMemberReady(guest, created.room.id, true);
    await lobby.setRoomMemberReady(host, created.room.id, true);

    // 5. Start
    hints.length = 0;
    const started = await lobby.startPrivateRoom(host, created.room.id);
    expect(started.matchId).toBeDefined();
    expect(createdMatches).toHaveLength(1);
    expect(createdMatches[0].input.participants).toEqual([
      { userId: host, sideId: "left" },
      { userId: guest, sideId: "right" },
    ]);
    expect(hints).toContainEqual({
      event: "lobby.matchFound",
      payload: expect.objectContaining({
        roomId: created.room.id,
        matchId: started.matchId,
        userIds: expect.arrayContaining([host, guest]),
      }),
    });
  });

  it("ordinary Leave targets remaining members and excludes the departed player", async () => {
    const hints: Array<{ event: LobbyEvent; payload: any }> = [];
    lobby.on((event, payload) => hints.push({ event, payload }));

    const host = "user-host";
    const guest = "user-guest";

    const created = await lobby.createPrivateRoom(host, "1v1");
    await lobby.joinPrivateRoom(guest, created.room.code);

    hints.length = 0;
    const leaveRes = await lobby.leavePrivateRoom(guest, created.room.id);
    expect(leaveRes).toEqual({ left: true, closed: false });

    expect(hints).toHaveLength(1);
    expect(hints[0].event).toBe("lobby.roomUpdated");
    expect(hints[0].payload.audienceUserIds).toEqual([host]);
    expect(hints[0].payload.audienceUserIds).not.toContain(guest);
  });

  it("Leave hints cannot mutate authoritative membership or readiness", async () => {
    const created = await lobby.createPrivateRoom("host", "1v1");
    await lobby.joinPrivateRoom("guest", created.room.code);
    lobby.on((event, payload) => {
      if (event !== "lobby.roomUpdated") return;
      const hint = payload as { members: Array<{ ready: boolean }> };
      hint.members[0].ready = true;
      hint.members.length = 0;
    });

    await lobby.leavePrivateRoom("guest", created.room.id);
    const saved = await lobby.getRoomWithMembers(created.room.id);
    expect(saved?.members).toEqual([
      expect.objectContaining({ userId: "host", ready: false }),
    ]);
  });

  it("host closure targets affected other members before membership is cleared", async () => {
    const hints: Array<{ event: LobbyEvent; payload: any }> = [];
    lobby.on((event, payload) => hints.push({ event, payload }));

    const host = "user-host";
    const guest1 = "user-g1";
    const guest2 = "user-g2";

    const created = await lobby.createPrivateRoom(host, "2v2");
    await lobby.joinPrivateRoom(guest1, created.room.code);
    await lobby.joinPrivateRoom(guest2, created.room.code);

    hints.length = 0;
    const leaveRes = await lobby.leavePrivateRoom(host, created.room.id);
    expect(leaveRes).toEqual({ left: true, closed: true });

    expect(hints).toHaveLength(1);
    expect(hints[0].event).toBe("lobby.roomUpdated");
    expect(hints[0].payload.room.status).toBe("closed");
    expect(hints[0].payload.audienceUserIds).toEqual(expect.arrayContaining([guest1, guest2]));
    expect(hints[0].payload.audienceUserIds).not.toContain(host);
    const saved = await lobby.getRoomWithMembers(created.room.id);
    expect(saved?.room.status).toBe("closed");
    expect(saved?.members).toEqual([]);
    for (const guest of [guest1, guest2]) {
      expect(await lobby.userActiveRoom(guest)).toBeNull();
      await expect(lobby.roomForMember(guest, created.room.id)).rejects.toMatchObject({ code: 403 });
    }
  });

  it("committed results survive failed hint listener delivery", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    lobby.on(() => {
      throw new Error("throwing hint listener");
    });

    const host = "user-host";
    const guest = "user-guest";

    const created = await lobby.createPrivateRoom(host, "1v1");
    const joined = await lobby.joinPrivateRoom(guest, created.room.code);
    expect(joined.members).toHaveLength(2);

    await lobby.setRoomMemberReady(guest, created.room.id, true);
    await lobby.setRoomMemberReady(host, created.room.id, true);

    const started = await lobby.startPrivateRoom(host, created.room.id);
    expect(started.matchId).toBeDefined();
  });

  it("storage rejection emits no hint", async () => {
    const hints: Array<{ event: LobbyEvent; payload: any }> = [];
    lobby.on((event, payload) => hints.push({ event, payload }));

    // Non-existent room code
    await expect(lobby.joinPrivateRoom("bad-user", "ZZZZZZ")).rejects.toThrow();
    expect(hints).toHaveLength(0);

    // Host start before all ready
    const host = "user-host";
    const guest = "user-guest";
    const created = await lobby.createPrivateRoom(host, "1v1");
    await lobby.joinPrivateRoom(guest, created.room.code);

    hints.length = 0;
    await expect(lobby.startPrivateRoom(host, created.room.id)).rejects.toThrow();
    expect(hints).toHaveLength(0);

    // Non-host start
    await lobby.setRoomMemberReady(guest, created.room.id, true);
    await lobby.setRoomMemberReady(host, created.room.id, true);
    hints.length = 0;
    await expect(lobby.startPrivateRoom(guest, created.room.id)).rejects.toThrow();
    expect(hints).toHaveLength(0);
  });

  it("enforces action rate limits across lobby operations", async () => {
    const limitedLobby = new Lobby({
      store,
      clock: () => now,
      createMatch: async () => "match-1",
      rateLimitWindowMs: 10000,
      maxActionsPerWindow: 3,
    });

    await limitedLobby.createPrivateRoom("spam-user", "1v1");
    await limitedLobby.cancelQueue("spam-user");
    await limitedLobby.cancelQueue("spam-user");

    await expect(limitedLobby.cancelQueue("spam-user")).rejects.toThrow(/too many lobby requests/i);
  });

  it("enforces expiry rule", async () => {
    const created = await lobby.createPrivateRoom("exp-host", "1v1");
    now += 25 * 60 * 1000; // past 20 min expiry
    await expect(lobby.joinPrivateRoom("exp-guest", created.room.code)).rejects.toThrow(/expired/i);
  });
});
