import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { mountAuthProvider } from "./helpers/auth-provider-harness.mjs";

test("same-origin lobby sockets use Nginx's Game service path", () => {
  const source = readFileSync(new URL("../lib/arena/lobby.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let socketOptions;
  const fakeSocket = { on() { return this; }, disconnect() {} };
  const exports = {};
  const context = {
    exports,
    module: { exports },
    require(name) {
      assert.equal(name, "socket.io-client");
      return { io(_url, options) { socketOptions = options; return fakeSocket; } };
    },
  };
  runInNewContext(compiled, context);

  const client = new context.module.exports.LobbyClient("", "player-1");
  const cleanup = client.connectSocket({});
  assert.equal(socketOptions.path, "/api/game/socket.io");
  cleanup();
});

function loadTypeScriptModule(relativePath, dependencies = {}, globals = {}) {
  const resolvedDeps = { ...dependencies };
  if (relativePath.includes("socket.ts") && !("../auth/client" in resolvedDeps)) {
    resolvedDeps["../auth/client"] = loadTypeScriptModule("../lib/auth/client.ts", {}, globals);
  }
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  runInNewContext(compiled, {
    exports: loadedModule.exports,
    module: loadedModule,
    require(name) {
      if (!(name in resolvedDeps)) throw new Error(`unexpected import: ${name}`);
      return resolvedDeps[name];
    },
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    console: { warn() {}, error() {} },
    ...globals,
  });
  return loadedModule.exports;
}

/** Mirrors socket.io-client: every server event reaches the catch-all listener too. */
class FakeSocket {
  constructor() {
    this.handlers = new Map();
    this.anyHandlers = [];
  }

  on(event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  onAny(handler) {
    this.anyHandlers.push(handler);
    return this;
  }

  disconnect() {
    this.connected = false;
    return this;
  }

  /** Local socket lifecycle event (connect/disconnect): never reaches onAny. */
  fire(event, payload) {
    if (event === "connect") this.connected = true;
    if (event === "disconnect") this.connected = false;
    this.handlers.get(event)?.(payload);
  }

  /** Server packet: reaches the catch-all listener and its own listener. */
  emitFromServer(event, payload) {
    for (const handler of this.anyHandlers) handler(event, payload);
    this.handlers.get(event)?.(payload);
  }
}

function matchSnapshot(revision) {
  return {
    mode: "1v1",
    roundPhase: "CODING",
    round: 1,
    totalRounds: 3,
    remainingMs: 120_000,
    problem: { title: "Even Ledger", description: "", examples: [], starters: { "C++": "" } },
    tests: [],
    mySide: "left",
    sides: {
      left: { status: "coding", submissions: 0, presence: "online" },
      right: { status: "coding", submissions: 0, presence: "online" },
    },
    reveal: null,
    revision,
    pendingEvaluation: false,
    final: null,
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await wait(10);
  }
  return predicate();
}

test("a burst of match events coalesces into one snapshot request that applies the newest revision", async () => {
  let socket;
  const requests = [];
  const inFlight = [];
  let serverRevision = 1;

  const socketModule = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io() {
          socket = new FakeSocket();
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
    },
    {
      fetch: (url) => {
        requests.push(url);
        const revision = serverRevision;
        return new Promise((resolve) => inFlight.push({ resolve, revision }));
      },
    },
  );

  const transport = new socketModule.SocketArenaTransport({
    baseUrl: "http://game.test",
    userId: "player-1",
    matchId: "match-1",
  });

  try {
    socket.fire("connect");
    await wait(0);
    assert.equal(requests.length, 1, "connecting fetches exactly one snapshot");

    // Every accepted edit republishes readiness, and the same event can reach
    // the client twice: the burst must not become a request burst.
    for (let i = 0; i < 20; i += 1) {
      socket.emitFromServer("readiness.changed", { matchId: "match-1", side: "left", invalidated: true, documentRevision: i + 1 });
      socket.emitFromServer("match:event", { revision: 1, round: 1 });
    }
    assert.equal(requests.length, 1, "no second snapshot request may start while one is in flight");

    // The server moved on after the burst: the coalesced refresh must catch up.
    serverRevision = 7;

    inFlight.shift().resolve({ ok: true, json: async () => matchSnapshot(1) });
    assert.ok(await waitUntil(() => inFlight.length > 0), "the burst is followed by one trailing refresh");
    assert.equal(requests.length, 2, "the whole burst collapses into a single trailing snapshot request");

    inFlight.shift().resolve({ ok: true, json: async () => matchSnapshot(7) });
    await wait(0);
    assert.equal(transport.snapshot().revision, 7, "the newest server revision is applied");
  } finally {
    transport.disconnect();
  }
});
test("failed snapshot refreshes retain the match, publish a notice without logging, and recover", async () => {
  let socket;
  const warnings = [];
  const errors = [];
  let status = 200;

  const socketModule = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io() {
          socket = new FakeSocket();
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
    },
    {
      fetch: async () => ({ ok: status === 200, status, json: async () => matchSnapshot(1) }),
      console: {
        warn: (...args) => warnings.push(args),
        error: (...args) => errors.push(args),
      },
    },
  );

  const transport = new socketModule.SocketArenaTransport({
    baseUrl: "http://game.test",
    userId: "player-1",
    matchId: "match-1",
  });

  try {
    socket.fire("connect");
    await wait(20);
    const baseline = transport.snapshot();
    const notices = [];
    transport.subscribe(() => notices.push(transport.snapshot().notice));
    for (const failureStatus of [429, 503]) {
      status = failureStatus;
      socket.fire("connect");
      assert.ok(await waitUntil(() => transport.snapshot().notice !== null));
      assert.match(transport.snapshot().notice, /Retrying automatically/);
      assert.deepEqual(transport.snapshot().problem, baseline.problem, "the last synchronized match is retained");
      assert.equal(transport.snapshot().revision, baseline.revision);
      assert.ok(notices.includes(transport.snapshot().notice), "subscribers receive the notice");

      status = 200;
      socket.fire("connect");
      assert.ok(await waitUntil(() => transport.snapshot().notice === null), "successful synchronization clears the notice");
    }
    assert.equal(warnings.length, 0);
    assert.equal(errors.length, 0);
  } finally {
    transport.disconnect();
  }
});
test("an expired match token is refreshed and reused for the command snapshot", async () => {
  let socket;
  let currentToken = "old-token";
  const requests = [];

  const socketModule = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io() {
          socket = new FakeSocket();
          socket.auth = {};
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
    },
    {
      fetch: async (url, init = {}) => {
        const path = new URL(url).pathname.split("/matches/match-1")[1];
        const token = init.headers?.authorization?.replace("Bearer ", "") ?? null;
        requests.push({ path, token });
        if (path === "/start-round" && token === "old-token") {
          return { ok: false, status: 401, json: async () => ({ error: "expired" }) };
        }
        if (path === "/snapshot") {
          return { ok: true, json: async () => matchSnapshot(1) };
        }
        return { ok: true, json: async () => ({ ok: true }) };
      },
    },
  );

  const requestWithSession = async (send) => {
    try {
      return await send(currentToken);
    } catch (error) {
      if (error.status !== 401) throw error;
      currentToken = "fresh-token";
      return send(currentToken);
    }
  };
  const transport = new socketModule.SocketArenaTransport({
    baseUrl: "http://game.test",
    userId: "player-1",
    matchId: "match-1",
    token: "old-token",
    requestWithSession,
  });

  try {
    socket.fire("connect");
    assert.ok(await waitUntil(() => requests.some((request) => request.path === "/snapshot")));
    await wait(0);

    await transport.startRound();

    assert.deepEqual(
      requests.filter((request) => request.path === "/start-round").map((request) => request.token),
      ["old-token", "fresh-token"],
      "the rejected command is retried once with the renewed token",
    );
    assert.equal(socket.auth.token, "fresh-token", "future game socket connections use the renewed token");
    assert.equal(
      requests.filter((request) => request.path === "/snapshot").at(-1)?.token,
      "fresh-token",
      "the command's follow-up snapshot also uses the renewed token",
    );
  } finally {
    transport.disconnect();
  }
});

