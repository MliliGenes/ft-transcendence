import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { TestSocket } from "../../test/socket.js";
import { SocketArenaTransport } from "./socket.js";
import { TeamChatClient } from "./chat.js";
import { CollabClient, type CollabSyncPayload } from "./collab.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

const snapshot = (revision = 1) => ({
  mode: "2v2", roundPhase: "CODING", round: 1, totalRounds: 1, remainingMs: 10_000,
  problem: { id: "p", title: "Problem", description: "", examples: [] }, tests: [], mySide: "left",
  sides: { left: { status: "coding", submissions: 0, presence: "online" }, right: { status: "coding", submissions: 0, presence: "online" } },
  reveal: null, revision, pendingEvaluation: false, final: null,
});
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const config = { baseUrl: "http://arena.test", userId: "u1", matchId: "m1" };
const auth = { matchId: "m1", sideId: "left", userId: "u1", teammateUserId: "u2" };
const sockets: TestSocket[] = [];
const cleanup: Array<() => void> = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function flush() { for (let n = 0; n < 10; n++) await Promise.resolve(); }
async function arena() {
  const client = new SocketArenaTransport(config);
  cleanup.push(() => client.disconnect());
  const wait = client.connect();
  await flush();
  const socket = sockets.at(-1)!;
  socket.server("snapshot", snapshot());
  await wait;
  return { client, socket };
}
async function chat() {
  const client = new TeamChatClient(config);
  cleanup.push(() => client.disconnect());
  const wait = client.connect();
  const socket = sockets.at(-1)!;
  socket.server("authorized", auth);
  await wait;
  return { client, socket };
}
function collab() {
  const client = new CollabClient({ ...config, displayName: "U1" });
  cleanup.push(() => client.dispose());
  return client;
}
function sync(source = "starter"): CollabSyncPayload {
  const doc = new Y.Doc();
  doc.getText("source").insert(0, source);
  const stateB64 = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  doc.destroy();
  return { roomId: "room", roundId: "round", side: "left", stateB64, source, revision: 1, language: "Python" };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(io).mockReset().mockImplementation(() => {
    const socket = new TestSocket();
    sockets.push(socket);
    return socket as unknown as ReturnType<typeof io>;
  });
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => response(snapshot())));
});
afterEach(() => {
  for (const stop of cleanup.splice(0)) stop();
  sockets.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("initial recoverable connection failures", () => {
  it.each(["arena", "chat", "collab"])("allows Socket.IO to retry a temporary %s connection failure within the bounded join", async (kind) => {
    const client = kind === "arena" ? new SocketArenaTransport(config)
      : kind === "chat" ? new TeamChatClient(config) : collab();
    cleanup.push(() => client.disconnect());
    const wait = client.connect();
    await flush();
    const socket = sockets.at(-1)!;
    socket.server("connect_error", new Error("temporary network failure"));
    await flush();
    expect(socket.disconnects).toBe(0);
    expect(socket.listeners("connect_error")).toHaveLength(2);
    socket.connect();
    if (kind === "arena") socket.server("snapshot", snapshot());
    else if (kind === "chat") socket.server("authorized", auth);
    else socket.server("sync", sync());
    await wait;
  });
});

describe("Arena transport lifetime", () => {
  it("cancels an initial fetch and ignores even a response that arrives after abort", async () => {
    const fetchResult = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn().mockReturnValue(fetchResult.promise);
    vi.stubGlobal("fetch", fetchMock);
    const client = new SocketArenaTransport(config);
    const wait = client.connect();
    expect(client.connect()).toBe(wait);
    const rejection = expect(wait).rejects.toThrow("cancelled");
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    client.disconnect();
    expect(signal.aborted).toBe(true);
    fetchResult.resolve(response(snapshot()));
    await rejection;
    expect(io).not.toHaveBeenCalled();
    expect(client.connection()).toBe("offline");
  });

  it("recovers when browser connectivity returns during the initial fetch", async () => {
    const browser = new EventTarget();
    vi.stubGlobal("window", browser);
    const fetched = deferred<ReturnType<typeof response>>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(fetched.promise));
    const client = new SocketArenaTransport(config);
    cleanup.push(() => client.disconnect());
    const wait = client.connect();
    browser.dispatchEvent(new Event("offline"));
    browser.dispatchEvent(new Event("online"));
    fetched.resolve(response(snapshot()));
    await flush();
    sockets[0]!.server("snapshot", snapshot());
    await wait;
    expect(client.connection()).toBe("connected");
  });

  it("stops a baseline wait immediately and prevents a retired socket from reviving it", async () => {
    const client = new SocketArenaTransport(config);
    const wait = client.connect();
    const rejection = expect(wait).rejects.toThrow("cancelled");
    await flush();
    const socket = sockets[0]!;
    const lateBaseline = socket.listeners("snapshot")[0]!;
    client.disconnect();
    await rejection;
    lateBaseline(snapshot(12));
    expect(client.connection()).toBe("offline");
    expect(client.snapshot().revision).toBe(1);
    expect(socket.listeners("snapshot")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for the server baseline on every automatic reconnect", async () => {
    const { client, socket } = await arena();
    socket.server("disconnect");
    socket.io.emit("reconnect");
    socket.connect();
    expect(client.isConnected).toBe(false);
    expect(client.connection()).toBe("reconnecting");
    await expect(client.run({ code: "source", language: "Python" })).rejects.toThrow("unavailable");
    socket.server("snapshot", snapshot(8));
    expect(client.connection()).toBe("connected");
    expect(client.snapshot().revision).toBe(8);
  });

  it("removes browser signals at stop and owns only one rejoin after an outage", async () => {
    const browser = new EventTarget();
    vi.stubGlobal("window", browser);
    const { client, socket } = await arena();
    const staleBaseline = socket.listeners("snapshot")[0]!;
    browser.dispatchEvent(new Event("offline"));
    browser.dispatchEvent(new Event("online"));
    browser.dispatchEvent(new Event("online"));
    expect(sockets).toHaveLength(2);
    const fresh = sockets[1]!;
    staleBaseline(snapshot(99));
    expect(client.connection()).toBe("connecting");
    fresh.server("snapshot", snapshot(3));
    await flush();
    client.disconnect();
    browser.dispatchEvent(new Event("offline"));
    browser.dispatchEvent(new Event("online"));
    expect(client.connection()).toBe("offline");
    expect(sockets).toHaveLength(2);
    expect(client.snapshot().revision).toBe(3);
  });

  it("discards an in-flight event refresh after disconnect", async () => {
    const { client, socket } = await arena();
    const fetchResult = deferred<ReturnType<typeof response>>();
    vi.mocked(fetch).mockReturnValueOnce(fetchResult.promise as Promise<Response>);
    socket.server("phase.changed", { revision: 8 });
    client.disconnect();
    fetchResult.resolve(response(snapshot(8)));
    await flush();
    expect(client.snapshot().revision).toBe(1);
    expect(client.connection()).toBe("offline");
  });

  it("cancels an old HTTP command without refreshing or replaying it in a new connection", async () => {
    const { client } = await arena();
    const completed = deferred<ReturnType<typeof response>>();
    vi.mocked(fetch).mockReturnValueOnce(completed.promise as Promise<Response>);
    const action = client.startRound();
    const rejection = expect(action).rejects.toThrow("cancelled");
    client.disconnect();
    const join = client.connect();
    await flush();
    sockets[1]!.server("snapshot", snapshot(4));
    await join;
    completed.resolve(response({ ok: true }));
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(client.connection()).toBe("connected");
    expect(client.snapshot().revision).toBe(4);
  });

  it("settles pending readiness on stop without leaving an acknowledgement timer", async () => {
    const { client } = await arena();
    const pending = client.setReady(true);
    const rejection = expect(pending).rejects.toThrow("confirmation");
    client.disconnect();
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Team chat lifetime and deliberate retries", () => {
  it("coalesces joins and re-authorizes after a reconnect", async () => {
    const client = new TeamChatClient(config);
    cleanup.push(() => client.disconnect());
    const wait = client.connect();
    expect(client.connect()).toBe(wait);
    expect(sockets).toHaveLength(1);
    const socket = sockets[0]!;
    socket.server("authorized", auth);
    await wait;
    socket.server("disconnect");
    socket.connect();
    expect(client.status).toBe("connecting");
    socket.server("authorized", auth);
    expect(client.status).toBe("connected");
    expect(socket.listeners("authorized")).toHaveLength(1);
  });

  it.each(["disconnect", "timeout"])("settles a denied or stalled join (%s)", async (mode) => {
    const client = new TeamChatClient(config);
    const wait = client.connect();
    const rejection = expect(wait).rejects.toThrow(mode === "timeout" ? "timed out" : "refused");
    const socket = sockets[0]!;
    if (mode === "timeout") await vi.advanceTimersByTimeAsync(10_000);
    else socket.server("disconnect");
    await rejection;
    expect(client.status).toBe("error");
    expect(socket.listeners("authorized")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports lost confirmation, then reuses the identifier only when the player retries", async () => {
    const { client, socket } = await chat();
    const first = client.sendMessage(" hello ");
    expect(client.sendMessage("hello")).toBe(first);
    const rejection = expect(first).rejects.toThrow("Retry");
    const identity = (socket.outgoing[0]!.payload as { clientMessageId: string }).clientMessageId;
    expect(identity).toBeTruthy();
    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(socket.outgoing).toHaveLength(1);
    const retry = client.sendMessage("hello");
    expect(socket.outgoing[1]!.payload).toMatchObject({ clientMessageId: identity });
    socket.outgoing[1]!.ack({ ok: true, id: "delivered-once" });
    await expect(retry).resolves.toBe("delivered-once");
    const deliberate = client.sendMessage("hello");
    expect(socket.outgoing[2]!.payload).not.toMatchObject({ clientMessageId: identity });
    socket.outgoing[2]!.ack({ ok: true, id: "new-message" });
    await deliberate;
  });

  it("keeps a retry identity across disconnect, but ignores late old-socket entries", async () => {
    const { client, socket } = await chat();
    const lateEntry = socket.listeners("message")[0]!;
    const pending = client.sendMessage("same text");
    const rejection = expect(pending).rejects.toThrow("confirmation");
    const identity = socket.outgoing[0]!.payload;
    client.disconnect();
    await rejection;
    const join = client.connect();
    const fresh = sockets[1]!;
    fresh.server("authorized", auth);
    await join;
    lateEntry({ id: "old", text: "late" });
    expect(client.getMessages()).toHaveLength(0);
    const retry = client.sendMessage("same text");
    expect(fresh.outgoing[0]!.payload).toEqual(identity);
    fresh.outgoing[0]!.ack({ ok: true, id: "original" });
    await retry;
  });

  it("bounds ping confirmation without replaying pings", async () => {
    const { client, socket } = await chat();
    const wait = client.sendPing("CHECK_EDGE_CASE");
    const rejection = expect(wait).rejects.toThrow("confirmation");
    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(socket.outgoing).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Round collaboration lifetime", () => {
  it("keeps the Round document for rejoin while owning one socket and baseline wait", async () => {
    const client = collab();
    const baseline = sync();
    const wait = client.connect();
    expect(client.connect()).toBe(wait);
    const first = sockets[0]!;
    first.server("sync", baseline);
    await wait;
    const doc = client.doc;
    client.disconnect();
    expect(doc.isDestroyed).toBe(false);
    const rejoin = client.connect();
    sockets[1]!.server("sync", baseline);
    await rejoin;
    expect(client.doc).toBe(doc);
    expect(client.getSource()).toBe("starter");
    expect(first.listeners("sync")).toHaveLength(0);
    expect(sockets[1]!.listeners("sync")).toHaveLength(1);
  });

  it("releases a retired Round, cancels its join and ignores late frames", async () => {
    const client = collab();
    const wait = client.connect();
    const rejection = expect(wait).rejects.toThrow("cancelled");
    const socket = sockets[0]!;
    const lateSync = socket.listeners("sync")[0]!;
    client.dispose();
    await rejection;
    lateSync(sync("old Round"));
    expect(client.getSource()).toBe("");
    expect(client.doc.isDestroyed).toBe(true);
    expect(client.awareness.getLocalState()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await expect(client.connect()).rejects.toThrow("disposed");
  });

  it("cleans up all handshake listeners after a timeout", async () => {
    const client = collab();
    const wait = client.connect();
    const rejection = expect(wait).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    expect(sockets[0]!.listeners("sync")).toHaveLength(0);
    expect(sockets[0]!.listeners("connect_error")).toHaveLength(0);
    expect(client.connection()).toBe("offline");
    client.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
