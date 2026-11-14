// Uses a connection-local temporary User table; never changes application users.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { bootstrapSuperadmin } from '../scripts/bootstrap-superadmin-env.mjs';

test('environment bootstrap against PostgreSQL', async (t) => {
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await client.connect();
  t.after(() => client.end());
  await client.query(
    'CREATE TEMP TABLE "User" (LIKE public."User" INCLUDING ALL)',
  );
  const settings = {
    SUPERADMIN_USERNAME: 'bootstrap-test',
    SUPERADMIN_EMAIL: 'bootstrap@example.com',
    SUPERADMIN_PASSWORD: 'Test-password-123',
  };

  await t.test(
    'missing and invalid credentials fail without creating users',
    async () => {
      for (const env of [
        {},
        { ...settings, SUPERADMIN_PASSWORD: 'short' },
        { ...settings, SUPERADMIN_EMAIL: 'invalid' },
        { ...settings, SUPERADMIN_USERNAME: 'ab' },
        { ...settings, SUPERADMIN_PASSWORD: '😀'.repeat(20) },
      ]) {
        await assert.rejects(
          bootstrapSuperadmin(client, env),
          /Set SUPERADMIN|Invalid superadmin/,
        );
        assert.equal((await client.query('SELECT * FROM "User"')).rowCount, 0);
      }
    },
  );

  await t.test(
    'creates a login-compatible hash and preserves it on restart',
    async () => {
      assert.equal(
        await bootstrapSuperadmin(client, settings),
        'Initial superadmin created.',
      );
      const before = (await client.query('SELECT * FROM "User"')).rows[0];
      assert.equal(before.role, 'SUPERADMIN');
      assert.equal(before.username, settings.SUPERADMIN_USERNAME);
      assert.equal(before.email, settings.SUPERADMIN_EMAIL);
      assert.ok(
        await bcrypt.compare(settings.SUPERADMIN_PASSWORD, before.passwordHash),
      );
      assert.equal(bcrypt.getRounds(before.passwordHash), 12);
      await bootstrapSuperadmin(client, {
        ...settings,
        SUPERADMIN_PASSWORD: 'Changed-password',
      });
      await bootstrapSuperadmin(client, {});
      assert.deepEqual((await client.query('SELECT * FROM "User"')).rows, [
        before,
      ]);
      await client.query('TRUNCATE "User"');
    },
  );

  await t.test(
    'username and email collisions never promote or overwrite users',
    async () => {
      for (const [username, email] of [
        [settings.SUPERADMIN_USERNAME, 'other@example.com'],
        ['other-user', settings.SUPERADMIN_EMAIL],
      ]) {
        await client.query(
          'INSERT INTO "User" ("id", "username", "email", "updatedAt") VALUES ($1, $2, $3, NOW())',
          [randomUUID(), username, email],
        );
        const before = (await client.query('SELECT * FROM "User"')).rows;
        await assert.rejects(
          bootstrapSuperadmin(client, settings),
          /already in use/,
        );
        assert.deepEqual(
          (await client.query('SELECT * FROM "User"')).rows,
          before,
        );
        await client.query('TRUNCATE "User"');
      }
    },
  );

  await t.test('insert failure rolls back cleanly', async () => {
    await client.query(
      'ALTER TABLE "User" ADD CONSTRAINT reject_bootstrap CHECK ("role" <> \'SUPERADMIN\')',
    );
    await assert.rejects(bootstrapSuperadmin(client, settings), {
      code: '23514',
    });
    assert.equal((await client.query('SELECT * FROM "User"')).rowCount, 0);
  });
});
