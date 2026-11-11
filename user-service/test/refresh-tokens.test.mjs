import { readSession } from './helpers/session.mjs';
import { RabbitMqEventsService } from '../dist/events/rabbitmq-events.service.js';
import { MailService } from '../dist/mail/mail.service.js';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app/app.module.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

test('refresh-token verification and rotation', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const user = {
    id: randomUUID(),
    email: 'test@example.com',
    username: 'tester',
  };
  let rows = new Map();
  let lookupCount = 0;
  let createError;
  let queue = Promise.resolve();
  const delegate = {
    findUnique: async ({ where, select }) => {
      lookupCount++;
      const row = rows.get(where.id);
      if (!row) return null;
      return Object.fromEntries(
        Object.keys(select).map((key) => [
          key,
          key === 'user' ? { ...user } : row[key],
        ]),
      );
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of rows.values()) {
        if (where.id && row.id !== where.id) continue;
        if (where.userId && row.userId !== where.userId) continue;
        if (where.sessionId && row.sessionId !== where.sessionId) continue;
        if (where.tokenHash && row.tokenHash !== where.tokenHash) continue;
        if ('revokedAt' in where && row.revokedAt !== where.revokedAt) continue;
        if (where.expiresAt && row.expiresAt <= where.expiresAt.gt) continue;
        Object.assign(row, data);
        count++;
      }
      return { count };
    },
    create: async ({ data }) => {
      if (createError) throw createError;
      const row = { ...data, revokedAt: null };
      rows.set(row.id, row);
      return row;
    },
  };
  const prisma = {
    refreshToken: delegate,
    user: { findUnique: async () => ({ ...user }) },
    // Model commit/rollback and serialize competing writes in this database double.
    $transaction: (work) => {
      const result = queue.then(async () => {
        const before = structuredClone(rows);
        try {
          return await work({
            refreshToken: delegate,
            $queryRaw: async () => [],
          });
        } catch (error) {
          rows = before;
          throw error;
        }
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  function seed(overrides = {}) {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    rows.set(id, {
      id,
      userId: user.id,
      sessionId: randomUUID(),
      tokenHash: createHash('sha256').update(secret).digest('hex'),
      expiresAt: new Date(Date.now() + 604800000),
      revokedAt: null,
      ...overrides,
    });
    return { id, secret, token: `${id}.${secret}` };
  }
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RabbitMqEventsService)
    .useValue({ publishCreated: async () => {}, publishUpdated: async () => {}, publishDeleted: async () => {} })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MailService)
    .useValue({ sendVerificationEmail: async () => {}, sendPasswordResetEmail: async () => {} })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService({
        JWT_PRIVATE_KEY: keys.privateKey,
        JWT_PUBLIC_KEY: keys.publicKey,
      }),
    )
    .compile();
  const app = module.createNestApplication();
  t.after(() => app.close());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const server = app.getHttpServer();
  const service = module.get(AuthService);
  const signer = module.get(JwtService);

  await t.test(
    'rotates without a valid access token and returns a usable new pair',
    async () => {
      rows.clear();
      const original = seed();
      const expiredAccess = await signer.signAsync(
        { sub: user.id },
        { expiresIn: -1 },
      );
      const response = await request(server)
        .post('/auth/refresh')
        .auth(expiredAccess, { type: 'bearer' })
        .set("Cookie", `auth-refresh=${original.token}`)
        .send({})
        .expect(200);
      assert.equal(response.headers['cache-control'], 'no-store');
      const result = readSession(response);
      assert.deepEqual(result.user, user);
      assert.equal(result.expiresIn, 900);
      assert.equal(result.refreshExpiresIn, 604800);
      assert.ok(rows.get(original.id).revokedAt instanceof Date);
      const [id, secret] = result.refreshToken.split('.');
      assert.notEqual(id, original.id);
      assert.notEqual(secret, original.secret);
      assert.equal(Buffer.from(secret, 'base64url').length, 32);
      const stored = rows.get(id);
      assert.equal(stored.userId, user.id);
      assert.equal(stored.revokedAt, null);
      assert.equal(
        stored.tokenHash,
        createHash('sha256').update(secret).digest('hex'),
      );
      assert.ok(stored.expiresAt.getTime() > Date.now() + 604700000);
      assert.equal(JSON.stringify(stored).includes(secret), false);
      assert.equal(JSON.stringify(result).includes(stored.tokenHash), false);
      const claims = await new JwtService({
        publicKey: keys.publicKey,
      }).verifyAsync(result.accessToken, {
        algorithms: ['RS256'],
        issuer: 'user-service',
        audience: 'ft-transcendence-api',
      });
      assert.equal(claims.sub, user.id);
      assert.equal(claims.exp - claims.iat, 900);
      await request(server)
        .get('/accounts/me')
        .auth(result.accessToken, { type: 'bearer' })
        .expect(200);
      await request(server)
        .post('/auth/refresh')
        .set("Cookie", `auth-refresh=${result.refreshToken}`)
        .send({})
        .expect(200);
    },
  );

  await t.test('rejects missing, malformed and duplicate refresh cookies before database access', async () => {
    const before = lookupCount;
    for (const cookie of ['', 'auth-refresh=invalid', `auth-refresh=${randomUUID()}.short`, 'auth-refresh=a; auth-refresh=b']) {
      await request(server).post('/auth/refresh').set('Cookie', cookie).send({}).expect(401);
    }
    // A valid token supplied only in JSON is not accepted as a browser session.
    await request(server).post('/auth/refresh').send({ refreshToken: seed().token }).expect(401);
    assert.equal(lookupCount, before);
  });

  await t.test('logs out only when the refresh secret is valid', async () => {
    rows.clear();
    const active = seed();
    const wrong = `${active.id}.${randomBytes(32).toString('base64url')}`;

    await request(server)
      .post('/auth/logout')
      .set("Cookie", `auth-refresh=${wrong}`)
        .send({})
      .expect(204);
    assert.equal(rows.get(active.id).revokedAt, null);

    const response = await request(server)
      .post('/auth/logout')
      .set("Cookie", `auth-refresh=${active.token}`)
        .send({})
      .expect(204);
    assert.equal(response.text, '');
    assert.ok(rows.get(active.id).revokedAt instanceof Date);

    await request(server)
      .post('/auth/refresh')
      .set("Cookie", `auth-refresh=${active.token}`)
        .send({})
      .expect(401);
  });

  await t.test(
    'rejects unknown, expired and incorrect secrets without changing sessions',
    async () => {
      rows.clear();
      const active = seed();
      const expired = seed({ expiresAt: new Date(Date.now() - 1) });
      const revoked = seed({ revokedAt: new Date() });
      const before = structuredClone(rows);
      const wrong = randomBytes(32).toString('base64url');
      for (const token of [
        `${randomUUID()}.${wrong}`,
        `${active.id}.${wrong}`,
        `${revoked.id}.${wrong}`,
        expired.token,
      ]) {
        const response = await request(server)
          .post('/auth/refresh')
          .set("Cookie", `auth-refresh=${token}`)
        .send({})
          .expect(401);
        assert.equal(
          response.body.message,
          'Refresh token is invalid or expired',
        );
      }
      assert.deepEqual(rows, before);
    },
  );

  await t.test(
    'confirmed reuse revokes the token session and preserves other sessions',
    async () => {
      rows.clear();
      const old = seed();
      const otherSession = seed();
      const anotherUser = seed({ userId: randomUUID() });
      const first = await service.refresh({ refreshToken: old.token });
      await request(server)
        .post('/auth/refresh')
        .set("Cookie", `auth-refresh=${old.token}`)
        .send({})
        .expect(401);
      assert.ok(rows.get(first.refreshToken.split('.')[0]).revokedAt);
      assert.equal(rows.get(otherSession.id).revokedAt, null);
      assert.equal(rows.get(anotherUser.id).revokedAt, null);
    },
  );

  await t.test(
    'concurrent use has one winner and triggers reuse protection',
    async () => {
      rows.clear();
      const original = seed();
      const results = await Promise.allSettled([
        service.refresh({ refreshToken: original.token }),
        service.refresh({ refreshToken: original.token }),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const failure = results.find((r) => r.status === 'rejected');
      assert.equal(failure.reason.getStatus(), 401);
      assert.equal(rows.size, 2);
      assert.ok([...rows.values()].every((row) => row.revokedAt));
    },
  );

  await t.test(
    'rolls back consumption when storing the replacement fails',
    async () => {
      rows.clear();
      const original = seed();
      createError = new Error('Database write failed');
      await assert.rejects(
        () => service.refresh({ refreshToken: original.token }),
        (error) => error === createError,
      );
      createError = undefined;
      assert.equal(rows.size, 1);
      assert.equal(rows.get(original.id).revokedAt, null);
      await service.refresh({ refreshToken: original.token });
    },
  );

  await t.test(
    'rechecks expiry before consumption without revoking other sessions',
    async () => {
      rows.clear();
      const original = seed();
      const other = seed();
      const delayedSigner = new AuthService(prisma, {
        signAsync: async (payload) => {
          rows.get(original.id).expiresAt = new Date(Date.now() - 1);
          return signer.signAsync(payload);
        },
      });
      await assert.rejects(
        () => delayedSigner.refresh({ refreshToken: original.token }),
        (error) => error.getStatus() === 401,
      );
      assert.equal(rows.size, 2);
      assert.equal(rows.get(other.id).revokedAt, null);
    },
  );

  await t.test(
    'leaves the original token usable if signing fails',
    async () => {
      rows.clear();
      const original = seed();
      const failure = new Error('Signing failed');
      const broken = new AuthService(prisma, {
        signAsync: async () => {
          throw failure;
        },
      });
      await assert.rejects(
        () => broken.refresh({ refreshToken: original.token }),
        (error) => error === failure,
      );
      assert.equal(rows.size, 1);
      assert.equal(rows.get(original.id).revokedAt, null);
    },
  );
});