test("the public match snapshot preserves the authoritative winner when totals are equal", async () => {
  for (const [mySide, winner, outcome] of [
    ["left", "left", "You win the match."],
    ["right", "left", "Opponent wins the match."],
    ["left", null, "The match is a draw."],
  ]) {
    let socket;
    const snapshot = {
      ...matchSnapshot(1),
      roundPhase: "MATCH_COMPLETE",
      mySide,
      final: { scores: { left: 125, right: 125 }, outcome: winner ?? "draw", winner, forfeit: null },
    };
    const { SocketArenaTransport } = loadTypeScriptModule("../lib/arena/socket.ts", {
      "socket.io-client": { io() { socket = new FakeSocket(); return socket; } },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
    }, { fetch: async () => ({ ok: true, json: async () => snapshot }) });
    const transport = new SocketArenaTransport({ baseUrl: "http://game.test", userId: "player-1", matchId: "match-1" });
    try {
      socket.fire("connect");
      assert.ok(await waitUntil(() => transport.snapshot().revision === 1));
      assert.equal(transport.snapshot().matchFinal.outcome, outcome);
      assert.equal(transport.snapshot().matchFinal.you, 125);
      assert.equal(transport.snapshot().matchFinal.opponent, 125);
    } finally {
      transport.disconnect();
    }
  }
});

