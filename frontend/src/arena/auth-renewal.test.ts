import { afterEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import { TestSocket } from "../../test/socket.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

import { AuthExpiredError, SocketArenaTransport } from "./socket.js";
import { TeamChatClient } from "./chat.js";
import { CollabClient } from "./collab.js";
import { LobbyClient } from "./lobby.js";
import { LobbySession } from "./lobby-session.js";

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
  it("a proactive Submit waits for the renewed socket baseline", async () => {
    const harness = authHarness();
    const transport = await connectLive(harness);
    harness.setToken(jwt(Date.now() + 5_000));
    const action = transport.submit({ code: "pending", language: "Python" });
    for (let n = 0; n < 100; n++) await Promise.resolve();
    const posts = () => harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST");
    expect(posts()).toHaveLength(0);
    expect(harness.sockets).toHaveLength(2);
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await action;
    expect(posts()).toHaveLength(1);
    transport.disconnect();
  });

  it("a disconnect during proactive renewal prevents the pending Submit", async () => {
    const harness = authHarness();
    let release!: () => void;
    const renewal = new Promise<void>((resolve) => { release = resolve; });
    const transport = new SocketArenaTransport({
      apiBase: "https://auth.test", socketBase: "http://arena.test", matchId: "match-1",
      getAccessToken: harness.getAccessToken,
      onAuthExpired: async () => { await renewal; await harness.onAuthExpired(); },
    });
    const connecting = transport.connect();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await connecting;
    harness.setToken(jwt(Date.now() + 5_000));
    const action = transport.submit({ code: "old", language: "Python" });
    const rejected = expect(action).rejects.toThrow(/cancelled|disconnected/);
    transport.disconnect();
    release();
    await rejected;
    expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
  });

  it("concurrent commands share renewal and cannot pass a delayed baseline", async () => {
    const harness = authHarness();
    const transport = await connectLive(harness);
    harness.setToken("access-2");
    const renewing = transport.renewSocket();
    const secondRenewal = transport.renewSocket();
    let recovered = false;
    void secondRenewal.then(() => { recovered = true; });
    for (let n = 0; n < 100; n++) await Promise.resolve();
    expect(recovered).toBe(false);
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await Promise.all([renewing, secondRenewal]);
    expect(recovered).toBe(true);
    transport.disconnect();
  });

  it("Lobby never replays a rejected Create Room mutation after renewal", async () => {
    let token = "access-1";
    const posts: string[] = [];
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
      posts.push(init?.method ?? "GET");
      return { ok: false, status: 401, json: async () => ({ error: "expired" }) };
    });
    const lobby = new LobbyClient({
      apiBase: "https://auth.test", socketBase: "http://arena.test",
      getAccessToken: () => token, onAuthExpired: async () => { token = "access-2"; },
    });
    await expect(lobby.createRoom("1v1")).rejects.toThrow();
    expect(posts).toEqual(["POST"]);
    expect(token).toBe("access-2");
    lobby.disconnect();
  });

  it("Lobby renewal waits for active state and room rejoin before sending Ready", async () => {
    let token = jwt(Date.now() + 3600_000);
    let release!: () => void;
    let delay = false;
    const baseline = new Promise<void>((resolve) => { release = resolve; });
    const requests: string[] = [];
    const room = {
      room: { id: "room-1", code: "ABCDEF", mode: "1v1" as const, ownerUserId: "user-left", status: "open" as const, createdAt: 1, expiresAt: 1000, matchId: null },
      members: [{ roomId: "room-1", userId: "user-left", sideId: "left" as const, ready: false, joinedAt: 1 }],
    };
    vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${String(input)}`);
      if (String(input).endsWith("/active")) {
        if (delay) await baseline;
        return { ok: true, status: 200, json: async () => ({ queue: null, room }) };
      }
      return { ok: true, status: 200, json: async () => room };
    });
    const sockets: TestSocket[] = [];
    vi.mocked(io).mockImplementation(() => {
      const socket = new TestSocket(); sockets.push(socket);
      queueMicrotask(() => socket.connect());
      return socket as unknown as ReturnType<typeof io>;
    });
    const lobby = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => token, onAuthExpired: async () => { token = "access-2"; } });
    const session = new LobbySession(lobby, vi.fn());
    await session.start();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    delay = true;
    token = jwt(Date.now() + 5_000);
    const ready = session.setReady(true);
    for (let n = 0; n < 100; n++) await Promise.resolve();
    expect(sockets).toHaveLength(2);
    expect(requests.filter((request) => request.startsWith("POST"))).toHaveLength(0);
    release();
    await ready;
    expect(sockets[1]!.outgoing.some((event) => event.event === "lobby:join_room")).toBe(true);
    expect(requests.filter((request) => request.startsWith("POST"))).toHaveLength(1);
    session.stop();
  });

  it.each([false, true])("Lobby recovery waits for a superseding read (failure=%s)", async (failLatest) => {
    let token = "access-1";
    let delayed = false;
    const reads: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
    const posts: string[] = [];
    const room = {
      room: { id: "room-1", code: "ABCDEF", mode: "1v1" as const, ownerUserId: "user-left", status: "open" as const, createdAt: 1, expiresAt: 1000, matchId: null },
      members: [{ roomId: "room-1", userId: "user-left", sideId: "left" as const, ready: false, joinedAt: 1 }],
    };
    const response = { ok: true, status: 200, json: async () => ({ queue: null, room }) };
    vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(String(input)); return response; }
      if (delayed) return new Promise((resolve, reject) => reads.push({ resolve, reject }));
      return response;
    });
    const sockets: TestSocket[] = [];
    vi.mocked(io).mockImplementation(() => {
      const socket = new TestSocket(); sockets.push(socket);
      return socket as unknown as ReturnType<typeof io>;
    });
    const client = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => token, onAuthExpired: async () => {} });
    const session = new LobbySession(client, vi.fn());
    await session.start();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    try {
      delayed = true;
      token = "access-2";
      let recovered = false;
      const renewal = client.renewSocket();
      const outcome = renewal.then(() => { recovered = true; return null; }, (error: Error) => error);
      for (let n = 0; n < 100; n++) await Promise.resolve();
      sockets[1]!.server("lobby.roomUpdated", { roomId: "room-1", ...room });
      for (let n = 0; n < 100; n++) await Promise.resolve();
      expect(reads).toHaveLength(2);
      reads[0]!.resolve(response);
      for (let n = 0; n < 100; n++) await Promise.resolve();
      const command = client.setReady("room-1", true).then(() => null, (error: Error) => error);
      for (let n = 0; n < 100; n++) await Promise.resolve();
      expect(recovered).toBe(false);
      expect(posts).toHaveLength(0);
      expect(sockets[1]!.outgoing.filter((event) => event.event === "lobby:join_room")).toHaveLength(0);
      delayed = false;
      if (failLatest) reads[1]!.reject(new Error("active unavailable"));
      else reads[1]!.resolve(response);
      const result = await outcome;
      if (failLatest) {
        expect(result?.message).toBe("active unavailable");
        expect((await command)?.message).toBe("active unavailable");
        expect(posts).toHaveLength(0);
      } else {
        expect(result).toBeNull();
        expect(await command).toBeNull();
        expect(posts).toHaveLength(1);
        expect(sockets[1]!.outgoing.some((event) => event.event === "lobby:join_room")).toBe(true);
      }
    } finally {
      session.stop();
      for (const read of reads) read.resolve(response);
    }
  });

  it("a superseding legacy queue read cannot make Lobby recovery wait on queue cleanup", async () => {
    let token = "access-1";
    let delayed = false;
    let cancelled = false;
    const reads: Array<(value: unknown) => void> = [];
    const waiting = { queue: { id: "queue-1", userId: "user-left", mode: "1v1", status: "waiting", joinedAt: 1, matchedMatchId: null }, room: null };
    const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") { cancelled = true; return response({ cancelled: true, matched: false }); }
      if (delayed) return new Promise((resolve) => reads.push(resolve));
      return response(token === "access-2" && !cancelled ? waiting : { queue: null, room: null });
    });
    const sockets: TestSocket[] = [];
    vi.mocked(io).mockImplementation(() => { const socket = new TestSocket(); sockets.push(socket); return socket as unknown as ReturnType<typeof io>; });
    const client = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => token, onAuthExpired: async () => {} });
    const session = new LobbySession(client, vi.fn());
    await session.start();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    try {
      delayed = true;
      token = "access-2";
      let recovered = false;
      const renewal = client.renewSocket();
      void renewal.then(() => { recovered = true; }, () => {});
      for (let n = 0; n < 100; n++) await Promise.resolve();
      sockets[1]!.server("lobby.roomUpdated", {});
      for (let n = 0; n < 100; n++) await Promise.resolve();
      reads[1]!(response(waiting));
      for (let n = 0; n < 100; n++) await Promise.resolve();
      // Drain any cleanup read which the old implementation started early.
      for (const resolve of reads.slice(2)) resolve(response(waiting));
      for (let n = 0; n < 100; n++) await Promise.resolve();
      delayed = false;
      reads[0]!(response(waiting));
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(recovered).toBe(true);
      await renewal;
      expect(cancelled).toBe(true);
    } finally { session.stop(); for (const resolve of reads) resolve(response({ queue: null, room: null })); }
  });

  it("network return shares Match renewal and releases Submit only after its baseline", async () => {
    const browser = new EventTarget();
    vi.stubGlobal("window", browser);
    const harness = authHarness();
    const transport = await connectLive(harness);
    try {
      await harness.onAuthExpired();
      let recovered = false;
      const renewal = transport.renewSocket();
      void renewal.then(() => { recovered = true; }, () => {});
      const submit = transport.submit({ code: "source", language: "Python" });
      void submit.catch(() => {});
      browser.dispatchEvent(new Event("offline"));
      browser.dispatchEvent(new Event("online"));
      for (let n = 0; n < 100; n++) await Promise.resolve();
      expect(recovered).toBe(false);
      expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
      expect(harness.sockets).toHaveLength(2);
      harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
      await Promise.all([renewal, submit]);
      expect(recovered).toBe(true);
      expect(transport.connection()).toBe("connected");
      expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(1);
    } finally { transport.disconnect(); }
  });

  it.each(["Match", "Lobby"])("production refuses the legacy %s development identity constructor", (kind) => {
    vi.stubEnv("DEV", false);
    try {
      expect(() => kind === "Match"
        ? new SocketArenaTransport({ baseUrl: "http://arena.test", userId: "forged", matchId: "old" })
        : new LobbyClient("http://arena.test", "forged")).toThrow(/development/i);
    } finally { vi.unstubAllEnvs(); }
  });

  it("concurrent proactive Match commands share one token renewal", async () => {
    const harness = authHarness();
    let release!: () => void;
    let renewals = 0;
    const renewal = new Promise<void>((resolve) => { release = resolve; });
    const transport = new SocketArenaTransport({ apiBase: "https://auth.test", socketBase: "http://arena.test", matchId: "match-1",
      getAccessToken: harness.getAccessToken, onAuthExpired: async () => { renewals++; await renewal; await harness.onAuthExpired(); } });
    const connect = transport.connect();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await connect;
    harness.setToken(jwt(Date.now() + 5_000));
    const first = transport.beginCoding();
    const second = transport.submit({ code: "source", language: "Python" });
    for (let n = 0; n < 100; n++) await Promise.resolve();
    expect(renewals).toBe(1);
    release();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    harness.sockets.at(-1)!.server("snapshot", serverSnapshot());
    await Promise.all([first, second]);
    transport.disconnect();
  });

  it("concurrent proactive Lobby commands share one token renewal", async () => {
    let token = jwt(Date.now() + 5_000);
    let release!: () => void;
    let renewals = 0;
    const renewal = new Promise<void>((resolve) => { release = resolve; });
    const lobby = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => token,
      onAuthExpired: async () => { renewals++; await renewal; token = "fresh-token"; } });
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ room: {}, members: [] }) }));
    const first = lobby.createRoom("1v1");
    const second = lobby.joinRoom("ABCDEF");
    for (let n = 0; n < 100; n++) await Promise.resolve();
    expect(renewals).toBe(1);
    release();
    await Promise.all([first, second]);
    lobby.disconnect();
  });

  it("Lobby recovery cancels a legacy waiting queue without waiting on itself", async () => {
    let cancelled = false;
    vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") {
        cancelled = true;
        return { ok: true, status: 200, json: async () => ({ cancelled: true, matched: false }) };
      }
      return { ok: true, status: 200, json: async () => ({ room: null, queue: cancelled ? null : {
        id: "queue-1", userId: "user-left", mode: "1v1", status: "waiting", joinedAt: 1, matchedMatchId: null,
      } }) };
    });
    vi.mocked(io).mockImplementation(() => new TestSocket() as unknown as ReturnType<typeof io>);
    const lobby = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => "access-1", onAuthExpired: async () => {} });
    const session = new LobbySession(lobby, vi.fn());
    await session.start();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    session.stop();
    expect(cancelled).toBe(true);
  });

  it.each([1000, -60_000])("idle server expiry renews Match at browser clock offset %ims without a command and waits for its baseline", async (clockOffset) => {
    const harness = authHarness();
    const transport = await connectLive(harness);
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000 + clockOffset);
    try {
      harness.sockets[0]!.server("disconnect", "io server disconnect");
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(harness.renewals).toEqual(["renew"]);
      expect(harness.sockets).toHaveLength(2);
      expect(transport.connection()).not.toBe("connected");
      expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
      harness.sockets[1]!.server("snapshot", serverSnapshot());
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(transport.connection()).toBe("connected");
      expect(transport.snapshot().revision).toBe(7);
      expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
    } finally { now.mockRestore(); transport.disconnect(); }
  });

  it.each([1000, -60_000])("idle Lobby expiry restores passive membership at browser clock offset %ims without Ready", async (clockOffset) => {
    let token = jwt(Date.now() + 3600_000);
    let renewals = 0;
    let baselines = 0;
    const sockets: TestSocket[] = [];
    vi.mocked(io).mockImplementation(() => { const socket = new TestSocket(); sockets.push(socket); return socket as unknown as ReturnType<typeof io>; });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ queue: null, room: null }) })));
    const hint = vi.fn();
    const lobby = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => token,
      onAuthExpired: async () => { renewals++; token = "new-access"; } });
    lobby.connectSocket({ onConnect: async () => { baselines++; lobby.joinRoomChannel("room-1"); }, onRoomUpdated: hint });
    for (let n = 0; n < 100; n++) await Promise.resolve();
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000 + clockOffset);
    try {
      sockets[0]!.server("disconnect", "io server disconnect");
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(renewals).toBe(1);
      expect(sockets).toHaveLength(2);
      expect(baselines).toBe(2);
      expect(sockets[1]!.outgoing.filter(item => item.event === "lobby:join_room")).toHaveLength(1);
      sockets[1]!.server("lobby.roomUpdated", { roomId: "room-1" });
      expect(hint).toHaveBeenCalledOnce();
      expect(vi.mocked(fetch).mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
    } finally { now.mockRestore(); lobby.disconnect(); }
  });

  it("disposing during idle-expiry renewal cannot attach a new Match socket", async () => {
    const harness = authHarness();
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const transport = new SocketArenaTransport({ apiBase: "https://auth.test", socketBase: "http://arena.test", matchId: "match-1",
      getAccessToken: harness.getAccessToken, onAuthExpired: async () => { await held; await harness.onAuthExpired(); } });
    const connecting = transport.connect();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    harness.sockets[0]!.server("snapshot", serverSnapshot());
    await connecting;
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000 + 1000);
    try {
      harness.sockets[0]!.server("disconnect", "io server disconnect");
      for (let n = 0; n < 100; n++) await Promise.resolve();
      transport.disconnect();
      release();
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(harness.sockets).toHaveLength(1);
      expect(transport.connection()).toBe("offline");
      expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
    } finally { release(); now.mockRestore(); transport.disconnect(); }
  });

  it("an unavailable idle-expiry refresh retains Match state and permits explicit connect retry", async () => {
    const harness = authHarness();
    let attempts = 0;
    const transport = new SocketArenaTransport({ apiBase: "https://auth.test", socketBase: "http://arena.test", matchId: "match-1",
      getAccessToken: harness.getAccessToken, onAuthExpired: async () => { if (++attempts === 1) throw new Error("Authentication unavailable"); await harness.onAuthExpired(); } });
    const connecting = transport.connect();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    harness.sockets[0]!.server("snapshot", serverSnapshot());
    await connecting;
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000 + 1000);
    try {
      harness.sockets[0]!.server("disconnect", "io server disconnect");
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(transport.connection()).toBe("offline");
      expect(transport.connectionError).toBe("Authentication unavailable");
      expect(transport.snapshot().revision).toBe(7);
      const retry = transport.connect();
      for (let n = 0; n < 200; n++) await Promise.resolve();
      harness.sockets[1]!.server("snapshot", serverSnapshot());
      await retry;
      expect(attempts).toBe(2);
      expect(transport.connection()).toBe("connected");
      expect(transport.connectionError).toBeNull();
      expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
    } finally { now.mockRestore(); transport.disconnect(); }
  });

  it("an unavailable passive Lobby renewal permits deliberate Ready recovery without replay", async () => {
    let token = jwt(Date.now() + 3600_000);
    let attempts = 0;
    let baselines = 0;
    const sockets: TestSocket[] = [];
    vi.mocked(io).mockImplementation(() => { const socket = new TestSocket(); sockets.push(socket); return socket as unknown as ReturnType<typeof io>; });
    const requests: string[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => { requests.push(init?.method ?? "GET"); return { ok: true, status: 200, json: async () => ({ room: {}, members: [] }) }; });
    const lobby = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => token,
      onAuthExpired: async () => { if (++attempts === 1) throw new Error("Authentication unavailable"); token = "new-access"; } });
    lobby.connectSocket({ onConnect: () => { baselines++; } });
    for (let n = 0; n < 100; n++) await Promise.resolve();
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000 + 1000);
    try {
      sockets[0]!.server("disconnect", "io server disconnect");
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(attempts).toBe(1);
      expect(requests).toEqual([]);
      await lobby.setReady("room-1", true);
      expect(attempts).toBe(2);
      expect(baselines).toBe(2);
      expect(requests).toEqual(["POST"]);
    } finally { now.mockRestore(); lobby.disconnect(); }
  });

  it("definitively expired idle Match renewal cannot reconnect or send a mutation", async () => {
    const harness = authHarness();
    const transport = new SocketArenaTransport({ apiBase: "https://auth.test", socketBase: "http://arena.test", matchId: "match-1",
      getAccessToken: harness.getAccessToken, onAuthExpired: async () => { harness.setToken(null); } });
    const connecting = transport.connect();
    for (let n = 0; n < 100; n++) await Promise.resolve();
    harness.sockets[0]!.server("snapshot", serverSnapshot());
    await connecting;
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000 + 1000);
    try {
      harness.sockets[0]!.server("disconnect", "io server disconnect");
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(transport.connection()).toBe("offline");
      expect(harness.sockets).toHaveLength(1);
      expect(transport.snapshot().revision).toBe(7);
      await expect(transport.submit({ code: "retained", language: "Python" })).rejects.toThrow();
      expect(harness.fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST")).toHaveLength(0);
    } finally { now.mockRestore(); transport.disconnect(); }
  });

  it("definitively expired passive Lobby renewal cannot reconnect or replay Ready", async () => {
    let token: string | null = jwt(Date.now() + 3600_000);
    const sockets: TestSocket[] = [];
    vi.mocked(io).mockImplementation(() => { const socket = new TestSocket(); sockets.push(socket); return socket as unknown as ReturnType<typeof io>; });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const lobby = new LobbyClient({ apiBase: "https://auth.test", socketBase: "http://arena.test", getAccessToken: () => token,
      onAuthExpired: async () => { token = null; } });
    lobby.connectSocket({ onConnect: () => {} });
    for (let n = 0; n < 100; n++) await Promise.resolve();
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000 + 1000);
    try {
      sockets[0]!.server("disconnect", "io server disconnect");
      for (let n = 0; n < 200; n++) await Promise.resolve();
      expect(sockets).toHaveLength(1);
      await expect(lobby.setReady("room-1", true)).rejects.toThrow(/Session expired/);
      expect(sockets).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { now.mockRestore(); lobby.disconnect(); }
  });

});
