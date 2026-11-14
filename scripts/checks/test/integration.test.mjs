import assert from 'node:assert/strict';
import test from 'node:test';
import { withTestServices, integrationEnvironment } from '../integration.mjs';

test('disposable services clean up only their own containers after a test fails', async () => {
  const calls = [];
  const execute = async (command, args) => {
    calls.push(args);
    if (args[0] === 'port')
      return {
        stdout: `127.0.0.1:${args[2] === '5432/tcp' ? 35432 : 35672}\n`,
      };
    return { stdout: '', code: 0 };
  };
  await assert.rejects(
    withTestServices(
      async () => {
        throw new Error('suite failed');
      },
      { execute, wait: async () => {} },
    ),
    /suite failed/,
  );
  const created = calls
    .filter((a) => a[0] === 'run')
    .map((a) => a[a.indexOf('--name') + 1]);
  const removed = calls.filter((a) => a[0] === 'rm').map((a) => a.at(-1));
  assert.equal(created.length, 2);
  assert.deepEqual(removed.sort(), created.sort());
  assert.ok(removed.every((name) => name.startsWith('nook-check-')));
  assert.ok(
    calls.every((a) => !a.includes('down') && !a.includes('nook-user-db-1')),
  );
});

test('failed startup still removes the containers whose creation was attempted', async () => {
  const calls = [];
  const execute = async (_command, args) => {
    calls.push(args);
    if (args[0] === 'run') throw new Error('Docker unavailable');
    return { stdout: '', code: 0 };
  };
  await assert.rejects(
    withTestServices(async () => assert.fail(), { execute }),
    /Docker unavailable/,
  );
  assert.equal(calls.filter((a) => a[0] === 'rm').length, 1);
});

test('integration env replaces application database and broker targets', () => {
  const env = integrationEnvironment(
    {
      postgresPort: 35432,
      rabbitPort: 35672,
      password: 'temporary',
      user: 'verify',
    },
    'user_auth_test',
    {
      PATH: '/bin',
      DATABASE_URL: 'postgres://live/prod',
      TEST_PG_URL: 'postgres://live/prod',
      RABBITMQ_HOST: 'production',
    },
  );
  assert.equal(env.POSTGRES_HOST, '127.0.0.1');
  assert.equal(env.POSTGRES_DB, 'user_auth_test');
  assert.equal(env.RABBITMQ_HOST, '127.0.0.1');
  assert.equal(env.DATABASE_URL, undefined);
  assert.ok(env.AUTH_TEST_DATABASE_URL.includes(':35432/user_auth_test'));
  assert.equal(env.TEST_PG_URL, env.AUTH_TEST_DATABASE_URL);
});
