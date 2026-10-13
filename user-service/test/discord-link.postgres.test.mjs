// Uses a unique temporary schema; existing schemas and application records are untouched.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { AuthService } from '../dist/auth/auth.service.js';

test(
  'Discord linking constraints and concurrent claims on PostgreSQL',
  { timeout: 30000 },
  async (t) => {
    let connectionString = process.env.AUTH_TEST_DATABASE_URL;
    if (!connectionString) {
      for (const key of [
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
      ])
        assert.ok(process.env[key], `Set ${key}, or AUTH_TEST_DATABASE_URL`);
      const url = new URL('postgresql://localhost');
      url.hostname = process.env.POSTGRES_HOST;
      url.port = process.env.POSTGRES_PORT;
      url.username = process.env.POSTGRES_USER;
      url.password = process.env.POSTGRES_PASSWORD;
      url.pathname = `/${encodeURIComponent(process.env.POSTGRES_DB)}`;
      connectionString = url.toString();
    }
    const schema = `discord_link_test_${randomUUID().replaceAll('-', '')}`;
    assert.match(schema, /^discord_link_test_[a-f0-9]{32}$/);
    const admin = new pg.Client({ connectionString });
    await admin.connect();
    let created = false;
    let prisma;
    t.after(async () => {
      try {
        await prisma?.$disconnect();
        if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await admin.query(`SET search_path TO "${schema}"`);
    const migrations = new URL('../prisma/migrations/', import.meta.url);
    for (const entry of (await readdir(migrations, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const sql = await readFile(
        new URL(`${entry.name}/migration.sql`, migrations),
        'utf8',
      );
      await admin.query(sql);
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString, options: `-c search_path=${schema}` },
        { schema },
      ),
    });
    const auth = new AuthService(prisma, {}); // Linking must not need JWT signing.
    const user = () => {
      const id = randomUUID();
      return prisma.user.create({
        data: { id, username: id, email: `${id}@example.com` },
      });
    };
    const profile = (id) => ({
      id,
      username: 'discord',
      displayName: 'Discord',
      email: null,
      verified: false,
      avatarUrl: null,
    });
    const statuses = (results) =>
      results
        .map((r) => (r.status === 'fulfilled' ? 200 : r.reason.getStatus()))
        .sort();

    await t.test(
      'two users cannot claim the same Discord identity',
      async () => {
        const [a, b] = await Promise.all([user(), user()]);
        const results = await Promise.allSettled([
          auth.linkDiscord(a.id, profile('123456789012345678')),
          auth.linkDiscord(b.id, profile('123456789012345678')),
        ]);
        assert.deepEqual(statuses(results), [200, 409]);
        assert.equal(
          await prisma.authProvider.count({
            where: { providerUserId: '123456789012345678' },
          }),
          1,
        );
      },
    );
    await t.test(
      'one user cannot attach two different Discord identities concurrently',
      async () => {
        const a = await user();
        const results = await Promise.allSettled([
          auth.linkDiscord(a.id, profile('223456789012345678')),
          auth.linkDiscord(a.id, profile('323456789012345678')),
        ]);
        assert.deepEqual(statuses(results), [200, 409]);
        assert.equal(
          await prisma.authProvider.count({ where: { userId: a.id } }),
          1,
        );
      },
    );
    await t.test(
      'concurrent identical links are idempotent and never create sessions',
      async () => {
        const a = await user();
        const results = await Promise.allSettled([
          auth.linkDiscord(a.id, profile('423456789012345678')),
          auth.linkDiscord(a.id, profile('423456789012345678')),
        ]);
        assert.deepEqual(statuses(results), [200, 200]);
        assert.equal(
          await prisma.authProvider.count({ where: { userId: a.id } }),
          1,
        );
        assert.equal(await prisma.refreshToken.count(), 0);
        assert.deepEqual(
          await prisma.user.findUnique({ where: { id: a.id } }),
          a,
        );
      },
    );
    await t.test(
      'only one caller can consume the same owned state',
      async () => {
        const a = await user();
        const data = {
          tokenHash: randomUUID(),
          browserHash: randomUUID(),
          purpose: 'LINK',
          userId: a.id,
          expiresAt: new Date(Date.now() + 600000),
        };
        await prisma.oAuthState.create({ data });
        const consume = () =>
          prisma.oAuthState.deleteMany({
            where: {
              tokenHash: data.tokenHash,
              browserHash: data.browserHash,
              purpose: 'LINK',
              userId: a.id,
              expiresAt: { gt: new Date() },
            },
          });
        const results = await Promise.all([consume(), consume()]);
        assert.deepEqual(results.map((r) => r.count).sort(), [0, 1]);
      },
    );
    await t.test(
      'deleting a local user cascades pending states and prevents linking',
      async () => {
        const a = await user();
        await prisma.oAuthState.create({
          data: {
            tokenHash: randomUUID(),
            browserHash: randomUUID(),
            purpose: 'LINK',
            userId: a.id,
            expiresAt: new Date(Date.now() + 600000),
          },
        });
        await prisma.user.delete({ where: { id: a.id } });
        assert.equal(
          await prisma.oAuthState.count({ where: { userId: a.id } }),
          0,
        );
        await assert.rejects(
          auth.linkDiscord(a.id, profile('523456789012345678')),
          (e) => e.getStatus() === 401,
        );
      },
    );
    await t.test(
      'the database rejects a link challenge without an owner',
      async () => {
        await assert.rejects(
          admin.query(
            'INSERT INTO "OAuthState" ("tokenHash", "browserHash", "expiresAt", "purpose") VALUES ($1, $2, $3, $4)',
            [randomUUID(), randomUUID(), new Date(), 'LINK'],
          ),
          (e) => e.code === '23514',
        );
      },
    );
  },
);
