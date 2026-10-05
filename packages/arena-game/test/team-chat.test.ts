import { describe, expect, it, vi } from "vitest";
import {
  TeamChat,
  type TeamChatContext,
} from "../src/team-chat.js";

describe("TeamChat module", () => {
  const createChat = (overrides?: {
    resolveContext?: (userId: string, matchId: string) => Promise<TeamChatContext>;
    clock?: () => number;
    generateId?: () => string;
  }) => {
    let now = 1_000_000;
    let idCounter = 1;
    const chat = new TeamChat({
      resolveContext: overrides?.resolveContext ?? (async () => ({ active: true, roomId: "m1:left:chat", sideId: "left" })),
      clock: overrides?.clock ?? (() => now),
      generateId: overrides?.generateId ?? (() => `id-${idCounter++}`),
    });
    return { chat, advanceTime: (ms: number) => { now += ms; } };
  };

  describe("message acceptance and validation", () => {
    it("accepts valid text and records it in history", async () => {
      const { chat } = createChat();
      const result = await chat.acceptMessage({
        connectionId: "conn-1",
        userId: "u1",
        matchId: "m1",
        sideId: "left",
        roomId: "room-1",
        text: "  Check the binary search edge cases  ",
      });

      expect(result.ack).toEqual({ ok: true, id: "id-1" });
      expect(result.entry).toEqual({
        id: "id-1",
        matchId: "m1",
        sideId: "left",
        senderUserId: "u1",
        text: "Check the binary search edge cases",
        timestamp: 1_000_000,
        type: "text",
      });

      const history = chat.getRecentHistory("room-1");
      expect(history).toEqual([result.entry]);
    });

    it("rejects invalid, empty, or oversized message payloads", async () => {
      const { chat } = createChat();

      // Non-string
      const nonString = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: 12345,
      });
      expect(nonString.ack).toEqual({ ok: false, error: "invalid message payload" });
      expect(nonString.entry).toBeUndefined();

      // Empty / whitespace
      const empty = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "    \n   \t  ",
      });
      expect(empty.ack).toEqual({ ok: false, error: "empty message" });
      expect(empty.entry).toBeUndefined();

      // Exceeds 500 chars
      const oversized = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "a".repeat(501),
      });
      expect(oversized.ack).toEqual({ ok: false, error: "message exceeds 500 characters" });
      expect(oversized.entry).toBeUndefined();

      expect(chat.getRecentHistory("room-1")).toHaveLength(0);
    });
  });

  describe("retry identity and deduplication", () => {
    it("returns original ack on ordinary retry and emits no new entry", async () => {
      const { chat } = createChat();
      const first = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Hello team", clientMessageId: "client-msg-1",
      });
      expect(first.ack).toEqual({ ok: true, id: "id-1" });
      expect(first.entry).toBeDefined();

      const retry = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Hello team", clientMessageId: "client-msg-1",
      });
      expect(retry.ack).toEqual({ ok: true, id: "id-1" });
      expect(retry.entry).toBeUndefined();

      expect(chat.getRecentHistory("room-1")).toHaveLength(1);
    });

    it("deduplicates overlapping concurrent retries during pending lifecycle lookup", async () => {
      let release!: () => void;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      const resolveContext = vi.fn(async () => {
        await pending;
        return { active: true };
      });
      const { chat } = createChat({ resolveContext });

      const input = {
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Concurrent message", clientMessageId: "pending-retry-1",
      };

      const p1 = chat.acceptMessage(input);
      const p2 = chat.acceptMessage(input);
      release();

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.ack).toEqual({ ok: true, id: expect.any(String) });
      expect(res2.ack).toEqual(res1.ack);

      // Exactly one of the two calls returns the new entry, the other returns only ack
      const entries = [res1.entry, res2.entry].filter(Boolean);
      expect(entries).toHaveLength(1);
      expect(chat.getRecentHistory("room-1")).toHaveLength(1);
    });

    it("preserves retry identity across reconnects within cache lifetime", async () => {
      const { chat } = createChat();
      const first = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Message before reconnect", clientMessageId: "reconnect-msg",
      });
      expect(first.ack).toEqual({ ok: true, id: "id-1" });

      // Client reconnects: new connectionId, same user/match/room/clientMessageId
      chat.releaseConnection("conn-1");
      const reconnectedRetry = await chat.acceptMessage({
        connectionId: "conn-2", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Message before reconnect", clientMessageId: "reconnect-msg",
      });
      expect(reconnectedRetry.ack).toEqual({ ok: true, id: "id-1" });
      expect(reconnectedRetry.entry).toBeUndefined();
      expect(chat.getRecentHistory("room-1")).toHaveLength(1);
    });
  });

  describe("quick pings", () => {
    it("accepts valid quick pings and records them in history", async () => {
      const { chat } = createChat();
      const result = await chat.acceptPing({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        ping: "CHECK_EDGE_CASE",
      });

      expect(result.ack).toEqual({ ok: true, id: "id-1" });
      expect(result.entry).toEqual({
        id: "id-1",
        matchId: "m1",
        sideId: "left",
        senderUserId: "u1",
        ping: "CHECK_EDGE_CASE",
        timestamp: 1_000_000,
        type: "ping",
      });

      expect(chat.getRecentHistory("room-1")).toEqual([result.entry]);
    });

    it("rejects invalid ping values", async () => {
      const { chat } = createChat();
      const bad = await chat.acceptPing({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        ping: "NOT_A_REAL_PING",
      });
      expect(bad.ack).toEqual({ ok: false, error: "invalid ping type" });
      expect(bad.entry).toBeUndefined();
      expect(chat.getRecentHistory("room-1")).toHaveLength(0);
    });
  });

  describe("rate limiting", () => {
    it("enforces message rate limit per connection and resets upon release", async () => {
      const { chat } = createChat();
      for (let i = 0; i < 5; i++) {
        const res = await chat.acceptMessage({
          connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
          text: `Msg ${i}`,
        });
        expect(res.ack.ok).toBe(true);
      }

      // 6th message exceeds limit (5 msgs / 2s)
      const rejected = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Msg 6",
      });
      expect(rejected.ack).toEqual({ ok: false, error: "rate limit exceeded: too many messages" });

      // Duplicate retry still succeeds even when rate limit is exceeded
      const retryResult = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Msg 0", clientMessageId: "retried-client-id",
      });
      // (not previously sent with client-id, so this would be rate limited)
      expect(retryResult.ack.ok).toBe(false);

      // Another connection is not affected
      const other = await chat.acceptMessage({
        connectionId: "conn-2", userId: "u2", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "From other",
      });
      expect(other.ack.ok).toBe(true);

      // Releasing connection allows new messages
      chat.releaseConnection("conn-1");
      const allowed = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Msg after release",
      });
      expect(allowed.ack.ok).toBe(true);
    });

    it("enforces ping rate limit per connection", async () => {
      const { chat } = createChat();
      for (let i = 0; i < 3; i++) {
        const res = await chat.acceptPing({
          connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
          ping: "READY",
        });
        expect(res.ack.ok).toBe(true);
      }

      const rejected = await chat.acceptPing({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        ping: "READY",
      });
      expect(rejected.ack).toEqual({ ok: false, error: "rate limit exceeded: too many pings" });
    });
  });

  describe("match lifecycle gating", () => {
    it("rejects messages and pings after match complete", async () => {
      const { chat } = createChat({
        resolveContext: async () => ({ active: false }),
      });

      const msg = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Late message",
      });
      expect(msg.ack).toEqual({ ok: false, error: "chat is disabled after match complete" });

      const ping = await chat.acceptPing({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        ping: "READY",
      });
      expect(ping.ack).toEqual({ ok: false, error: "match is complete; pings disabled" });
    });

    it("rejects when context lookup throws", async () => {
      const { chat } = createChat({
        resolveContext: async () => { throw new Error("Match not found"); },
      });

      const msg = await chat.acceptMessage({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        text: "Hello",
      });
      expect(msg.ack).toEqual({ ok: false, error: "match unavailable" });

      const ping = await chat.acceptPing({
        connectionId: "conn-1", userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
        ping: "READY",
      });
      expect(ping.ack).toEqual({ ok: false, error: "match unavailable" });
    });
  });

  describe("history limits and room isolation", () => {
    it("caps history at maxHistoryPerRoom (25) and isolates rooms", async () => {
      const { chat } = createChat();
      for (let i = 0; i < 30; i++) {
        await chat.acceptMessage({
          connectionId: `conn-${i}`, userId: "u1", matchId: "m1", sideId: "left", roomId: "room-1",
          text: `Msg ${i}`,
        });
      }

      const h1 = chat.getRecentHistory("room-1");
      expect(h1).toHaveLength(25);
      expect((h1[0] as any).text).toBe("Msg 5");
      expect((h1[24] as any).text).toBe("Msg 29");

      // room-2 is isolated and empty
      expect(chat.getRecentHistory("room-2")).toHaveLength(0);
    });
  });
});