test("a forbidden match stops polling, queued refreshes, and reconnects without expiring the session", async () => {
  let socket;
  let resolveSnapshot;
  const requests = [];
  const intervals = new Set();
  const timeouts = new Set();
  const socketModule = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io() {
          socket = new FakeSocket();
          socket.connect = () => assert.fail("a token update must not reconnect a forbidden match");
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
    },
    {
      setInterval: (callback) => { intervals.add(callback); return callback; },
      clearInterval: (callback) => intervals.delete(callback),
      setTimeout: (callback) => { timeouts.add(callback); return callback; },
      clearTimeout: (callback) => timeouts.delete(callback),
      fetch: (url) => {
        requests.push(url);
        return new Promise((resolve) => { resolveSnapshot = resolve; });
      },
    },
  );
  const transport = new socketModule.SocketArenaTransport({
    baseUrl: "http://game.test", userId: "player-1", matchId: "match-1", token: "valid-token",
  });

  try {
    const poll = [...intervals][0];
    socket.fire("connect");
    assert.ok(await waitUntil(() => requests.length === 1));
    // A reconnect queues another immediate read; an event also asks for a trailing refresh.
    socket.fire("connect");
    socket.emitFromServer("phase.changed", { revision: 2, round: 1 });
    resolveSnapshot({ ok: false, status: 403 });
    assert.ok(await waitUntil(() => transport.connection() === "offline"), "403 must take the match offline");
    await wait(0);

    assert.equal(transport.snapshot().notice, "Access denied. You cannot access this match.");
    assert.equal(socket.connected, false);
    assert.equal(intervals.size, 0, "polling is stopped");
    assert.equal(timeouts.size, 0, "trailing refresh is cancelled");
    assert.equal(requests.length, 1, "queued reads must not reach the server after denial");

    transport.setAccessToken("renewed-valid-token");
    socket.fire("connect");
    socket.fire("disconnect");
    socket.fire("connect_error");
    socket.emitFromServer("phase.changed", { revision: 3, round: 1 });
    poll(); // Even a previously queued timer callback must be harmless.
    await transport.setLanguage("Python");
    await wait(0);

    assert.equal(requests.length, 1);
    assert.equal(intervals.size, 0, "token renewal must not restart polling");
    assert.equal(timeouts.size, 0);
    assert.equal(transport.connection(), "offline");
    assert.equal(transport.snapshot().notice, "Access denied. You cannot access this match.");
    await assert.rejects(transport.run({ code: "", language: "Python" }), /unavailable while offline/);
  } finally {
    transport.disconnect();
  }
});

for (const failure of ["network", "503"]) {
  test(`snapshot ${failure} failure remains retryable and recovers on the next poll`, async () => {
    let socket;
    let poll;
    let now = 0;
    let requests = 0;
    const socketModule = loadTypeScriptModule(
      "../lib/arena/socket.ts",
      {
        "socket.io-client": { io() { socket = new FakeSocket(); return socket; } },
        "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
      },
      {
        Date: { now: () => now },
        setInterval: (callback) => { poll = callback; return callback; },
        clearInterval: () => { poll = undefined; },
        fetch: async () => {
          requests += 1;
          if (requests === 1) {
            if (failure === "network") throw new TypeError("Failed to fetch");
            return { ok: false, status: 503 };
          }
          return { ok: true, json: async () => matchSnapshot(1) };
        },
      },
    );
    const transport = new socketModule.SocketArenaTransport({
      baseUrl: "http://game.test", userId: "player-1", matchId: "match-1", token: "valid-token",
    });
    try {
      socket.fire("connect");
      assert.ok(await waitUntil(() => transport.snapshot().notice?.includes("Retrying automatically")));
      assert.equal(transport.connection(), "connected");
      assert.equal(socket.connected, true);
      assert.equal(typeof poll, "function", "transient failure must preserve polling");
      now = 2000;
      poll();
      assert.ok(await waitUntil(() => transport.snapshot().revision === 1));
      assert.equal(transport.snapshot().notice, null);
      assert.equal(requests, 2);
    } finally {
      transport.disconnect();
    }
  });
}

