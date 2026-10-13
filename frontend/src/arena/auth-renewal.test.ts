import { afterEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import { TestSocket } from "../../test/socket.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

import { AuthExpiredError, SocketArenaTransport } from "./socket.js";
import { TeamChatClient } from "./chat.js";
import { CollabClient } from "./collab.js";
import { LobbyClient } from "./lobby.js";

const ME = { id: "user-left", username: "left" };

function jwt(expiresAtMs: number): string {
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ exp: Math.floor(expiresAtMs / 1000) })}.sig`;
}

function serverSnapshot() {
  return {
    mode: "1v1" as const,
    roundPhase: "CODING" as const,
    round: 1,
    totalRounds: 1,
    remainingMs: 10_000,
    problem: { id: "problem-1", title: "Problem", description: "", examples: [] },
    tests: [],
    mySide: "left",
    sides: {
      left: { status: "coding" as const, submissions: 0, presence: "online" as const },
      right: { status: "coding" as const, submissions: 0, presence: "online" as const },
    },
    reveal: null,
    revision: 7,
    pendingEvaluation: false,
    final: null,
  };
}

function authHarness(nextToken = "access-2") {
  let clientToken: string | null = jwt(Date.now() + 3600_000);
  let serverToken: string | null = clientToken;
  const renewals: string[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: { headers?: Record<string, string>; body?: unknown }) => {
    const url = String(input);
    const auth = init?.headers?.Authorization ?? init?.headers?.authorization;
    if (url.endsWith("/accounts/me")) {
      if (auth === `Bearer ${serverToken}`) return { ok: true, status: 200, json: async () => ME };
      return { ok: false, status: 401, json: async () => ({ error: "expired" }) };
    }
    if (auth !== `Bearer ${serverToken}`) {
      return { ok: false, status: 401, json: async () => ({ error: "expired" }) };
    }
    return { ok: true, status: 200, json: async () => serverSnapshot() };
  });
  vi.stubGlobal("fetch", fetchMock);
  const sockets: TestSocket[] = [];
  vi.mocked(io).mockImplementation(() => {
    const socket = new TestSocket();
    sockets.push(socket);
    return socket as unknown as ReturnType<typeof io>;
  });
  return {
    fetchMock,
    sockets,
    getAccessToken: () => clientToken,
    onAuthExpired: async () => {
      renewals.push("renew");
      clientToken = nextToken;
      serverToken = nextToken;
    },
    renewals,
    /** Server stops accepting the client's token (expiry/revocation). */
    expireClient: () => {
      serverToken = "dead-token";
    },
    /** Client holds a different token (rotation / near-expiry fixtures). */
    setToken: (value: string | null) => {
      clientToken = value;
    },
  };
}

async function connectLive(harness: ReturnType<typeof authHarness>, matchId = "match-1") {
  const transport = new SocketArenaTransport({
    apiBase: "https://auth.test",
    socketBase: "http://arena.test",
    matchId,
    getAccessToken: harness.getAccessToken,
    onAuthExpired: harness.onAuthExpired,
  });
  const connecting = transport.connect();
  for (let n = 0; n < 100; n++) await Promise.resolve();
  harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
  await connecting;
  return transport;
}

describe("authenticated Game wiring (no transport recreation)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("resolves the player id from /accounts/me and authenticates HTTP + socket with Bearer", async () => {
    const harness = authHarness();
    const transport = await connectLive(harness);
    const meCall = harness.fetchMock.mock.calls.find(([url]) => String(url).endsWith("/accounts/me"));
    expect(meCall?.[1]?.headers?.Authorization).toMatch(/^Bearer /);
    const ioCall = vi.mocked(io).mock.calls.at(-1)?.[1] as { auth?: Record<string, string> };
    expect(ioCall?.auth?.accessToken).toBe(harness.getAccessToken());
    expect(ioCall?.auth?.matchId).toBe("match-1");
    expect(ioCall?.auth).not.toHaveProperty("userId");
    const snapshotCall = harness.fetchMock.mock.calls.find(([url]) => String(url).includes("/matches/"));
    expect(snapshotCall?.[1]?.headers?.Authorization).toMatch(/^Bearer /);
    expect(transport.snapshot().revision).toBe(7);
    transport.disconnect();
  });

  it("401 on a command renews, swaps a fresh socket into the same transport, and never resends the mutation", async () => {
    const harness = authHarness();
    const transport = await connectLive(harness);
    const postsBefore = harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST").length;
    harness.expireClient();
    const failed = transport.submit({ code: "x", language: "Python" });
    for (let n = 0; n < 200 && harness.sockets.length < 2; n++) await Promise.resolve();
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await expect(failed).rejects.toBeInstanceOf(AuthExpiredError);
    expect(harness.renewals).toEqual(["renew"]);
    // Same transport instance, fresh socket attached with the rotated token.
    expect(harness.sockets.length).toBeGreaterThan(1);
    const latestAuth = vi.mocked(io).mock.calls.at(-1)?.[1] as { auth?: Record<string, string> };
    expect(latestAuth?.auth?.accessToken).toBe("access-2");
    // Baselines refetched, but the submit POST was never replayed: exactly
    // the initial (rejected) attempt exists.
    const postsAfter = harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST").length;
    expect(postsAfter).toBe(postsBefore + 1);
    expect(harness.fetchMock.mock.calls.some(([url]) => String(url).endsWith("/snapshot"))).toBe(true);
    transport.disconnect();
  });

  it("renewal keeps the pending submit identifiers (no id rotation on reconnect)", async () => {
    const harness = authHarness();
    const transport = await connectLive(harness);
    harness.expireClient();
    const failedSubmit = transport.submit({ code: "same", language: "Python" });
    for (let n = 0; n < 200 && harness.sockets.length < 2; n++) await Promise.resolve();
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await expect(failedSubmit).rejects.toBeInstanceOf(AuthExpiredError);
    const firstPost = harness.fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/submit") && (init as RequestInit)?.method === "POST",
    );
    const firstBody = JSON.parse(String(firstPost?.[1]?.body));
    // The kept identifiers are reused by the deliberate later resubmit.
    await transport.submit({ code: "same", language: "Python" });
    const posts = harness.fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith("/submit") && (init as RequestInit)?.method === "POST",
    );
    expect(posts.length).toBe(2);
    const secondBody = JSON.parse(String(posts[1]?.[1]?.body));
    expect(secondBody.submissionId).toBe(firstBody.submissionId);
    expect(secondBody.evaluationId).toBe(firstBody.evaluationId);
    transport.disconnect();
  });

  it("a missing setReady ack is a renew+reconnect signal, never a blind retry", async () => {
    const harness = authHarness();
    const transport = await connectLive(harness);
    const socket = harness.sockets.at(-1)!;
    const emitsBefore = socket.outgoing.length;
    // Server suppresses the ack (auth/runtime loss): respond with undefined.
    const ready = transport.setReady(true);
    for (let n = 0; n < 50; n++) await Promise.resolve();
    const pending = socket.outgoing.at(-1)!;
    expect(pending.event).toBe("setReady");
    pending.ack(undefined);
    // The renew+reconnect path needs its fresh baseline before it can throw.
    for (let n = 0; n < 200 && harness.sockets.length < 2; n++) await Promise.resolve();
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await expect(ready).rejects.toBeInstanceOf(AuthExpiredError);
    expect(harness.renewals).toEqual(["renew"]);
    // No resend of the readiness command on the fresh socket.
    const fresh = harness.sockets.at(-1)!;
    expect(fresh.outgoing.filter((o) => o.event === "setReady").length).toBe(0);
    expect(socket.outgoing.length).toBe(emitsBefore + 1);
    transport.disconnect();
  });

  it("renews proactively before connect when the token is near expiry", async () => {
    const harness = authHarness();
    harness.setToken(jwt(Date.now() + 5_000));
    const transport = new SocketArenaTransport({
      apiBase: "https://auth.test",
      socketBase: "http://arena.test",
      matchId: "match-1",
      getAccessToken: harness.getAccessToken,
      onAuthExpired: harness.onAuthExpired,
    });
    const connecting = transport.connect();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await connecting;
    expect(harness.renewals).toEqual(["renew"]);
    transport.disconnect();
  });

  it("chat keeps retry identities and collab keeps the Yjs document across explicit renewal", async () => {
    const chat = new TeamChatClient({
      baseUrl: "http://arena.test",
      userId: "user-left",
      matchId: "match-1",
      getAccessToken: () => "access-1",
    });
    chat.applyIncomingEntry({ id: "m-1", kind: "message", userId: "user-left", at: 1, text: "hi" } as never);
    chat.renewSocket().catch(() => {});
    expect(chat.getMessages().map((m) => m.id)).toEqual(["m-1"]);

    const collab = new CollabClient({
      baseUrl: "http://arena.test",
      userId: "user-left",
      matchId: "match-1",
      displayName: "left",
      getAccessToken: () => "access-1",
    });
    const doc = collab.doc;
    collab.renewSocket().catch(() => {});
    expect(collab.doc).toBe(doc);
    collab.dispose();
    chat.disconnect();
  });

  it("lobby sends Bearer and renews once on 401", async () => {
    let token = "access-1";
    const fetchMock = vi.fn(async (input: unknown, init?: { headers?: Record<string, string>; method?: string }) => {
      const auth = init?.headers?.Authorization ?? init?.headers?.authorization;
      if (auth !== "Bearer access-2") {
        return { ok: false, status: 401, json: async () => ({ error: "expired" }) };
      }
      return { ok: true, status: 200, json: async () => ({ queue: null, room: null }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const lobby = new LobbyClient({
      apiBase: "https://auth.test",
      socketBase: "http://arena.test",
      getAccessToken: () => token,
      onAuthExpired: async () => {
        token = "access-2";
      },
    });
    await lobby.getActive();
    expect(token).toBe("access-2");
    const authed = fetchMock.mock.calls.filter(
      ([, init]) => (init as { headers?: Record<string, string> })?.headers?.Authorization === "Bearer access-2",
    );
    expect(authed.length).toBeGreaterThan(0);
    lobby.disconnect();
  });
});
