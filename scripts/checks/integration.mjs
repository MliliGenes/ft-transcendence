import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { root, run, npm, cli, isMain } from './process.mjs';

export function integrationEnvironment(
  services,
  database,
  inherited = process.env,
) {
  const env = {
    ...inherited,
    NODE_ENV: 'test',
    DOTENV_CONFIG_PATH: join(root, '.verification', 'no-env-file'),
  };
  for (const key of [
    'DATABASE_URL',
    'TEST_PG_URL',
    'TEST_DATABASE_URL',
    'AUTH_TEST_DATABASE_URL',
    'PGHOST',
    'PGPORT',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
  ])
    delete env[key];
  const url = new URL('postgres://127.0.0.1');
  url.port = String(services.postgresPort);
  url.username = services.user;
  url.password = services.password;
  url.pathname = `/${database}`;
  Object.assign(env, {
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: String(services.postgresPort),
    POSTGRES_USER: services.user,
    POSTGRES_PASSWORD: services.password,
    POSTGRES_DB: database,
    TEST_PG_URL: url.href,
    TEST_DATABASE_URL: url.href,
    AUTH_TEST_DATABASE_URL: url.href,
    RABBITMQ_HOST: '127.0.0.1',
    RABBITMQ_PORT: String(services.rabbitPort),
    RABBITMQ_DEFAULT_USER: services.user,
    RABBITMQ_DEFAULT_PASS: services.password,
  });
  return env;
}
export async function withTestServices(
  work,
  { execute = run, wait = delay, signal } = {},
) {
  const id = randomUUID().slice(0, 8),
    user = 'nook_verify',
    password = randomBytes(24).toString('hex');
  const created = [];
  let failure;
  try {
    await execute('docker', ['info'], { capture: true, signal });
    const pg = `nook-check-pg-${id}`,
      rabbit = `nook-check-rabbit-${id}`;
    for (const [name, image, port, variables] of [
      [
        pg,
        'postgres:18-alpine',
        '5432',
        [`POSTGRES_USER=${user}`, `POSTGRES_PASSWORD=${password}`],
      ],
      [
        rabbit,
        'rabbitmq:4-management',
        '5672',
        [
          `RABBITMQ_DEFAULT_USER=${user}`,
          `RABBITMQ_DEFAULT_PASS=${password}`,
          'RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS=+S 2:2 +A 4',
          'RABBITMQ_CTL_ERL_ARGS=+S 1:1 +A 1',
        ],
      ],
    ]) {
      created.push(name);
      await execute(
        'docker',
        [
          'run',
          '--detach',
          '--rm',
          '--name',
          name,
          '--label',
          `nook.verification=${id}`,
          '-p',
          `127.0.0.1::${port}`,
          ...variables.flatMap((v) => ['-e', v]),
          image,
        ],
        { capture: true, signal },
      );
    }
    for (const [name, probe] of [
      [pg, ['pg_isready', '-U', user, '-t', '2']],
      [rabbit, ['timeout', '5', 'rabbitmq-diagnostics', '-q', 'ping']],
    ]) {
      const deadline = Date.now() + 90000;
      for (;;) {
        const result = await execute('docker', ['exec', name, ...probe], {
          capture: true,
          allowFailure: true,
          signal,
        });
        if (result.code === 0) break;
        if (Date.now() >= deadline)
          throw new Error(`Disposable service ${name} did not become ready.`);
        await wait(500, undefined, { signal });
      }
    }
    const portOf = async (name, port) => {
      const result = await execute('docker', ['port', name, `${port}/tcp`], {
        capture: true,
        signal,
      });
      const match = result.stdout.trim().match(/^127\.0\.0\.1:(\d+)$/);
      if (!match)
        throw new Error(
          'Disposable service must be bound to one loopback port.',
        );
      return Number(match[1]);
    };
    const services = {
      user,
      password,
      postgresPort: await portOf(pg, 5432),
      rabbitPort: await portOf(rabbit, 5672),
    };
    for (const database of [
      'arena_engine_test',
      'arena_service_test',
      'chat_test',
      'user_auth_test',
    ]) {
      await execute('docker', ['exec', pg, 'createdb', '-U', user, database], {
        capture: true,
        signal,
      });
    }
    return await work(services);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const name of created.reverse()) {
      try {
        const result = await execute(
          'docker',
          ['rm', '--force', '--volumes', name],
          { capture: true, allowFailure: true },
        );
        if (result.code && !result.stderr?.includes('No such container'))
          throw new Error(`Could not remove disposable container ${name}.`);
      } catch (error) {
        cleanupErrors.push(error);
        console.error(`Cleanup requires attention: ${name}`);
      }
    }
    if (cleanupErrors.length && !failure)
      throw new AggregateError(
        cleanupErrors,
        'Disposable container cleanup failed.',
      );
  }
}

