import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadTypeScript(sourcePath, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(sourcePath, import.meta.url), 'utf8');
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
    fetch: async () => ({ ok: true, json: async () => MATCH_SNAPSHOT }),
    setInterval,
    clearInterval,
    setTimeout,
    ...globals,
  });
  return loadedModule.exports;
}

class FakeSocket {
  handlers = new Map();

  on(event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  onAny() {
    return this;
  }

  fire(event) {
    this.handlers.get(event)?.();
  }

  disconnect() {
    return this;
  }
}

const MATCH_SNAPSHOT = {
  mode: '1v1',
  roundPhase: 'CODING',
  round: 1,
  totalRounds: 3,
  remainingMs: 120_000,
  problem: {
    title: 'Even Ledger',
    description: '',
    examples: [],
    starters: { Python: '' },
  },
  tests: [],
  mySide: 'left',
  sides: {
    left: { status: 'coding', submissions: 0, presence: 'online' },
    right: { status: 'coding', submissions: 0, presence: 'online' },
  },
  reveal: null,
  revision: 1,
  pendingEvaluation: false,
  final: null,
};

test('successful reconnect notifies subscribers while the authoritative snapshot is delayed', async () => {
  let socket;
  let holdSnapshot = false;
  const transportModule = loadTypeScript('../lib/arena/transport.ts');
  const socketModule = loadTypeScript(
    '../lib/arena/socket.ts',
    {
      'socket.io-client': {
        io() {
          socket = new FakeSocket();
          return socket;
        },
      },
      './transport': transportModule,
    },
    {
      fetch: async () => {
        if (holdSnapshot) return new Promise(() => {});
        return { ok: true, json: async () => MATCH_SNAPSHOT };
      },
    },
  );
  const transport = new socketModule.SocketArenaTransport({
    baseUrl: 'http://game.test',
    userId: 'player-1',
    matchId: 'match-1',
  });
  const transitions = [];
  transport.subscribe(() => transitions.push(transport.connection()));

  try {
    socket.fire('connect');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(transport.connection(), 'connected');

    transitions.length = 0;
    socket.fire('disconnect');
    assert.equal(transport.connection(), 'reconnecting');
    transitions.length = 0;

    holdSnapshot = true;
    socket.fire('connect');
    assert.equal(transport.connection(), 'connected');
    assert.ok(
      transitions.includes('connected'),
      'subscribers should see the recovered connection state',
    );
  } finally {
    transport.disconnect();
  }
});