test("SocketArenaTransport transitions to offline and stops polling on unrecoverable auth failure", async () => {
  let socket;
  const requests = [];
  const socketModule = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io(_url, options) {
          socket = new FakeSocket();
          socket.auth = options.auth;
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
      "../auth/client": {},
    },
    {
      fetch: async (url) => {
        const path = new URL(url).pathname.split("/matches/match-1")[1];
        requests.push(path);
        return { ok: false, status: 401, json: async () => ({ error: "unauthorized" }) };
      },
    },
  );

  const requestWithSession = async (send) => {
    return send("expired-token");
  };

  const transport = new socketModule.SocketArenaTransport({
    baseUrl: "http://game.test",
    userId: "player-1",
    matchId: "match-1",
    token: "expired-token",
    requestWithSession,
  });

  try {
    socket.fire("connect");
    await waitUntil(() => requests.length > 0);
    await wait(30);
    assert.equal(transport.connection(), "offline");
    assert.equal(socket.connected, false, "socket is disconnected on auth failure");
    const countBefore = requests.length;
    await wait(60);
    assert.equal(requests.length, countBefore, "sync timer was stopped, no polling storm");
  } finally {
    transport.disconnect();
  }
});
test("SocketArenaTransport transitions to offline and cleans up timers when session renewal throws AuthRequestError(401)", async () => {
  let socket;
  const requests = [];
  const authModule = loadTypeScriptModule("../lib/auth/client.ts");
  const socketModule = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io(_url, options) {
          socket = new FakeSocket();
          socket.auth = options.auth;
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
      "../auth/client": authModule,
    },
    {
      fetch: async (url) => {
        const path = new URL(url).pathname.split("/matches/match-1")[1];
        requests.push(path);
        return { ok: true, json: async () => ({ ...matchSnapshot(1), revision: 1 }) };
      },
    },
  );

  let refreshAttempts = 0;
  const requestWithSession = async () => {
    refreshAttempts += 1;
    throw new authModule.AuthRequestError("Your session has expired. Please log in again.", 401);
  };

  const transport = new socketModule.SocketArenaTransport({
    baseUrl: "http://game.test",
    userId: "player-1",
    matchId: "match-1",
    token: "expired-token",
    requestWithSession,
  });

  try {
    socket.fire("connect");
    await waitUntil(() => refreshAttempts > 0);
    await wait(30);
    assert.equal(transport.connection(), "offline", "transport must transition to offline on AuthRequestError(401)");
    assert.equal(socket.connected, false, "socket must be disconnected on AuthRequestError(401)");
    assert.equal(transport.snapshot().notice, "Session expired. Please sign in again.");
    const attemptsBefore = refreshAttempts;
    await wait(60);
    assert.equal(refreshAttempts, attemptsBefore, "sync timer was cleared, no polling storm");
  } finally {
    transport.disconnect();
  }
});
test("an unreachable auth service keeps the Arena transport online, polling and recoverable", async () => {
  let socket;
  const requests = [];
  let authServiceDown = true;

  // The real AuthProvider drives the transport: only the auth service is faked.
  const provider = await mountAuthProvider("/login", {
    onRefresh: async () => (authServiceDown
      ? { networkError: true }
      : {
        status: 200,
        body: { user: { id: "p1" }, accessToken: "recovered-token", tokenType: "Bearer", expiresIn: 900 },
      }),
  });
  provider.value.setSession({ user: { id: "p1" }, accessToken: "near-expiry", tokenType: "Bearer", expiresIn: 10 });

  const socketModule = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io(_url, options) {
          socket = new FakeSocket();
          socket.auth = options.auth;
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
    },
    {
      fetch: async (url) => {
        const path = new URL(url).pathname.split("/matches/match-1")[1];
        requests.push(path);
        return { ok: true, status: 200, json: async () => matchSnapshot(1) };
      },
    },
  );

  const transport = new socketModule.SocketArenaTransport({
    baseUrl: "http://game.test",
    userId: "p1",
    matchId: "match-1",
    token: "near-expiry",
    requestWithSession: provider.value.requestWithSession,
  });

  try {
    socket.fire("connect");
    assert.ok(await waitUntil(() => provider.calls() > 0), "the provider attempts a session refresh");
    await wait(30);
    assert.match(transport.snapshot().notice ?? "", /Retrying automatically/, "the transport reports a retryable notice");

    const refreshesBefore = provider.calls();
    assert.ok(
      await waitUntil(() => provider.calls() > refreshesBefore, 5000),
      "the sync timer survives and the transport keeps retrying while the auth service is unreachable",
    );

    assert.notEqual(transport.connection(), "offline", "a transient auth failure must not take the transport offline");
    assert.equal(socket.connected, true, "the game socket stays connected");
    assert.doesNotMatch(transport.snapshot().notice ?? "", /Session expired/, "a transient failure is not an expired session");

    authServiceDown = false;
    socket.emitFromServer("match:event", { revision: 1, round: 1 });
    assert.ok(
      await waitUntil(() => transport.snapshot().revision === 1, 5000),
      "the transport recovers once the auth service returns",
    );
    assert.equal(transport.snapshot().notice, null, "a successful sync clears the notice");
  } finally {
    transport.disconnect();
  }
});