export async function runIntegration({
  prepared = false,
  signal,
  report = () => {},
} = {}) {
  const stage = async (id, command, args, cwd, env) => {
    const start = Date.now();
    console.log(`\n> ${id}`);
    try {
      await run(command, args, { cwd: join(root, cwd), env, signal });
      report({ id, ok: true, durationMs: Date.now() - start });
    } catch (error) {
      report({
        id,
        ok: false,
        durationMs: Date.now() - start,
        error: error.message,
      });
      throw error;
    }
  };
  await withTestServices(
    async (services) => {
      const engine = integrationEnvironment(services, 'arena_engine_test');
      const game = integrationEnvironment(services, 'arena_service_test');
      const chat = integrationEnvironment(services, 'chat_test');
      const user = integrationEnvironment(services, 'user_auth_test');
      if (!prepared) {
        await stage(
          'integration-build-arena',
          npm,
          ['run', 'build:packages'],
          '.',
          game,
        );
        for (const [cwd, env] of [
          ['chat-service', chat],
          ['user-service', user],
        ]) {
          await stage(
            `integration-generate-${cwd}`,
            process.execPath,
            ['node_modules/prisma/build/index.js', 'generate'],
            cwd,
            env,
          );
          await stage(
            `integration-build-${cwd}`,
            npm,
            ['run', 'build'],
            cwd,
            env,
          );
        }
      }
      await stage(
        'user-test-schema',
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        'user-service',
        user,
      );
      // The Chat migrations must apply to a real database, not only through
      // the generated DDL the tests use.
      await stage(
        'chat-test-schema',
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        'chat-service',
        chat,
      );
      await stage(
        'engine-postgres',
        process.execPath,
        [
          '../../node_modules/vitest/vitest.mjs',
          'run',
          'test/postgres.test.ts',
          'test/lobby-atomic.test.ts',
          'test/lobby.test.ts',
          'test/collab.test.ts',
          'test/persistence.test.ts',
          '--no-file-parallelism',
        ],
        'packages/arena-game',
        { ...engine, DATABASE_URL: engine.TEST_PG_URL },
      );
      await stage(
        'game-postgres-reconnect',
        process.execPath,
        [
          '../../node_modules/vitest/vitest.mjs',
          'run',
          'src/game/service.test.ts',
          'src/game/reconnect.test.ts',
          '--no-file-parallelism',
          '--testTimeout',
          '30000',
        ],
        'services/game',
        game,
      );
      await stage(
        'chat-postgres',
        process.execPath,
        [
          '--test',
          '--test-isolation=none',
          '--test-concurrency=1',
          'test/dm.postgres.test.mjs',
          'test/game-notifications.postgres.test.mjs',
        ],
        'chat-service',
        chat,
      );
      await stage(
        'user-postgres',
        process.execPath,
        [
          '--test',
          '--test-isolation=none',
          '--test-concurrency=1',
          'test/refresh-race.postgres.test.mjs',
          'test/discord-link.postgres.test.mjs',
          'test/bootstrap-superadmin.postgres.test.mjs',
        ],
        'user-service',
        user,
      );
    },
    { signal },
  );
}
if (isMain(import.meta.url)) await cli((signal) => runIntegration({ signal }));
