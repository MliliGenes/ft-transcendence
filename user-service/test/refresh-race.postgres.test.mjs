// Requires a separate migrated database named *_test via AUTH_TEST_DATABASE_URL.
// Exercises real PostgreSQL locks; only records created by these tests are removed.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { AuthService } from '../dist/auth/auth.service.js';

test(
  'logout and refresh serialize on PostgreSQL',
  { timeout: 30000 },
  async (t) => {
    const connectionString = process.env.AUTH_TEST_DATABASE_URL;
    assert.ok(
      connectionString,
      'Set AUTH_TEST_DATABASE_URL to a separate migrated test database',
    );
    assert.match(
      new URL(connectionString).pathname,
      /_test$/,
      'Use a separate *_test database',
    );
    const contenderName = `auth-race-${randomUUID()}`;
    const base = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    const holder = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    const contender = new PrismaClient({
      adapter: new PrismaPg({
        connectionString,
        application_name: contenderName,
      }),
    });
    const observer = new pg.Pool({ connectionString });
    t.after(async () => {
      await Promise.all([
        base.$disconnect(),
        holder.$disconnect(),
        contender.$disconnect(),
        observer.end(),
      ]);
    });
    const keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const jwt = new JwtService({
      ...keys,
      signOptions: {
        algorithm: 'RS256',
        expiresIn: 900,
        issuer: 'user-service',
        audience: 'ft-transcendence-api',
      },
    });
    const service = new AuthService(base, jwt, {
      sendVerificationEmail: async () => {},
    });

    async function seed(testContext) {
      const unique = randomUUID();
      const dto = {
        username: `race_${unique.slice(0, 8)}`,
        email: `${unique}@example.com`,
        password: 'test password',
      };
      const original = await service.register(dto);
      testContext.after(async () => {
        await base.refreshToken.deleteMany({
          where: { userId: original.user.id },
        });
        await base.user.delete({ where: { id: original.user.id } });
      });
      const other = await service.login(dto);
      return { original, other };
    }

    async function race(firstMethod, firstToken, secondMethod, secondToken) {
      const acquired = Promise.withResolvers();
      const release = Promise.withResolvers();
      const wrapped = {
        refreshToken: holder.refreshToken,
        $transaction: (work) =>
          holder.$transaction(
            async (tx) =>
              work({
                refreshToken: tx.refreshToken,
                $queryRaw: async (...args) => {
                  const result = await tx.$queryRaw(...args);
                  acquired.resolve();
                  await release.promise;
                  return result;
                },
              }),
            { timeout: 10000 },
          ),
      };
      const settle = (promise) =>
        promise.then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      const first = settle(
        new AuthService(wrapped, jwt)[firstMethod]({
          refreshToken: firstToken,
        }),
      );
      let second;
      try {
        await Promise.race([
          acquired.promise,
          delay(3000).then(() => {
            throw new Error('First operation did not acquire its lock');
          }),
        ]);
        second = settle(
          new AuthService(contender, jwt)[secondMethod]({
            refreshToken: secondToken,
          }),
        );
        // Confirm the second operation is blocked on an actual PostgreSQL lock.
        let blocked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const result = await observer.query(
            "SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'",
            [contenderName],
          );
          if (result.rowCount > 0) {
            blocked = true;
            break;
          }
          await delay(10);
        }
        assert.ok(
          blocked,
          'Competing operation must wait on the same database lock',
        );
      } finally {
        release.resolve();
        await Promise.all([first, second]);
      }
      return Promise.all([first, second]);
    }

    async function assertSessionRevoked(original, other) {
      const row = await base.refreshToken.findUniqueOrThrow({
        where: { id: original.refreshToken.split('.')[0] },
      });
      const active = await base.refreshToken.count({
        where: {
          userId: original.user.id,
          sessionId: row.sessionId,
          revokedAt: null,
        },
      });
      assert.equal(active, 0);
      const unrelated = await base.refreshToken.findUniqueOrThrow({
        where: { id: other.refreshToken.split('.')[0] },
      });
      assert.equal(unrelated.revokedAt, null);
    }

    await t.test(
      'refresh first: logout revokes its replacement',
      async (subtest) => {
        const { original, other } = await seed(subtest);
        const [refresh, logout] = await race(
          'refresh',
          original.refreshToken,
          'logout',
          original.refreshToken,
        );
        assert.equal(refresh.error, undefined);
        assert.equal(logout.error, undefined);
        await assertSessionRevoked(original, other);
        await assert.rejects(
          () => service.refresh({ refreshToken: refresh.value.refreshToken }),
          (error) => error.getStatus() === 401,
        );
      },
    );

    await t.test(
      'logout first: refresh cannot create a replacement',
      async (subtest) => {
        const { original, other } = await seed(subtest);
        const [logout, refresh] = await race(
          'logout',
          original.refreshToken,
          'refresh',
          original.refreshToken,
        );
        assert.equal(logout.error, undefined);
        assert.equal(refresh.error.getStatus(), 401);
        await assertSessionRevoked(original, other);
        assert.equal(
          await base.refreshToken.count({
            where: { userId: original.user.id },
          }),
          2,
        );
      },
    );

    await t.test(
      'replay revocation also catches a replacement being created concurrently',
      async (subtest) => {
        const { original, other } = await seed(subtest);
        const current = await service.refresh({
          refreshToken: original.refreshToken,
        });
        const [rotation, replay] = await race(
          'refresh',
          current.refreshToken,
          'refresh',
          original.refreshToken,
        );
        assert.equal(rotation.error, undefined);
        assert.equal(replay.error.getStatus(), 401);
        await assertSessionRevoked(original, other);
      },
    );

    await t.test(
      'logout with an old token revokes later generations and is idempotent',
      async (subtest) => {
        const { original, other } = await seed(subtest);
        const current = await service.refresh({
          refreshToken: original.refreshToken,
        });
        await service.refresh({ refreshToken: current.refreshToken });
        await service.logout({ refreshToken: original.refreshToken });
        await service.logout({ refreshToken: original.refreshToken });
        await assertSessionRevoked(original, other);
      },
    );
  },
);
