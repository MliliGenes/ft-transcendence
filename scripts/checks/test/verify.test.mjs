import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceTestSteps } from '../arena-tests.mjs';
import { verificationSteps, runSteps } from '../verify.mjs';

test('full verification covers every product surface and real lint commands', () => {
  const steps = verificationSteps();
  for (const id of ['tool-tests', 'client-lint', 'chat-lint', 'user-lint', 'arena-typecheck', 'arena-tests', 'client-tests', 'chat-tests', 'user-tests', 'client-build', 'chat-build', 'user-build', 'arena-build']) {
    assert.ok(steps.some((step) => step.id === id), id);
  }
  assert.ok(steps.find((s) => s.id === 'user-tests').args.some((arg) => arg.endsWith('refresh-tokens.test.mjs')));
  assert.ok(steps.find((s) => s.id === 'tool-tests').args.some((arg) => arg.endsWith('backup.test.mjs')));
  for (const step of steps.filter((s) => s.id.endsWith('-lint'))) {
    assert.ok(['client', 'chat-service', 'user-service'].includes(step.cwd));
    assert.equal(step.args.includes('--if-present'), false);
  }
});

test('verification stops at the first failure and records its result', async () => {
  const seen = [], results = [];
  await assert.rejects(runSteps([{ id: 'first' }, { id: 'broken' }, { id: 'never' }], {
    execute: async (step) => { seen.push(step.id); if (step.id === 'broken') throw new Error('exit 17'); },
    report: (result) => results.push(result),
  }), /exit 17/);
  assert.deepEqual(seen, ['first', 'broken']);
  assert.deepEqual(results.map((r) => [r.id, r.ok]), [['first', true], ['broken', false]]);
});

test('preliminary engine suites cannot fall back to an existing local PostgreSQL', () => {
  const steps = workspaceTestSteps({ TEST_PG_URL: 'postgres://live/prod', DATABASE_URL: 'postgres://live/prod' });
  const engine = steps.find((s) => s.workspace === 'arena-game-engine');
  const game = steps.find((s) => s.workspace === 'arena-game');
  assert.equal(new URL(engine.env.TEST_PG_URL).port, '1');
  assert.equal(new URL(engine.env.TEST_PG_URL).hostname, '127.0.0.1');
  assert.equal(engine.env.DATABASE_URL, undefined);
  assert.equal(game.env.TEST_PG_URL, undefined);
  assert.equal(game.env.DATABASE_URL, undefined);
});
