import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { JwtService } from '@nestjs/jwt';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
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
    let source;

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
          run(
            ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
            {
              timeout: 2000,
            },
          );
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

      await t.test(
        'upgrades existing profiles and message history without resetting data',
        async () => {
          const schema = 'upgrade_' + randomUUID().replaceAll('-', '');
          await database.query('CREATE SCHEMA ' + schema);
          await database.query('SET search_path TO ' + schema + ', public');
          try {
            await database.query(
              readFileSync(
                join(
                  root,
                  'prisma/migrations/20261017000100_private_chat_foundation/migration.sql',
                ),
                'utf8',
              ),
            );
            const a = '00000000-0000-4000-8000-000000000001';
            const b = '00000000-0000-4000-8000-000000000002';
            const conversation = randomUUID();
            await database.query(
              'INSERT INTO "ChatUser" (id,username,"sourceUpdatedAt") VALUES ($1,$2,now()),($3,$4,now())',
              [a, 'before-upgrade', b, 'other'],
            );
            await database.query(
              'INSERT INTO "Conversation" (id,"dmUserAId","dmUserBId","updatedAt") VALUES ($1,$2,$3,now())',
              [conversation, a, b],
            );
            const sentAt = new Date('2026-10-16T12:00:00.000Z');
            await database.query(
              'INSERT INTO "Message" (id,"conversationId","authorId",content,"clientRequestId","requestHash","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
              [
                randomUUID(),
                conversation,
                a,
                'Existing history',
                randomUUID(),
                'c'.repeat(64),
                sentAt,
              ],
            );
            await database.query(
              readFileSync(
                join(
                  root,
                  'prisma/migrations/20261018000100_chat01_projection_channels/migration.sql',
                ),
                'utf8',
              ),
            );
            const user = (
              await database.query(
                'SELECT username,"syncedAt" FROM "ChatUser" WHERE id=$1',
                [a],
              )
            ).rows[0];
            assert.equal(user.username, 'before-upgrade');
            assert.equal(user.syncedAt.getTime(), 0);
            const dm = (
              await database.query(
                'SELECT kind,"lastMessageAt" FROM "Conversation" WHERE id=$1',
                [conversation],
              )
            ).rows[0];
            assert.equal(dm.kind, 'DM');
            assert.equal(dm.lastMessageAt.toISOString(), sentAt.toISOString());
            assert.equal(
              (await database.query('SELECT content FROM "Message"')).rows[0]
                .content,
              'Existing history',
            );
          } finally {
            await database.query('SET search_path TO public');
          }
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

      await t.test(
        'enforces DM/channel shapes and adds projection/list timestamps',
        async () => {
          const groupId = randomUUID();
          await database.query(
            'INSERT INTO "Group" (id,name,"updatedAt") VALUES ($1,$2,now())',
            [groupId, 'Shape test'],
          );
          const channelId = randomUUID();
          await database.query(
            'INSERT INTO "Conversation" (id,kind,"groupId",name,"updatedAt") VALUES ($1,\'CHANNEL\',$2,$3,now())',
            [channelId, groupId, 'general'],
          );
          await assert.rejects(
            database.query(
              'INSERT INTO "Conversation" (id,kind,"groupId",name,"dmUserAId","dmUserBId","updatedAt") VALUES ($1,\'CHANNEL\',$2,$3,$4,$5,now())',
              [randomUUID(), groupId, 'bad', alice, bob],
            ),
            { code: '23514' },
          );
          await assert.rejects(
            database.query(
              'INSERT INTO "Conversation" (id,kind,"groupId",name,"updatedAt") VALUES ($1,\'CHANNEL\',$2,$3,now())',
              [randomUUID(), groupId, ' '],
            ),
            { code: '23514' },
          );
          await assert.rejects(
            database.query(
              'INSERT INTO "Conversation" (id,kind,"updatedAt") VALUES ($1,\'DM\',now())',
              [randomUUID()],
            ),
            { code: '23514' },
          );
          const timestamps = await database.query(
            'SELECT "syncedAt" FROM "ChatUser" WHERE id=$1',
            [alice],
          );
          assert.ok(timestamps.rows[0].syncedAt instanceof Date);
          await database.query(
            'UPDATE "Conversation" SET "lastMessageAt"=now() WHERE id=$1',
            [conversation],
          );
          assert.ok(
            (
              await database.query(
                'SELECT "lastMessageAt" FROM "Conversation" WHERE id=$1',
                [conversation],
              )
            ).rows[0].lastMessageAt instanceof Date,
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
        async (phase) => {
          const alice = '10000000-0000-4000-8000-000000000001';
          const bob = '10000000-0000-4000-8000-000000000002';
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
          const internalKey = randomBytes(32).toString('hex');
          let privacy = 'allow';
          let beforeBlockReply = async () => {};
          const charlie = '00000000-0000-4000-8000-000000000003';
          const dave = '00000000-0000-4000-8000-000000000004';
          const activeIds = new Set([alice, bob, charlie, dave]);
          const blockCalls = [];
          source = createHttpServer(async (req, res) => {
            if (req.headers['x-internal-key'] !== internalKey) {
              res.writeHead(401);
              res.end();
              return;
            }
            const requestUrl = new URL(req.url, 'http://localhost');
            if (requestUrl.pathname === '/internal/blocks/check') {
              blockCalls.push([
                requestUrl.searchParams.get('a'),
                requestUrl.searchParams.get('b'),
              ]);
              await beforeBlockReply();
              res.setHeader('Content-Type', 'application/json');
              if (privacy === 'unavailable') res.writeHead(503);
              res.end(
                JSON.stringify(
                  privacy === 'malformed'
                    ? {}
                    : { blocked: privacy === 'blocked' },
                ),
              );
              return;
            }
            const ids = requestUrl.searchParams.get('ids').split(',');
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify(
                ids.map((id) => ({
                  id,
                  username: activeIds.has(id) ? 'test-user' : null,
                  displayName: null,
                  avatarUrl: null,
                  updatedAt: new Date().toISOString(),
                  deleted: !activeIds.has(id),
                })),
              ),
            );
          });
          source.listen(0, '127.0.0.1');
          await once(source, 'listening');
          const sourceUrl = 'http://127.0.0.1:' + source.address().port;
          env.USER_SERVICE_URL = sourceUrl;
          env.INTERNAL_API_SECRET = internalKey;
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
          const tokens = new Map([[alice, jwt]]);
          for (const id of [bob, charlie, dave])
            tokens.set(
              id,
              await new JwtService().signAsync(
                { sub: id },
                {
                  privateKey,
                  algorithm: 'RS256',
                  issuer: 'user-service',
                  audience: 'ft-transcendence-api',
                  expiresIn: 900,
                },
              ),
            );
          const http = async (user, path, method = 'GET', body) => {
            const response = await fetch(base + path, {
              method,
              signal: AbortSignal.timeout(5000),
              headers: {
                Authorization: 'Bearer ' + tokens.get(user),
                ...(body === undefined
                  ? {}
                  : { 'Content-Type': 'application/json' }),
              },
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            });
            return { status: response.status, body: await response.json() };
          };
          let dm;
          const messagesPath = () =>
            '/chat/conversations/' + dm.id + '/messages';
          await phase.test(
            'CHAT-02: simultaneous opposite DM opens return one canonical pair',
            async () => {
              const results = await Promise.all([
                http(alice, '/chat/dms', 'POST', { userId: bob.toUpperCase() }),
                http(bob, '/chat/dms', 'POST', { userId: alice }),
              ]);
              assert.deepEqual(
                results.map((r) => r.status),
                [201, 201],
              );
              assert.equal(results[0].body.id, results[1].body.id);
              dm = results[0].body;
              assert.equal(dm.dmUserA.id, alice);
              assert.equal(dm.dmUserB.id, bob);
              assert.equal('syncedAt' in dm.dmUserA, false);
              assert.equal(
                (
                  await database.query(
                    'SELECT count(*)::int AS n FROM "Conversation" WHERE "dmUserAId"=$1 AND "dmUserBId"=$2',
                    [alice, bob],
                  )
                ).rows[0].n,
                1,
              );
            },
          );
          await phase.test(
            'CHAT-02: rejects self-DMs, unknown accounts and spoofed fields',
            async () => {
              assert.equal(
                (await http(alice, '/chat/dms', 'POST', { userId: alice }))
                  .status,
                400,
              );
              assert.equal(
                (
                  await http(alice, '/chat/dms', 'POST', {
                    userId: randomUUID(),
                  })
                ).status,
                404,
              );
              assert.equal(
                (
                  await http(alice, '/chat/dms', 'POST', {
                    userId: bob,
                    authorId: charlie,
                  })
                ).status,
                400,
              );
              assert.equal(
                (await http(alice, '/chat/dms', 'POST', null)).status,
                400,
              );
            },
          );
          let firstMessage;
          const retryId = randomUUID();
          await phase.test(
            'CHAT-02: concurrent retries save one trimmed message and a matching activity timestamp',
            async () => {
              const body = {
                content: '  Hello Bob!  ',
                clientRequestId: retryId,
              };
              const results = await Promise.all([
                http(alice, messagesPath(), 'POST', body),
                http(alice, messagesPath(), 'POST', body),
              ]);
              assert.deepEqual(
                results.map((r) => r.status),
                [201, 201],
              );
              assert.equal(results[0].body.id, results[1].body.id);
              firstMessage = results[0].body;
              assert.equal(firstMessage.content, 'Hello Bob!');
              assert.equal(firstMessage.authorId, alice);
              assert.equal('requestHash' in firstMessage, false);
              const row = (
                await database.query(
                  'SELECT "lastMessageAt" FROM "Conversation" WHERE id=$1',
                  [dm.id],
                )
              ).rows[0];
              assert.equal(
                row.lastMessageAt.toISOString(),
                firstMessage.createdAt,
              );
              assert.equal(
                (
                  await database.query(
                    'SELECT count(*)::int AS n FROM "Message" WHERE "authorId"=$1 AND "clientRequestId"=$2',
                    [alice, retryId],
                  )
                ).rows[0].n,
                1,
              );
              assert.equal(
                (
                  await http(alice, messagesPath(), 'POST', {
                    ...body,
                    content: 'different',
                  })
                ).status,
                409,
              );
            },
          );
          await phase.test(
            'CHAT-02: request IDs are scoped to author and bound to conversation',
            async () => {
              const secondDm = await http(alice, '/chat/dms', 'POST', {
                userId: charlie,
              });
              assert.equal(secondDm.status, 201);
              assert.equal(
                (
                  await http(
                    alice,
                    '/chat/conversations/' + secondDm.body.id + '/messages',
                    'POST',
                    { content: 'Hello Bob!', clientRequestId: retryId },
                  )
                ).status,
                409,
              );
              assert.equal(
                (
                  await http(bob, messagesPath(), 'POST', {
                    content: 'Hello Alice!',
                    clientRequestId: retryId,
                  })
                ).status,
                201,
              );
            },
          );
          await phase.test(
            'CHAT-02: outsiders cannot read/send or list other people’s conversations',
            async () => {
              assert.equal((await http(dave, messagesPath())).status, 404);
              assert.equal(
                (
                  await http(dave, messagesPath(), 'POST', {
                    content: 'intrude',
                    clientRequestId: randomUUID(),
                  })
                ).status,
                404,
              );
              assert.deepEqual(
                (await http(dave, '/chat/conversations')).body.items,
                [],
              );
              assert.equal(
                (await http(alice, '/chat/conversations/not-a-uuid/messages'))
                  .status,
                400,
              );
            },
          );
          await phase.test(
            'CHAT-02: validates content, retry UUIDs and all pagination options',
            async () => {
              for (const content of [
                '',
                '   ',
                'x'.repeat(2001),
                'a\u0000b',
                42,
              ])
                assert.equal(
                  (
                    await http(alice, messagesPath(), 'POST', {
                      content,
                      clientRequestId: randomUUID(),
                    })
                  ).status,
                  400,
                );
              assert.equal(
                (
                  await http(alice, messagesPath(), 'POST', {
                    content: 'text',
                    clientRequestId: 'bad',
                  })
                ).status,
                400,
              );
              assert.equal(
                (
                  await http(alice, messagesPath(), 'POST', {
                    content: 'text',
                    clientRequestId: randomUUID(),
                    authorId: bob,
                  })
                ).status,
                400,
              );
              assert.equal(
                (
                  await http(alice, messagesPath(), 'POST', {
                    content: '😀'.repeat(2000),
                    clientRequestId: randomUUID(),
                  })
                ).status,
                201,
              );
              for (const suffix of [
                '?limit=0',
                '?limit=101',
                '?limit=-1',
                '?limit=2.5',
                '?limit=1&limit=2',
                '?cursor=bad',
                '?unknown=1',
              ])
                assert.equal(
                  (await http(alice, messagesPath() + suffix)).status,
                  400,
                );
            },
          );
          await phase.test(
            'CHAT-02: both-direction blocks deny open/send but preserve readable history',
            async () => {
              privacy = 'blocked';
              for (const [sender, target] of [
                [alice, bob],
                [bob, alice],
              ]) {
                assert.equal(
                  (await http(sender, '/chat/dms', 'POST', { userId: target }))
                    .status,
                  403,
                );
                assert.equal(
                  (
                    await http(sender, messagesPath(), 'POST', {
                      content: 'blocked',
                      clientRequestId: randomUUID(),
                    })
                  ).status,
                  403,
                );
                assert.equal((await http(sender, messagesPath())).status, 200);
              }
              privacy = 'unavailable';
              assert.equal(
                (await http(alice, '/chat/dms', 'POST', { userId: bob }))
                  .status,
                503,
              );
              assert.equal(
                (
                  await http(alice, messagesPath(), 'POST', {
                    content: 'no privacy answer',
                    clientRequestId: randomUUID(),
                  })
                ).status,
                503,
              );
              privacy = 'malformed';
              assert.equal(
                (
                  await http(alice, messagesPath(), 'POST', {
                    content: 'bad privacy answer',
                    clientRequestId: randomUUID(),
                  })
                ).status,
                503,
              );
              privacy = 'allow';
              assert.ok(blockCalls.some(([a, b]) => a === bob && b === alice));
            },
          );
          await phase.test(
            'CHAT-02: sends paginate without duplicates, survive another read and update activity ordering',
            async () => {
              const sent = await Promise.all(
                Array.from({ length: 4 }, (_, i) =>
                  http(bob, messagesPath(), 'POST', {
                    content: 'reply ' + i,
                    clientRequestId: randomUUID(),
                  }),
                ),
              );
              assert.ok(sent.every((r) => r.status === 201));
              const seen = [];
              let cursor = null;
              do {
                const page = await http(
                  alice,
                  messagesPath() +
                    '?limit=2' +
                    (cursor ? '&cursor=' + cursor : ''),
                );
                assert.equal(page.status, 200);
                seen.push(...page.body.items.map((m) => m.id));
                cursor = page.body.nextCursor;
              } while (cursor);
              assert.equal(seen.length, 7);
              assert.equal(new Set(seen).size, 7);
              assert.ok(seen.includes(firstMessage.id));
              assert.deepEqual(
                (await http(bob, messagesPath() + '?limit=100')).body.items.map(
                  (m) => m.id,
                ),
                seen,
              );
              const list = await http(alice, '/chat/conversations?limit=1');
              assert.equal(list.status, 200);
              assert.equal(list.body.items[0].id, dm.id);
              assert.ok(list.body.nextCursor);
              assert.equal(
                (
                  await http(
                    alice,
                    '/chat/conversations?limit=1&cursor=' +
                      list.body.nextCursor,
                  )
                ).body.items.length,
                1,
              );
              assert.equal(
                (
                  await http(
                    bob,
                    '/chat/conversations?cursor=' + list.body.nextCursor,
                  )
                ).status,
                400,
              );
              assert.equal(
                (
                  await http(
                    alice,
                    messagesPath() + '?cursor=' + list.body.nextCursor,
                  )
                ).status,
                400,
              );
            },
          );
          await phase.test(
            'CHAT-02: a delayed send preserves newer metadata and replay does not regress activity',
            async () => {
              const updatedAt = new Date('2030-01-01T00:00:00.000Z');
              beforeBlockReply = async () => {
                await database.query(
                  'UPDATE "Conversation" SET "updatedAt"=$2 WHERE id=$1',
                  [dm.id, updatedAt],
                );
              };
              try {
                const sent = await http(bob, messagesPath(), 'POST', {
                  content: 'metadata race',
                  clientRequestId: randomUUID(),
                });
                assert.equal(sent.status, 201);
                const current = (
                  await database.query(
                    'SELECT "updatedAt", "lastMessageAt" FROM "Conversation" WHERE id=$1',
                    [dm.id],
                  )
                ).rows[0];
                assert.equal(
                  current.updatedAt.toISOString(),
                  updatedAt.toISOString(),
                );
                const retry = await http(alice, messagesPath(), 'POST', {
                  content: firstMessage.content,
                  clientRequestId: retryId,
                });
                assert.equal(retry.status, 201);
                assert.equal(retry.body.id, firstMessage.id);
                const after = (
                  await database.query(
                    'SELECT "lastMessageAt" FROM "Conversation" WHERE id=$1',
                    [dm.id],
                  )
                ).rows[0];
                assert.equal(
                  after.lastMessageAt.toISOString(),
                  current.lastMessageAt.toISOString(),
                );
              } finally {
                beforeBlockReply = async () => {};
              }
            },
          );
          await phase.test(
            'CHAT-02: saved history survives restarting the Chat process',
            async () => {
              const stopped = once(app, 'exit');
              app.kill('SIGTERM');
              await stopped;
              app = spawn(process.execPath, ['dist/main.js'], {
                cwd: root,
                env: {
                  ...env,
                  PORT: String(appPort),
                  JWT_PUBLIC_KEY: publicKey,
                },
                stdio: ['ignore', 'ignore', 'pipe'],
              });
              app.stderr.on('data', () => {});
              for (let i = 0; i < 60; i++) {
                try {
                  if (
                    (
                      await fetch(base + '/health', {
                        signal: AbortSignal.timeout(500),
                      })
                    ).status === 200
                  )
                    break;
                } catch {}
                if (i === 59)
                  throw new Error('Restarted Chat did not become healthy');
                await delay(200);
              }
              const history = await http(alice, messagesPath());
              assert.equal(history.status, 200);
              assert.ok(
                history.body.items.some(
                  (message) => message.id === firstMessage.id,
                ),
              );
            },
          );
          await phase.test(
            'CHAT-02: channel access uses current membership; reads stop after removal',
            async () => {
              const group = randomUUID(),
                channel = randomUUID();
              await database.query(
                `INSERT INTO "Group" (id,name,"updatedAt") VALUES ($1,'test group',now())`,
                [group],
              );
              await database.query(
                `INSERT INTO "GroupMember" ("groupId","userId",role) VALUES ($1,$2,'ADMIN')`,
                [group, bob],
              );
              await database.query(
                `INSERT INTO "Conversation" (id,kind,"groupId",name,"updatedAt") VALUES ($1,'CHANNEL',$2,'general',now())`,
                [channel, group],
              );
              const path = '/chat/conversations/' + channel + '/messages';
              assert.equal((await http(alice, path)).status, 404);
              assert.equal(
                (
                  await http(bob, path, 'POST', {
                    content: 'members only',
                    clientRequestId: randomUUID(),
                  })
                ).status,
                201,
              );
              await database.query(
                'DELETE FROM "GroupMember" WHERE "groupId"=$1 AND "userId"=$2',
                [group, bob],
              );
              assert.equal((await http(bob, path)).status, 404);
              assert.equal(
                (
                  await http(bob, path, 'POST', {
                    content: 'removed',
                    clientRequestId: randomUUID(),
                  })
                ).status,
                404,
              );
            },
          );
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
        'projection refresh, concurrent inserts, stale data and deletion cleanup',
        async () => {
          const { DatabaseService } =
            await import('../dist/database/database.service.js');
          const { UserProjectionService } =
            await import('../dist/users/user-projection.service.js');
          const { ConfigService } = await import('@nestjs/config');
          const prismaDb = new DatabaseService(
            new ConfigService({ DATABASE_URL: url }),
          );
          await prismaDb.onModuleInit();
          const snapshots = new Map();
          let calls = 0;
          const source = {
            async getUsers(ids) {
              calls++;
              return {
                users: ids
                  .filter((id) => snapshots.has(id))
                  .map((id) => ({ ...snapshots.get(id) })),
                missingIds: ids.filter((id) => !snapshots.has(id)),
                asOf: new Date().toISOString(),
              };
            },
          };
          const projection = new UserProjectionService(prismaDb, source);
          const add = (id, username = 'fixture') =>
            snapshots.set(id, {
              id,
              username,
              displayName: 'Public name',
              avatarUrl: '/accounts/' + id + '/avatar',
              updatedAt: '2026-10-18T10:00:00.000Z',
            });
          const first = randomUUID();
          const second = randomUUID();
          add(first, 'new-user');
          add(second, 'other-user');
          try {
            await Promise.all(
              Array.from({ length: 8 }, () =>
                projection.ensureUsers([first, second]),
              ),
            );
            assert.equal(
              await prismaDb.chatUser.count({
                where: { id: { in: [first, second] } },
              }),
              2,
            );
            const count = calls;
            await projection.ensureUsers([first]);
            assert.equal(
              calls,
              count,
              'fresh profiles must use the metadata cache',
            );
            snapshots.set(first, {
              ...snapshots.get(first),
              username: 'newer-name',
              updatedAt: '2026-10-18T11:00:00.000Z',
            });
            await prismaDb.chatUser.update({
              where: { id: first },
              data: { syncedAt: new Date(Date.now() - 11 * 60 * 1000) },
            });
            await projection.ensureUsers([first]);
            assert.equal(
              (await prismaDb.chatUser.findUnique({ where: { id: first } }))
                .username,
              'newer-name',
            );
            snapshots.set(first, {
              ...snapshots.get(first),
              username: 'older-name',
              updatedAt: '2026-10-18T09:00:00.000Z',
            });
            await projection.ensureUsers([first], true);
            assert.equal(
              (await prismaDb.chatUser.findUnique({ where: { id: first } }))
                .username,
              'newer-name',
            );

            const group = await prismaDb.group.create({
              data: {
                name: 'Surviving group',
                members: {
                  create: [
                    { userId: first, role: 'ADMIN' },
                    { userId: second, role: 'MEMBER' },
                  ],
                },
              },
            });
            const only = await prismaDb.group.create({
              data: {
                name: 'Empty after deletion',
                members: { create: { userId: first, role: 'ADMIN' } },
              },
            });
            await prismaDb.conversation.create({
              data: { kind: 'CHANNEL', groupId: only.id, name: 'general' },
            });
            const pair = [first, second].sort();
            const dm = await prismaDb.conversation.create({
              data: { dmUserAId: pair[0], dmUserBId: pair[1] },
            });
            const retained = await prismaDb.message.create({
              data: {
                conversationId: dm.id,
                authorId: first,
                content: 'Retained history',
                clientRequestId: randomUUID(),
                requestHash: 'b'.repeat(64),
              },
            });

            let release;
            let begun;
            const started = new Promise((resolve) => {
              begun = resolve;
            });
            const delayedSource = {
              getUsers: async () => {
                begun();
                return new Promise((resolve) => {
                  release = resolve;
                });
              },
            };
            const delayed = new UserProjectionService(prismaDb, delayedSource);
            const oldSnapshot = { ...snapshots.get(first) };
            const oldRequest = delayed.ensureUsers([first], true);
            await started;
            snapshots.delete(first);
            await assert.rejects(
              projection.ensureUsers([first], true),
              /accounts are unavailable/,
            );
            release({
              users: [oldSnapshot],
              missingIds: [],
              asOf: new Date().toISOString(),
            });
            await assert.rejects(oldRequest, /accounts are unavailable/);
            const tombstone = await prismaDb.chatUser.findUnique({
              where: { id: first },
            });
            assert.equal(tombstone.username, null);
            assert.equal(tombstone.displayName, null);
            assert.equal(tombstone.avatarUrl, null);
            assert.ok(tombstone.deletedAt);
            assert.ok(
              await prismaDb.message.findUnique({ where: { id: retained.id } }),
            );
            assert.equal(
              await prismaDb.groupMember.count({ where: { userId: first } }),
              0,
            );
            assert.equal(
              (
                await prismaDb.groupMember.findUnique({
                  where: {
                    groupId_userId: { groupId: group.id, userId: second },
                  },
                })
              ).role,
              'ADMIN',
            );
            assert.equal(
              await prismaDb.group.findUnique({ where: { id: only.id } }),
              null,
            );
            assert.equal(
              await prismaDb.conversation.count({
                where: { groupId: only.id },
              }),
              0,
            );
            await prismaDb.conversation.delete({ where: { id: dm.id } });

            const adminA = randomUUID(),
              adminB = randomUUID(),
              member = randomUUID();
            for (const id of [adminA, adminB, member]) add(id);
            await projection.ensureUsers([adminA, adminB, member]);
            const concurrent = await prismaDb.group.create({
              data: {
                name: 'Concurrent admin deletion',
                members: {
                  create: [
                    { userId: adminA, role: 'ADMIN' },
                    { userId: adminB, role: 'ADMIN' },
                    { userId: member, role: 'MEMBER' },
                  ],
                },
              },
            });
            snapshots.delete(adminA);
            snapshots.delete(adminB);
            const results = await Promise.allSettled([
              projection.ensureUsers([adminA], true),
              projection.ensureUsers([adminB], true),
            ]);
            assert.ok(
              results.every(
                (result) =>
                  result.status === 'rejected' &&
                  /accounts are unavailable/.test(result.reason.message),
              ),
            );
            const remaining = await prismaDb.groupMember.findMany({
              where: { groupId: concurrent.id },
            });
            assert.equal(remaining.length, 1);
            assert.equal(remaining[0].userId, member);
            assert.equal(remaining[0].role, 'ADMIN');
          } finally {
            await prismaDb.onModuleDestroy();
          }
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
                'SELECT count(*)::int AS total FROM "Message" WHERE "conversationId"=$1',
                [conversation],
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
      if (source) {
        source.closeAllConnections();
        await new Promise((resolve) => source.close(resolve));
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
