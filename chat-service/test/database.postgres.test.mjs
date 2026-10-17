import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';
import { JwtService } from '@nestjs/jwt';
import { createServer } from 'node:net';
import { once } from 'node:events';

const root = fileURLToPath(new URL('../', import.meta.url));
const prisma = join(root, 'node_modules/prisma/build/index.js');

function run(args, options = {}) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 60000,
    ...options,
  }).trim();
}

// Always creates its OWN database/container; never reads DATABASE_URL or .env.
test(
  'isolated PostgreSQL migrations and DM constraints',
  { timeout: 120000 },
  async (t) => {
    const name = 'nook-chat-test-' + randomUUID();
    const password = randomBytes(24).toString('hex');
    const rolePassword = randomBytes(24).toString('hex');
    let database;
    let app;

    try {
      run([
        'run',
        '--detach',
        '--rm',
        '--name',
        name,
        '--label',
        'nook.chat.test=true',
        '-e',
        'POSTGRES_PASSWORD=' + password,
        '-p',
        '127.0.0.1::5432',
        'postgres:18-alpine',
      ]);

      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          run(['exec', name, 'pg_isready', '-U', 'postgres'], {
            timeout: 2000,
          });
          break;
        } catch {
          if (attempt === 59)
            throw new Error('Temporary PostgreSQL did not start.');
          await delay(500);
        }
      }

      // Generated hexadecimal passwords cannot escape this fixed SQL statement.
      run(
        ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
        {
          input: `CREATE ROLE nook_chat LOGIN PASSWORD '${rolePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE nook_chat OWNER nook_chat;`,
        },
      );
      const mappings = JSON.parse(
        run(['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]),
      );
      const port = mappings['5432/tcp'][0].HostPort;
      const url = `postgresql://nook_chat:${rolePassword}@127.0.0.1:${port}/nook_chat`;
      const env = {
        ...process.env,
        DATABASE_URL: url,
        DOTENV_CONFIG_PATH: '/dev/null',
      };

      execFileSync(process.execPath, [prisma, 'generate'], {
        cwd: root,
        env,
        timeout: 30000,
        stdio: 'pipe',
      });
      execFileSync(process.execPath, [prisma, 'migrate', 'deploy'], {
        cwd: root,
        env,
        timeout: 30000,
        stdio: 'pipe',
      });
      // Running deployment twice must be harmless.
      execFileSync(process.execPath, [prisma, 'migrate', 'deploy'], {
        cwd: root,
        env,
        timeout: 30000,
        stdio: 'pipe',
      });
      database = new pg.Client({ connectionString: url });
      await database.connect();

      await t.test(
        'uses a non-superuser role in the Chat database',
        async () => {
          const result = await database.query(
            'SELECT current_database() AS db, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user',
          );
          assert.deepEqual(result.rows[0], {
            db: 'nook_chat',
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
          });
        },
      );

      const alice = '00000000-0000-4000-8000-000000000001';
      const bob = '00000000-0000-4000-8000-000000000002';
      await database.query(
        'INSERT INTO "ChatUser" (id, "sourceUpdatedAt") VALUES ($1, now()), ($2, now())',
        [alice, bob],
      );
      const conversation = randomUUID();
      const insertConversation = (id, first, second) =>
        database.query(
          'INSERT INTO "Conversation" (id, "dmUserAId", "dmUserBId", "updatedAt") VALUES ($1, $2, $3, now())',
          [id, first, second],
        );

      await t.test(
        'stores a valid DM and rejects duplicates, self-DMs, reversed pairs and unknown users',
        async () => {
          await insertConversation(conversation, alice, bob);
          await assert.rejects(insertConversation(randomUUID(), alice, bob), {
            code: '23505',
          });
          await assert.rejects(insertConversation(randomUUID(), alice, alice), {
            code: '23514',
          });
          await assert.rejects(insertConversation(randomUUID(), bob, alice), {
            code: '23514',
          });
          await assert.rejects(
            insertConversation(randomUUID(), bob, randomUUID()),
            (error) => ['23503', '23514'].includes(error.code),
          );
        },
      );

      const requestId = randomUUID();
      const insertMessage = (content, options = {}) =>
        database.query(
          'INSERT INTO "Message" (id, "conversationId", "authorId", content, "clientRequestId", "requestHash", version, "deletedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            randomUUID(),
            conversation,
            alice,
            content,
            options.requestId ?? randomUUID(),
            options.hash ?? 'a'.repeat(64),
            options.version ?? 1,
            options.deletedAt ?? null,
          ],
        );

      await t.test(
        'stores messages and enforces retry keys, content, hashes and tombstones',
        async () => {
          await insertMessage('Hello Bob', { requestId });
          await assert.rejects(insertMessage('Duplicate', { requestId }), {
            code: '23505',
          });
          await assert.rejects(insertMessage('   '), { code: '23514' });
          await assert.rejects(insertMessage(null), { code: '23514' });
          await assert.rejects(insertMessage('x'.repeat(2001)), {
            code: '22001',
          });
          await assert.rejects(insertMessage('Hello', { version: 0 }), {
            code: '23514',
          });
          await assert.rejects(insertMessage('Hello', { hash: 'not-a-hash' }), {
            code: '23514',
          });
          await assert.rejects(
            insertMessage('Still here', { deletedAt: new Date() }),
            { code: '23514' },
          );
          await insertMessage(null, { deletedAt: new Date() });
        },
      );

      await t.test(
        'built Chat starts with PostgreSQL and verifies signed sessions',
        async () => {
          execFileSync(
            process.execPath,
            ['node_modules/@nestjs/cli/bin/nest.js', 'build'],
            {
              cwd: root,
              env,
              timeout: 30000,
              stdio: 'pipe',
            },
          );
          const reservation = createServer();
          reservation.listen(0, '127.0.0.1');
          await once(reservation, 'listening');
          const appPort = reservation.address().port;
          await new Promise((resolve) => reservation.close(resolve));
          const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
          const publicKey = keys.publicKey
            .export({ type: 'spki', format: 'pem' })
            .toString();
          const privateKey = keys.privateKey
            .export({ type: 'pkcs8', format: 'pem' })
            .toString();
          app = spawn(process.execPath, ['dist/main.js'], {
            cwd: root,
            env: { ...env, PORT: String(appPort), JWT_PUBLIC_KEY: publicKey },
            stdio: ['ignore', 'ignore', 'pipe'],
          });
          let startupError = '';
          app.stderr.on('data', (chunk) => {
            startupError = (startupError + chunk.toString()).slice(-2000);
          });
          const base = 'http://127.0.0.1:' + appPort;
          for (let attempt = 0; attempt < 60; attempt++) {
            if (app.exitCode !== null)
              throw new Error('Chat startup failed: ' + startupError);
            try {
              const response = await fetch(base + '/health', {
                signal: AbortSignal.timeout(500),
              });
              assert.equal(response.status, 200);
              break;
            } catch (error) {
              if (attempt === 59) throw error;
              await delay(200);
            }
          }
          assert.equal((await fetch(base + '/session')).status, 401);
          const jwt = await new JwtService().signAsync(
            { sub: alice },
            {
              privateKey,
              algorithm: 'RS256',
              issuer: 'user-service',
              audience: 'ft-transcendence-api',
              expiresIn: 900,
            },
          );
          const response = await fetch(base + '/session', {
            headers: { Authorization: 'Bearer ' + jwt },
          });
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { userId: alice });
          const stopped = once(app, 'exit');
          app.kill('SIGTERM');
          await Promise.race([
            stopped,
            delay(5000).then(() => {
              throw new Error('Chat shutdown timed out');
            }),
          ]);
          app = undefined;

          const denied = spawnSync(process.execPath, ['dist/main.js'], {
            cwd: root,
            env: {
              ...env,
              PORT: String(appPort),
              JWT_PUBLIC_KEY: publicKey,
              DATABASE_URL: url.replace(
                rolePassword,
                'incorrect-test-password',
              ),
            },
            encoding: 'utf8',
            timeout: 10000,
          });
          assert.notEqual(denied.status, 0);
          assert.match(denied.stderr, /Chat database is unavailable/);
          assert.equal(denied.stderr.includes(rolePassword), false);
        },
      );

      await t.test(
        'persists data after reconnect and prevents orphaned history',
        async () => {
          await database.end();
          database = new pg.Client({ connectionString: url });
          await database.connect();
          const result = await database.query(
            'SELECT content FROM "Message" WHERE "clientRequestId" = $1',
            [requestId],
          );
          assert.equal(result.rows[0].content, 'Hello Bob');
          await assert.rejects(
            database.query('DELETE FROM "ChatUser" WHERE id = $1', [alice]),
            { code: '23001' },
          );
          await database.query('DELETE FROM "Conversation" WHERE id = $1', [
            conversation,
          ]);
          assert.equal(
            (
              await database.query(
                'SELECT count(*)::int AS total FROM "Message"',
              )
            ).rows[0].total,
            0,
          );
        },
      );
    } finally {
      if (app && app.exitCode === null) {
        const stopped = once(app, 'exit');
        app.kill('SIGKILL');
        await stopped;
      }
      await database?.end().catch(() => {});
      // Only remove the uniquely named container created above, after verifying its label.
      try {
        assert.equal(
          run([
            'inspect',
            '--format',
            '{{index .Config.Labels "nook.chat.test"}}',
            name,
          ]),
          'true',
        );
        run(['rm', '--force', '--volumes', name]);
      } catch (error) {
        if (!String(error).includes('No such')) {
          console.error('Temporary database cleanup failed:', error.message);
          process.exitCode = 1;
        }
      }
    }
  },
);
