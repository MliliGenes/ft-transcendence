import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app/app.module.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { Prisma } from '../dist/generated/prisma/client.js';

test('account endpoints use the authenticated identity and validate changes', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const id = '15f154f1-b37f-4fe7-955f-e8f4de3ceb8d';
  let user = {
    id,
    username: 'tester',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: null,
    displayName: null,
    avatarUrl: null,
    status: 'OFFLINE',
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'secret',
  };
  const operations = [];
  const project = (select) =>
    Object.fromEntries(Object.keys(select).map((key) => [key, user[key]]));
  const prisma = {
    user: {
      findUnique: async ({ where, select }) => {
        operations.push('read');
        assert.equal(where.id, id);
        return user && project(select);
      },
      update: async ({ where, data, select }) => {
        operations.push('update');
        assert.equal(where.id, id);
        if (!user)
          throw new Prisma.PrismaClientKnownRequestError('missing', {
            code: 'P2025',
            clientVersion: '7',
          });
        if (data.username === 'taken' || data.email === 'taken@example.com') {
          throw new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: '7',
          });
        }
        Object.assign(
          user,
          Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          ),
        );
        return project(select);
      },
      delete: async ({ where }) => {
        assert.equal(where.id, id);
        operations.push('delete-user');
        user = null;
      },
    },
    $queryRaw: async (_sql, userId) => {
      assert.equal(userId, id);
      operations.push('lock');
      return user ? [{ id }] : [];
    },
    refreshToken: {
      deleteMany: async ({ where }) => {
        assert.equal(where.userId, id);
        operations.push('delete-tokens');
      },
    },
    authProvider: {
      deleteMany: async ({ where }) => {
        assert.equal(where.userId, id);
        operations.push('delete-providers');
      },
    },
    $transaction: async (callback) => callback(prisma),
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
  const token = await module.get(JwtService).signAsync({ sub: id });

  await t.test(
    'all endpoints reject unauthenticated requests before database access',
    async () => {
      for (const method of ['get', 'patch', 'delete'])
        await request(server)[method]('/accounts/me').expect(401);
      assert.deepEqual(operations, []);
    },
  );
  await t.test(
    'read excludes secrets and ignores a different query identity',
    async () => {
      const result = await request(server)
        .get('/accounts/me?id=someone-else')
        .auth(token, { type: 'bearer' })
        .expect(200);
      assert.equal(result.body.id, id);
      assert.equal(result.body.passwordHash, undefined);
      assert.equal(result.headers['cache-control'], 'no-store');
    },
  );
  await t.test('rejects invalid, empty, and protected fields', async () => {
    const before = operations.length;
    for (const body of [
      {},
      { username: null },
      { username: 'ab' },
      { email: null },
      { email: 'invalid' },
      { firstName: 4 },
      { avatarUrl: 'javascript:alert(1)' },
      { id: 'someone-else' },
      { passwordHash: 'new' },
      { emailVerifiedAt: new Date() },
      { status: 'ONLINE' },
    ])
      await request(server)
        .patch('/accounts/me')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(400);
    assert.equal(operations.length, before);
  });
  await t.test(
    'partial updates preserve omitted fields and allow clearing profile fields',
    async () => {
      const result = await request(server)
        .patch('/accounts/me')
        .auth(token, { type: 'bearer' })
        .send({ displayName: 'New Name', firstName: null })
        .expect(200);
      assert.equal(result.body.displayName, 'New Name');
      assert.equal(result.body.firstName, null);
      assert.equal(result.body.username, 'tester');
      assert.equal(user.passwordHash, 'secret');
      assert.equal(result.body.passwordHash, undefined);
    },
  );
  await t.test(
    'email updates clear verification and unique conflicts return 409',
    async () => {
      const result = await request(server)
        .patch('/accounts/me')
        .auth(token, { type: 'bearer' })
        .send({ email: 'new@example.com' })
        .expect(200);
      assert.equal(result.body.emailVerifiedAt, null);
      for (const body of [
        { username: 'taken' },
        { email: 'taken@example.com' },
      ]) {
        await request(server)
          .patch('/accounts/me')
          .auth(token, { type: 'bearer' })
          .send(body)
          .expect(409);
      }
    },
  );
  await t.test(
    'delete removes dependent records first and subsequent access returns 404',
    async () => {
      operations.length = 0;
      await request(server)
        .delete('/accounts/me')
        .auth(token, { type: 'bearer' })
        .expect(204);
      assert.deepEqual(operations, [
        'lock',
        'delete-tokens',
        'delete-providers',
        'delete-user',
      ]);
      await request(server)
        .get('/accounts/me')
        .auth(token, { type: 'bearer' })
        .expect(404);
      await request(server)
        .patch('/accounts/me')
        .auth(token, { type: 'bearer' })
        .send({ username: 'newname' })
        .expect(404);
      await request(server)
        .delete('/accounts/me')
        .auth(token, { type: 'bearer' })
        .expect(404);
    },
  );
});
