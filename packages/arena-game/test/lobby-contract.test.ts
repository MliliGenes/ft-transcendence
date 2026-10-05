import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLobbyStore, LobbyStore, type ILobbyStore, type LobbySideId } from "../src/lobby.js";
import { GAME_SCHEMA } from "../src/postgres-store.js";

for (const adapter of ["memory", "postgres"] as const) {
  describe.runIf(adapter === "memory" || Boolean(process.env.DATABASE_URL))(`private Lobby contract (${adapter})`, () => {
    let now = 1000;
    let lobby: ILobbyStore;
    let admin: Pool | undefined;
    let pool: Pool | undefined;
    const schema = `lobby_contract_${randomUUID().replaceAll("-", "")}`;
    beforeAll(async () => {
      if (adapter !== "postgres") return;
      admin = new Pool({ connectionString: process.env.DATABASE_URL });
      await admin.query(`CREATE SCHEMA ${schema}`);
      pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
      await pool.query(GAME_SCHEMA);
      await new LobbyStore(pool).ensureSchema();
    });
    beforeEach(async () => {
      now = 1000;
      if (pool) {
        await pool.query("TRUNCATE arena_queue_entries, arena_private_rooms, matches CASCADE");
        lobby = new LobbyStore(pool, () => now);
      } else lobby = new InMemoryLobbyStore(() => now);
    });
    afterAll(async () => {
      await pool?.end();
      await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin?.end();
    });

    it("rejects joining at the exact expiry and durably expires the invitation", async () => {
      const { room } = await lobby.createPrivateRoom("host", "1v1", 100);
      now = room.expiresAt;
      await expect(lobby.joinPrivateRoom("guest", room.code)).rejects.toMatchObject({ code: 410 });
      expect((await lobby.getRoomWithMembers(room.id))?.room.status).toBe("expired");
      expect(await lobby.userActiveRoom("host")).toBeNull();
      expect((await lobby.joinQueue("host", "1v1")).status).toBe("waiting");
    });

    it("rejects every mutation at the exact expiry before changing readiness or sides", async () => {
      const { room } = await lobby.createPrivateRoom("host", "1v1", 100);
      await lobby.joinPrivateRoom("guest", room.code);
      await lobby.setRoomMemberReady("host", room.id, true);
      await lobby.setRoomMemberReady("guest", room.id, true);
      now = room.expiresAt;
      const create = vi.fn().mockResolvedValue("match");
      await expect(lobby.setRoomMemberSide("guest", room.id, "left")).rejects.toMatchObject({ code: 410 });
      await expect(lobby.setRoomMemberReady("guest", room.id, false)).rejects.toMatchObject({ code: 410 });
      await expect(lobby.startPrivateRoom("host", room.id, ["p"], create)).rejects.toMatchObject({ code: 410 });
      await expect(lobby.startPrivateRoom("guest", room.id, ["p"], create)).rejects.toMatchObject({ code: 410 });
      expect(create).not.toHaveBeenCalled();
      expect((await lobby.getRoomWithMembers(room.id))?.members.every((member) => member.ready)).toBe(true);
    });

    it("rejects invalid sides and nonmembers without changing the Lobby", async () => {
      const { room } = await lobby.createPrivateRoom("host", "2v2");
      await expect(lobby.setRoomMemberSide("host", room.id, "middle" as LobbySideId)).rejects.toMatchObject({ code: 400 });
      await expect(lobby.setRoomMemberSide("stranger", room.id, "right")).rejects.toMatchObject({ code: 403 });
      await expect(lobby.setRoomMemberReady("stranger", room.id, true)).rejects.toMatchObject({ code: 403 });
      expect((await lobby.getRoomWithMembers(room.id))?.members).toMatchObject([{ userId: "host", sideId: "left", ready: false }]);
    });

    it("preserves readiness on a same-side choice, clears it on a move, and refuses a full side", async () => {
      const { room } = await lobby.createPrivateRoom("host", "2v2");
      await lobby.joinPrivateRoom("mate", room.code);
      await lobby.setRoomMemberReady("host", room.id, true);
      await lobby.setRoomMemberSide("host", room.id, "left");
      expect((await lobby.getRoomWithMembers(room.id))?.members.find((m) => m.userId === "host")?.ready).toBe(true);
      const moved = await lobby.setRoomMemberSide("host", room.id, "right");
      expect(moved.members.find((m) => m.userId === "host")).toMatchObject({ sideId: "right", ready: false });
      const joined = await lobby.joinPrivateRoom("third", room.code.toLowerCase());
      expect(joined.members.find((m) => m.userId === "third")?.sideId).toBe("left");
      await expect(lobby.setRoomMemberSide("host", room.id, "left")).rejects.toThrow("side is full");
    });

    it("requires the host, balanced full sides, and all players ready before starting", async () => {
      const { room } = await lobby.createPrivateRoom("host", "2v2");
      const create = vi.fn().mockResolvedValue("match");
      await expect(lobby.startPrivateRoom("host", room.id, ["p"], create)).rejects.toThrow("sides must be full");
      for (const user of ["mate", "rival", "other"]) await lobby.joinPrivateRoom(user, room.code);
      await expect(lobby.startPrivateRoom("mate", room.id, ["p"], create)).rejects.toMatchObject({ code: 403 });
      await expect(lobby.startPrivateRoom("host", room.id, ["p"], create)).rejects.toThrow("all players must be ready");
      for (const user of ["host", "mate", "rival", "other"]) await lobby.setRoomMemberReady(user, room.id, true);
      await expect(lobby.startPrivateRoom("host", room.id, ["p"], create)).resolves.toEqual({ matchId: "match" });
      expect(create.mock.calls[0][0]).toEqual({ mode: "2v2", problemVersionIds: ["p"], participants: [
        { userId: "host", sideId: "left" }, { userId: "mate", sideId: "left" },
        { userId: "rival", sideId: "right" }, { userId: "other", sideId: "right" },
      ] });
      await expect(lobby.startPrivateRoom("host", room.id, ["p"], create)).rejects.toThrow("already started");
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("admits one contender for the last slot and starts exactly once", async () => {
      const { room } = await lobby.createPrivateRoom("host", "1v1");
      const admissions = await Promise.allSettled([lobby.joinPrivateRoom("guest-a", room.code), lobby.joinPrivateRoom("guest-b", room.code)]);
      expect(admissions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const members = (await lobby.getRoomWithMembers(room.id))!.members;
      for (const member of members) await lobby.setRoomMemberReady(member.userId, room.id, true);
      const create = vi.fn().mockResolvedValue("match");
      const starts = await Promise.allSettled([lobby.startPrivateRoom("host", room.id, ["p"], create), lobby.startPrivateRoom("host", room.id, ["p"], create)]);
      expect(starts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(create).toHaveBeenCalledOnce();
    });
  });
}
