import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('../lib/arena/stats.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
let request;
const compiledModule = { exports: {} };
const context = {
  module: compiledModule,
  exports: compiledModule.exports,
  fetch: async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ matches: [] }) };
  },
};
runInNewContext(compiled, context);
const statsApi = compiledModule.exports;

test('Code Arena profile reads use same-origin routes and the current bearer token', async () => {
  await statsApi.arenaStatsApi.userMatches('user/one', 'session-token');
  assert.equal(request.url, '/api/game/users/user%2Fone/matches');
  assert.equal(request.init.headers.Authorization, 'Bearer session-token');
  assert.equal(request.init.cache, 'no-store');
});
