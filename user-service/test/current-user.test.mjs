import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../dist/app/app.module.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

test('GET /accounts/me uses the verified access-token identity', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const user = {
    id: '15f154f1-b37f-4fe7-955f-e8f4de3ceb8d',
    username: 'tester',
    email: 'test@example.com',
    firstName: 'Private',
    lastName: 'Name',
    displayName: 'Test Player',
    avatarUrl: '/accounts/avatar-placeholder',
    bannerUrl: null,
    createdAt: '2026-09-28T00:00:00.000Z',
    passwordHash: await bcrypt.hash('test password', 12),
    authProviders: [{ provider: 'DISCORD' }],
  };
  let lookups = 0;
  let lastPage;
  const publicUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    createdAt: user.createdAt,
  };
  const prisma = {
    $transaction: async (queries, options) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      return Promise.all(queries);
    },
    user: {
      findMany: async ({ skip, take, select, orderBy }) => {
        lastPage = { skip, take };
        assert.deepEqual(orderBy, [{ createdAt: 'desc' }, { id: 'asc' }]);
        assert.deepEqual(
          Object.keys(select).sort(),
          Object.keys(publicUser).sort(),
        );
        return skip === 0 ? [publicUser] : [];
      },
      count: async () => 1,
      findUnique: async ({ where, select }) => {
        lookups++;
        if (where.id !== user.id && where.email !== user.email) return null;
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, user[key]]),
        );
      },
    },
    refreshToken: { create: async ({ data }) => data },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
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
  const signer = module.get(JwtService);
  const login = await request(server)
    .post('/auth/login')
    .set('Origin', 'http://localhost:5173')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email: user.email, password: 'test password' })
    .expect(200);
  const token = login.body.accessToken;

  await t.test(
    'accepts a login token and returns only the current profile',
    async () => {
      const response = await request(server)
        .get('/accounts/me')
        .auth(token, { type: 'bearer' })
        .expect(200);
      assert.deepEqual(response.body, {
        ...publicUser,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasPassword: true,
        hasDiscord: true,
        hasGithub: false,
      });
      assert.equal(response.headers['cache-control'], 'no-store');
      const withQuery = await request(server)
        .get('/accounts/me?id=someone-else')
        .auth(token, { type: 'bearer' })
        .expect(200);
      assert.deepEqual(withQuery.body, response.body);
    },
  );

  await t.test(
    'returns the expanded public profile without private fields',
    async () => {
      const response = await request(server)
        .get(`/accounts/${user.id}`)
        .expect(200);
      assert.deepEqual(response.body, publicUser);
    },
  );

  await t.test(
    'paginates public profiles and validates query limits',
    async () => {
      const response = await request(server).get('/accounts').expect(200);
      assert.deepEqual(response.body, {
        users: [publicUser],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      assert.deepEqual(lastPage, { skip: 0, take: 10 });
      const next = await request(server)
        .get('/accounts?page=2&limit=1')
        .expect(200);
      assert.deepEqual(next.body, {
        users: [],
        total: 1,
        page: 2,
        limit: 1,
        totalPages: 1,
      });
      assert.deepEqual(lastPage, { skip: 1, take: 1 });
      for (const query of [
        'page=0',
        'page=1.5',
        'page=1000001',
        'limit=101',
        'limit=0',
        'limit=abc',
      ]) {
        await request(server).get(`/accounts?${query}`).expect(400);
      }
      await request(server).get('/accounts/not-a-uuid').expect(400);
      await request(server)
        .get('/accounts/00000000-0000-4000-8000-000000000001')
        .expect(404);
    },
  );

  await t.test('removes the old auth profile routes', async () => {
    for (const path of [
      '/auth/users',
      '/auth/user/me',
      `/auth/user/${user.id}`,
    ]) {
      await request(server)
        .get(path)
        .auth(token, { type: 'bearer' })
        .expect(404);
    }
  });

  await t.test(
    'rejects missing or malformed authorization before database access',
    async () => {
      const before = lookups;
      await request(server).get('/accounts/me').expect(401);
      await request(server)
        .get('/accounts/me')
        .query({ accessToken: token })
        .expect(401);
      for (const header of [
        'Bearer',
        `Basic ${token}`,
        `Bearer ${token} extra`,
      ]) {
        await request(server)
          .get('/accounts/me')
          .set('Authorization', header)
          .expect(401);
      }
      assert.equal(lookups, before);
    },
  );

  await t.test(
    'rejects bad signatures, expiry, issuer, audience, algorithm and claims',
    async () => {
      const before = lookups;
      const [header, body, signature] = token.split('.');
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
      const changedPayload = Buffer.from(
        JSON.stringify({
          ...payload,
          sub: '00000000-0000-4000-8000-000000000001',
        }),
      ).toString('base64url');
      const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const noExpirySigner = new JwtService({
        privateKey: keys.privateKey,
        signOptions: {
          algorithm: 'RS256',
          issuer: 'user-service',
          audience: 'ft-transcendence-api',
        },
      });
      const invalidTokens = [
        'not-a-jwt',
        `15f154f1-b37f-4fe7-955f-e8f4de3ceb8d.${'a'.repeat(43)}`,
        `${header}.${changedPayload}.${signature}`,
        await signer.signAsync({ sub: user.id }, { expiresIn: -1 }),
        await signer.signAsync({ sub: user.id }, { notBefore: '1h' }),
        await signer.signAsync({ sub: user.id }, { issuer: 'wrong-service' }),
        await signer.signAsync({ sub: user.id }, { audience: 'wrong-api' }),
        await signer.signAsync({ sub: user.id }, { algorithm: 'RS512' }),
        await signer.signAsync(
          { sub: user.id },
          {
            privateKey: otherKeys.privateKey.export({
              type: 'pkcs8',
              format: 'pem',
            }),
          },
        ),
        await new JwtService({ secret: 'untrusted-secret' }).signAsync({
          sub: user.id,
        }),
        await noExpirySigner.signAsync({ sub: user.id }),
        await signer.signAsync({}),
        await signer.signAsync({ sub: 123 }),
        await signer.signAsync({ sub: 'not-a-uuid' }),
      ];
      for (const invalid of invalidTokens) {
        await request(server)
          .get('/accounts/me')
          .auth(invalid, { type: 'bearer' })
          .expect(401);
      }
      assert.equal(lookups, before);
    },
  );

  await t.test(
    'returns 404 when the verified account no longer exists',
    async () => {
      const deletedUserToken = await signer.signAsync({
        sub: '00000000-0000-4000-8000-000000000001',
      });
      const response = await request(server)
        .get('/accounts/me')
        .auth(deletedUserToken, { type: 'bearer' })
        .expect(404);
      assert.equal(response.body.message, 'Account not found');
    },
  );
});
