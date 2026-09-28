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

test('GET /auth/user/me uses the verified access-token identity', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const user = {
    id: '15f154f1-b37f-4fe7-955f-e8f4de3ceb8d',
    username: 'tester',
    email: 'test@example.com',
    passwordHash: await bcrypt.hash('test password', 12),
  };
  let lookups = 0;
  const prisma = {
    user: {
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
    .send({ email: user.email, password: 'test password' })
    .expect(200);
  const token = login.body.accessToken;

  await t.test(
    'accepts a login token and returns only the current profile',
    async () => {
      const response = await request(server)
        .get('/auth/user/me')
        .auth(token, { type: 'bearer' })
        .expect(200);
      assert.deepEqual(response.body, {
        id: user.id,
        username: user.username,
      });
      assert.equal(response.headers['cache-control'], 'no-store');
      const withQuery = await request(server)
        .get('/auth/user/me?id=someone-else')
        .auth(token, { type: 'bearer' })
        .expect(200);
      assert.deepEqual(withQuery.body, response.body);
    },
  );

  await t.test('leaves the public profile response unchanged', async () => {
    const response = await request(server)
      .get(`/auth/user/${user.id}`)
      .expect(200);
    assert.deepEqual(response.body, { id: user.id, username: user.username });
  });

  await t.test(
    'rejects missing or malformed authorization before database access',
    async () => {
      const before = lookups;
      await request(server).get('/auth/user/me').expect(401);
      await request(server)
        .get('/auth/user/me')
        .query({ accessToken: token })
        .expect(401);
      for (const header of [
        'Bearer',
        `Basic ${token}`,
        `Bearer ${token} extra`,
      ]) {
        await request(server)
          .get('/auth/user/me')
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
        login.body.refreshToken,
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
          .get('/auth/user/me')
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
        .get('/auth/user/me')
        .auth(deletedUserToken, { type: 'bearer' })
        .expect(404);
      assert.equal(response.body.message, 'User not found');
    },
  );
});
