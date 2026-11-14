import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test("same-origin lobby sockets use Nginx's Game service path", () => {
  const source = readFileSync(
    new URL('../lib/arena/lobby.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  let socketOptions;
  const fakeSocket = {
    on() {
      return this;
    },
    disconnect() {},
  };
  const exports = {};
  const context = {
    exports,
    module: { exports },
    require(name) {
      assert.equal(name, 'socket.io-client');
      return {
        io(_url, options) {
          socketOptions = options;
          return fakeSocket;
        },
      };
    },
  };
  runInNewContext(compiled, context);

  const client = new context.module.exports.LobbyClient('', 'player-1');
  const cleanup = client.connectSocket({});
  assert.equal(socketOptions.path, '/api/game/socket.io');
  cleanup();
});

function loadTypeScriptModule(relativePath, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  runInNewContext(compiled, {
    exports: loadedModule.exports,
    module: loadedModule,
    require(name) {
      if (!(name in dependencies))
        throw new Error(`unexpected import: ${name}`);
      return dependencies[name];
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
    return this;
  }

  /** Local socket lifecycle event (connect/disconnect): never reaches onAny. */
  fire(event, payload) {
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
    mode: '1v1',
    roundPhase: 'CODING',
    round: 1,
    totalRounds: 3,
    remainingMs: 120_000,
    problem: {
      title: 'Even Ledger',
      description: '',
      examples: [],
      starters: { 'C++': '' },
    },
    tests: [],
    mySide: 'left',
    sides: {
      left: { status: 'coding', submissions: 0, presence: 'online' },
      right: { status: 'coding', submissions: 0, presence: 'online' },
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

test('a burst of match events coalesces into one snapshot request that applies the newest revision', async () => {
  let socket;
  const requests = [];
  const inFlight = [];
  let serverRevision = 1;

  const socketModule = loadTypeScriptModule(
    '../lib/arena/socket.ts',
    {
      'socket.io-client': {
        io() {
          socket = new FakeSocket();
          return socket;
        },
      },
      './transport': loadTypeScriptModule('../lib/arena/transport.ts'),
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
    baseUrl: 'http://game.test',
    userId: 'player-1',
    matchId: 'match-1',
  });

  try {
    socket.fire('connect');
    await wait(0);
    assert.equal(requests.length, 1, 'connecting fetches exactly one snapshot');

    // Every accepted edit republishes readiness, and the same event can reach
    // the client twice: the burst must not become a request burst.
    for (let i = 0; i < 20; i += 1) {
      socket.emitFromServer('readiness.changed', {
        matchId: 'match-1',
        side: 'left',
        invalidated: true,
        documentRevision: i + 1,
      });
      socket.emitFromServer('match:event', { revision: 1, round: 1 });
    }
    assert.equal(
      requests.length,
      1,
      'no second snapshot request may start while one is in flight',
    );

    // The server moved on after the burst: the coalesced refresh must catch up.
    serverRevision = 7;

    inFlight.shift().resolve({ ok: true, json: async () => matchSnapshot(1) });
    assert.ok(
      await waitUntil(() => inFlight.length > 0),
      'the burst is followed by one trailing refresh',
    );
    assert.equal(
      requests.length,
      2,
      'the whole burst collapses into a single trailing snapshot request',
    );

    inFlight.shift().resolve({ ok: true, json: async () => matchSnapshot(7) });
    await wait(0);
    assert.equal(
      transport.snapshot().revision,
      7,
      'the newest server revision is applied',
    );
  } finally {
    transport.disconnect();
  }
});

test('failed snapshot refreshes retain the match, publish a notice without logging, and recover', async () => {
  let socket;
  const warnings = [];
  const errors = [];
  let status = 200;

  const socketModule = loadTypeScriptModule(
    '../lib/arena/socket.ts',
    {
      'socket.io-client': {
        io() {
          socket = new FakeSocket();
          return socket;
        },
      },
      './transport': loadTypeScriptModule('../lib/arena/transport.ts'),
    },
    {
      fetch: async () => ({
        ok: status === 200,
        status,
        json: async () => matchSnapshot(1),
      }),
      console: {
        warn: (...args) => warnings.push(args),
        error: (...args) => errors.push(args),
      },
    },
  );

  const transport = new socketModule.SocketArenaTransport({
    baseUrl: 'http://game.test',
    userId: 'player-1',
    matchId: 'match-1',
  });

  try {
    socket.fire('connect');
    await wait(20);
    const baseline = transport.snapshot();
    const notices = [];
    transport.subscribe(() => notices.push(transport.snapshot().notice));
    for (const failureStatus of [429, 503]) {
      status = failureStatus;
      socket.fire('connect');
      assert.ok(await waitUntil(() => transport.snapshot().notice !== null));
      assert.match(transport.snapshot().notice, /Retrying automatically/);
      assert.deepEqual(
        transport.snapshot().problem,
        baseline.problem,
        'the last synchronized match is retained',
      );
      assert.equal(transport.snapshot().revision, baseline.revision);
      assert.ok(
        notices.includes(transport.snapshot().notice),
        'subscribers receive the notice',
      );

      status = 200;
      socket.fire('connect');
      assert.ok(
        await waitUntil(() => transport.snapshot().notice === null),
        'successful synchronization clears the notice',
      );
    }
    assert.equal(warnings.length, 0);
    assert.equal(errors.length, 0);
  } finally {
    transport.disconnect();
  }
});

test('an expired match token is refreshed and reused for the command snapshot', async () => {
  let socket;
  let currentToken = 'old-token';
  const requests = [];

  const socketModule = loadTypeScriptModule(
    '../lib/arena/socket.ts',
    {
      'socket.io-client': {
        io() {
          socket = new FakeSocket();
          socket.auth = {};
          return socket;
        },
      },
      './transport': loadTypeScriptModule('../lib/arena/transport.ts'),
    },
    {
      fetch: async (url, init = {}) => {
        const path = new URL(url).pathname.split('/matches/match-1')[1];
        const token =
          init.headers?.authorization?.replace('Bearer ', '') ?? null;
        requests.push({ path, token });
        if (path === '/start-round' && token === 'old-token') {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'expired' }),
          };
        }
        if (path === '/snapshot') {
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
      currentToken = 'fresh-token';
      return send(currentToken);
    }
  };
  const transport = new socketModule.SocketArenaTransport({
    baseUrl: 'http://game.test',
    userId: 'player-1',
    matchId: 'match-1',
    token: 'old-token',
    requestWithSession,
  });

  try {
    socket.fire('connect');
    assert.ok(
      await waitUntil(() =>
        requests.some((request) => request.path === '/snapshot'),
      ),
    );
    await wait(0);

    await transport.startRound();

    assert.deepEqual(
      requests
        .filter((request) => request.path === '/start-round')
        .map((request) => request.token),
      ['old-token', 'fresh-token'],
      'the rejected command is retried once with the renewed token',
    );
    assert.equal(
      socket.auth.token,
      'fresh-token',
      'future game socket connections use the renewed token',
    );
    assert.equal(
      requests.filter((request) => request.path === '/snapshot').at(-1)?.token,
      'fresh-token',
      "the command's follow-up snapshot also uses the renewed token",
    );
  } finally {
    transport.disconnect();
  }
});

test('the public match snapshot preserves the authoritative winner when totals are equal', async () => {
  for (const [mySide, winner, outcome] of [
    ['left', 'left', 'You win the match.'],
    ['right', 'left', 'Opponent wins the match.'],
    ['left', null, 'The match is a draw.'],
  ]) {
    let socket;
    const snapshot = {
      ...matchSnapshot(1),
      roundPhase: 'MATCH_COMPLETE',
      mySide,
      final: {
        scores: { left: 125, right: 125 },
        outcome: winner ?? 'draw',
        winner,
        forfeit: null,
      },
    };
    const { SocketArenaTransport } = loadTypeScriptModule(
      '../lib/arena/socket.ts',
      {
        'socket.io-client': {
          io() {
            socket = new FakeSocket();
            return socket;
          },
        },
        './transport': loadTypeScriptModule('../lib/arena/transport.ts'),
      },
      { fetch: async () => ({ ok: true, json: async () => snapshot }) },
    );
    const transport = new SocketArenaTransport({
      baseUrl: 'http://game.test',
      userId: 'player-1',
      matchId: 'match-1',
    });
    try {
      socket.fire('connect');
      assert.ok(await waitUntil(() => transport.snapshot().revision === 1));
      assert.equal(transport.snapshot().matchFinal.outcome, outcome);
      assert.equal(transport.snapshot().matchFinal.you, 125);
      assert.equal(transport.snapshot().matchFinal.opponent, 125);
    } finally {
      transport.disconnect();
    }
  }
});