test("1v1 snapshot falls back from unsupported language to available starter and preserves supported C++", async () => {
  let socket;
  let currentSnapshot;

  const { SocketArenaTransport } = loadTypeScriptModule(
    "../lib/arena/socket.ts",
    {
      "socket.io-client": {
        io() {
          socket = new FakeSocket();
          return socket;
        },
      },
      "./transport": loadTypeScriptModule("../lib/arena/transport.ts"),
    },
    {
      fetch: async () => ({
        ok: true,
        json: async () => currentSnapshot,
      }),
    },
  );

  // 1. Initial snapshot with only Python available:
  // Transport defaults to C++, but since C++ is not in starters, it must fall back to Python.
  currentSnapshot = {
    ...matchSnapshot(1),
    mode: "1v1",
    problem: {
      id: "python-only",
      title: "Python Only Problem",
      description: "...",
      examples: [],
      starters: { Python: "def solve(): pass" },
    },
  };

  const transport = new SocketArenaTransport({
    baseUrl: "http://game.test",
    userId: "player-1",
    matchId: "match-1",
  });

  try {
    socket.fire("connect");
    assert.ok(await waitUntil(() => transport.snapshot().revision === 1));
    assert.equal(
      transport.snapshot().language,
      "Python",
      "initial Python-only snapshot must select Python instead of default C++",
    );

    // 2. Subsequent snapshot changes to a problem offering C and C++:
    transport.setLanguage("C++");
    currentSnapshot = {
      ...matchSnapshot(2),
      mode: "1v1",
      problem: {
        id: "multi-lang",
        title: "Multi Lang Problem",
        description: "...",
        examples: [],
        starters: {
          C: "int main() { return 0; }",
          "C++": "int main() { return 0; }",
        },
      },
    };
    socket.emitFromServer("match:event", { revision: 2, round: 1 });
    assert.ok(await waitUntil(() => transport.snapshot().revision === 2));
    assert.equal(transport.snapshot().language, "C++", "valid C++ selection remains when supported");

    // 3. Next round/snapshot offers only Python (no C++):
    currentSnapshot = {
      ...matchSnapshot(3),
      mode: "1v1",
      round: 2,
      problem: {
        id: "snippet-round",
        title: "Snippet Only",
        description: "...",
        examples: [],
        starters: { Python: "class Solution: pass" },
      },
    };
    socket.emitFromServer("match:event", { revision: 3, round: 2 });
    assert.ok(await waitUntil(() => transport.snapshot().revision === 3));
    assert.equal(
      transport.snapshot().language,
      "Python",
      "subsequent snapshot with unsupported current language selects valid starter",
    );
  } finally {
    transport.disconnect();
  }
});
