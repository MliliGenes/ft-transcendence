import { describe, expect, it } from "vitest";
import { TeamChatClient } from "./chat.js";

const authCtx = {
  matchId: "m1",
  sideId: "left",
  userId: "u1",
  displayName: "User 1",
  roomId: "room-1",
  active: true,
  phase: "coding",
};

describe("TeamChatClient local invariants", () => {
  it("deduplicates messages and pings by ID", () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });

    let notifyCount = 0;
    client.subscribe(() => {
      notifyCount++;
    });

    client.applyIncomingEntry({
      id: "msg-1",
      matchId: "m1",
      sideId: "left",
      senderUserId: "u1",
      text: "hello team",
      timestamp: 1000,
      type: "text",
    });

    expect(client.getMessages().length).toBe(1);
    expect(notifyCount).toBe(1);

    // Replay duplicate msg-1 (e.g. from history + broadcast race)
    client.applyIncomingEntry({
      id: "msg-1",
      matchId: "m1",
      sideId: "left",
      senderUserId: "u1",
      text: "hello team",
      timestamp: 1000,
      type: "text",
    });

    expect(client.getMessages().length).toBe(1);
    expect(notifyCount).toBe(1); // not re-notified
  });

  it("handles contextual pings with correct type and payload", () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });

    client.applyIncomingEntry({
      id: "ping-1",
      matchId: "m1",
      sideId: "left",
      senderUserId: "u2",
      ping: "CHECK_EDGE_CASE",
      timestamp: 2000,
      type: "ping",
    });

    const entries = client.getMessages();
    expect(entries.length).toBe(1);
    expect(entries[0].type).toBe("ping");
    if (entries[0].type === "ping") {
      expect(entries[0].ping).toBe("CHECK_EDGE_CASE");
      expect(entries[0].senderUserId).toBe("u2");
    }
  });

  it("disconnect cleans up subscribers and resets state", () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });

    client.disconnect();
    expect(client.status).toBe("disconnected");
  });

  it("rejects sending when disconnected or message is empty", async () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });

    await expect(client.sendMessage("hello")).rejects.toThrow("Chat is disconnected");
    await expect(client.sendPing("READY")).rejects.toThrow("Chat is disconnected");

    // Connect state mock via test helper
    client.setAuthorizedForTest(authCtx);
    (client as any).socket = { connected: true };
    (client as any).lifetime = new AbortController();

    await expect(client.sendMessage("   ")).rejects.toThrow("Empty message");
  });

  it("enforces identifier uniqueness across differing message texts", async () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });
    client.setAuthorizedForTest(authCtx);
    (client as any).lifetime = new AbortController();
    (client as any).socket = {
      connected: true,
      timeout: () => ({
        emit: () => {},
      }),
    };

    // First send starts pending unconfirmed record
    const p1 = client.sendMessage("original text", "custom-id-1");
    p1.catch(() => {});

    // Reusing the same id with different text must fail synchronously
    await expect(client.sendMessage("different text", "custom-id-1")).rejects.toThrow(
      "Message identifier already used",
    );
  });

  it("bounds unconfirmed messages at 100 entries", async () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });
    client.setAuthorizedForTest(authCtx);
    (client as any).lifetime = new AbortController();
    (client as any).socket = {
      connected: true,
      timeout: () => ({
        emit: () => {},
      }),
    };

    for (let i = 0; i < 100; i++) {
      client.sendMessage(`message ${i}`).catch(() => {});
    }

    await expect(client.sendMessage("message 101")).rejects.toThrow(
      "Retry an unconfirmed message before sending more",
    );
  });
});
