import { RabbitMqEventsService } from '../dist/events/rabbitmq-events.service.js';
import { MailService } from '../dist/mail/mail.service.js';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { AppModule } from '../dist/app/app.module.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { Prisma } from '../dist/generated/prisma/client.js';

test('superadmin HTTP API', async (t) => {
  const adminId = randomUUID(),
    userId = randomUUID();
  const users = new Map([
    [
      adminId,
      {
        id: adminId,
        username: 'admin',
        email: 'admin@example.com',
        role: 'SUPERADMIN',
        createdAt: new Date(),
        emailVerifiedAt: new Date(),
        passwordHash: 'hidden',
      },
    ],
    [
      userId,
      {
        id: userId,
        username: 'alice',
        email: 'alice@example.com',
        role: 'USER',
        createdAt: new Date(),
        passwordHash: 'hidden',
      },
    ],
  ]);
  const project = (u, select) =>
    u ? Object.fromEntries(Object.keys(select).map((k) => [k, u[k]])) : null;
  let lastFind,
    lastCount,
    writes = 0;
  const removed = [];
  const duplicate = () =>
    new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7',
    });
  const prisma = {
    user: {
      findUnique: async ({ where, select }) =>
        project(users.get(where.id), select),
      findMany: async (args) => {
        lastFind = args;
        return [project(users.get(userId), args.select)];
      },
      count: async ({ where } = {}) => {
        lastCount = where;
        return [...users.values()].filter(
          (u) =>
            (!where?.role || u.role === where.role) &&
            (!where?.createdAt ||
              (u.createdAt >= where.createdAt.gte &&
                u.createdAt <= where.createdAt.lte)),
        ).length;
      },
      create: async ({ data, select }) => {
        if (
          [...users.values()].some(
            (u) => u.email === data.email || u.username === data.username,
          )
        )
          throw duplicate();
        const u = { id: randomUUID(), createdAt: new Date(), ...data };
        users.set(u.id, u);
        writes++;
        return project(u, select);
      },
      update: async ({ where, data, select }) => {
        if (data.username === 'taken') throw duplicate();
        const u = users.get(where.id);
        Object.assign(
          u,
          Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
          ),
        );
        writes++;
        return project(u, select);
      },
      delete: async ({ where }) => {
        removed.push('user');
        users.delete(where.id);
        writes++;
      },
    },
    refreshToken: {
      deleteMany: async ({ where }) => removed.push(`tokens:${where.userId}`),
    },
    authProvider: {
      deleteMany: async ({ where }) =>
        removed.push(`providers:${where.userId}`),
    },
    $queryRaw: async (_query, id) => (users.has(id) ? [users.get(id)] : []),
    $executeRaw: async () => 1,
    $transaction: async (operation, options) => {
      if (Array.isArray(operation)) {
        assert.equal(options.isolationLevel, 'RepeatableRead');
        return Promise.all(operation);
      }
      return operation(prisma);
    },
  };
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
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
  app.useLogger(false);
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
  const token = await module.get(JwtService).signAsync({ sub: adminId });
  const userToken = await module.get(JwtService).signAsync({ sub: userId });
  const api = (method, path) =>
    request(server)
      [method](`/superadmin/${path}`)
      .auth(token, { type: 'bearer' });
  await t.test(
    'all routes enforce authentication and superadmin role',
    async () => {
      for (const [method, path] of [
        ['get', 'stats'],
        ['get', 'users'],
        ['get', `users/${userId}`],
        ['post', 'users'],
        ['patch', `users/${userId}`],
        ['patch', `users/${userId}/role`],
        ['delete', `users/${userId}`],
      ]) {
        await request(server)[method](`/superadmin/${path}`).expect(401);
        await request(server)
          [method](`/superadmin/${path}`)
          .auth(userToken, { type: 'bearer' })
          .expect(403);
      }
      assert.equal(writes, 0);
    },
  );
  await t.test(
    'stats use a consistent snapshot and rolling registration windows',
    async () => {
      const { body } = await api('get', 'stats').expect(200);
      assert.equal(body.totalUsers, 2);
      assert.equal(body.regularUsers, 1);
      assert.equal(body.superadmins, 1);
      assert.equal(body.newUsersLast7Days, 2);
      assert.equal(body.newUsersLast30Days, 2);
      assert.ok(!Number.isNaN(Date.parse(body.asOf)));
    },
  );
  await t.test(
    'builds filtered substring search, stable sorting and matching count',
    async () => {
      const res = await api('get', 'users')
        .query({
          search: ' Al_% ',
          role: 'USER',
          createdFrom: '2026-01-01',
          createdTo: '2026-12-31',
          sortBy: 'username',
          sortOrder: 'asc',
          page: 2,
          limit: 5,
        })
        .expect(200);
      assert.deepEqual(lastFind.where, lastCount);
      assert.equal(lastFind.where.OR[0].username.contains, 'Al\\_\\%');
      assert.equal(lastFind.where.OR[0].username.mode, 'insensitive');
      assert.equal(lastFind.where.role, 'USER');
      assert.equal(lastFind.skip, 5);
      assert.equal(lastFind.take, 5);
      assert.deepEqual(lastFind.orderBy, [{ username: 'asc' }, { id: 'asc' }]);
      assert.equal(res.body.users[0].passwordHash, undefined);
      assert.equal(res.body.users[0].role, 'USER');
      assert.equal(res.headers['cache-control'], 'no-store');
      await api('get', 'users').expect(200);
      assert.equal(lastFind.take, 10);
      assert.equal(lastFind.skip, 0);
    },
  );
  await t.test(
    'rejects malformed filters, sort fields, UUIDs and protected update fields',
    async () => {
      for (const q of [
        { page: 0 },
        { limit: 101 },
        { role: 'ADMIN' },
        { sortBy: 'passwordHash' },
        { sortOrder: 'invalid' },
        { createdFrom: 'bad' },
        { createdFrom: '2026-02-01', createdTo: '2026-01-01' },
      ])
        await api('get', 'users').query(q).expect(400);
      await api('get', 'users/invalid').expect(400);
      await api('get', `users/${randomUUID()}`).expect(404);
      for (const body of [
        {},
        { role: 'SUPERADMIN' },
        { passwordHash: 'x' },
        { emailVerifiedAt: new Date() },
        { email: null },
      ])
        await api('patch', `users/${userId}`).send(body).expect(400);
      await api('patch', `users/${userId}/role`)
        .send({ role: 'ADMIN' })
        .expect(400);
    },
  );
  let createdId;
  await t.test(
    'creates a user with a hashed password and no session or secret response',
    async () => {
      const body = {
        username: 'new_user',
        email: 'new@example.com',
        password: 'long-password',
      };
      const res = await api('post', 'users').send(body).expect(201);
      createdId = res.body.id;
      assert.equal(res.body.role, 'USER');
      assert.equal(res.body.passwordHash, undefined);
      assert.equal(res.body.accessToken, undefined);
      assert.ok(
        await bcrypt.compare(body.password, users.get(createdId).passwordHash),
      );
      await api('post', 'users').send(body).expect(409);
      await api('post', 'users')
        .send({ ...body, role: null })
        .expect(400);
    },
  );
  await t.test(
    'updates allowed fields and only resets verification when email changes',
    async () => {
      const prior = users.get(adminId).emailVerifiedAt;
      await api('patch', `users/${adminId}`)
        .send({ email: 'admin@example.com', displayName: 'Boss' })
        .expect(200);
      assert.equal(users.get(adminId).emailVerifiedAt, prior);
      await api('patch', `users/${adminId}`)
        .send({ email: 'boss@example.com' })
        .expect(200);
      assert.equal(users.get(adminId).emailVerifiedAt, null);
      await api('patch', `users/${userId}`)
        .send({ username: 'taken' })
        .expect(409);
    },
  );
  await t.test(
    'protects the last superadmin including self-service deletion',
    async () => {
      await api('delete', `users/${adminId}`).expect(409);
      await api('patch', `users/${adminId}/role`)
        .send({ role: 'USER' })
        .expect(409);
      await request(server)
        .delete('/accounts/me')
        .auth(token, { type: 'bearer' })
        .expect(403);
      assert.equal(users.get(adminId).role, 'SUPERADMIN');
    },
  );
  await t.test(
    'supports promotions and demotions when another superadmin exists',
    async () => {
      await api('patch', `users/${userId}/role`)
        .send({ role: 'SUPERADMIN' })
        .expect(200);
      await api('patch', `users/${userId}/role`)
        .send({ role: 'USER' })
        .expect(200);
      await request(server)
        .get('/superadmin/stats')
        .auth(userToken, { type: 'bearer' })
        .expect(403);
    },
  );
  await t.test(
    'deletes dependent authentication records before the user',
    async () => {
      await api('delete', `users/${createdId}`).expect(204);
      assert.deepEqual(removed, [
        `tokens:${createdId}`,
        `providers:${createdId}`,
        'user',
      ]);
      await api('get', `users/${createdId}`).expect(404);
      await api('delete', `users/${createdId}`).expect(404);
    },
  );
});
