import { MailService } from '../dist/mail/mail.service.js';
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
import { AccountsService } from '../dist/accounts/accounts.service.js';
import { RabbitMqEventsService } from '../dist/events/rabbitmq-events.service.js';

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
    role: 'USER',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: null,
    displayName: null,
    avatarUrl: null,
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
      return user ? [{ id, email: user.email, role: user.role }] : [];
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
    .overrideProvider(RabbitMqEventsService)
    .useValue({
      publishCreated: async () => {},
      publishUpdated: async () => {},
      publishDeleted: async () => {},
    })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MailService)
    .useValue({
      sendVerificationEmail: async () => {},
      sendPasswordResetEmail: async () => {},
    })
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
    'rejects privilege injection without writing any fields',
    async () => {
      const before = operations.length;
      for (const body of [
        { role: 'SUPERADMIN' },
        { role: null },
        { role: { set: 'SUPERADMIN' } },
        { displayName: 'Injected', role: 'SUPERADMIN' },
        { roles: ['SUPERADMIN'] },
        { isAdmin: true },
        { data: { role: 'SUPERADMIN' } },
        { user: { update: { role: 'SUPERADMIN' } } },
      ]) {
        await request(server)
          .patch('/accounts/me')
          .auth(token, { type: 'bearer' })
          .send(body)
          .expect(400);
      }
      assert.equal(operations.length, before);
      assert.equal(user.role, 'USER');
      assert.equal(user.displayName, null);
    },
  );
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
      assert.equal(user.role, 'USER');
      assert.equal(result.body.passwordHash, undefined);
    },
  );
  await t.test(
    'unchanged or omitted email preserves verification',
    async () => {
      const verifiedAt = user.emailVerifiedAt.toISOString();
      for (const body of [
        { email: user.email },
        { email: user.email, displayName: 'Same email' },
        { displayName: 'Email omitted' },
      ]) {
        const result = await request(server)
          .patch('/accounts/me')
          .auth(token, { type: 'bearer' })
          .send(body)
          .expect(200);
        assert.equal(result.body.emailVerifiedAt, verifiedAt);
      }
    },
  );
  await t.test(
    'changed email clears verification and unique conflicts return 409',
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

test('account search matches public username and display name results with pagination', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      $transaction: async (queries) => Promise.all(queries),
      user: {
        findMany: async ({ where, skip, take, orderBy, select }) => {
          assert.deepEqual(where, {
            OR: [
              { username: { contains: 'ali', mode: 'insensitive' } },
              { displayName: { contains: 'ali', mode: 'insensitive' } },
            ],
          });
          assert.equal(skip, 2);
          assert.equal(take, 2);
          assert.deepEqual(orderBy, [{ username: 'asc' }, { id: 'asc' }]);
          assert.deepEqual(select, {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bannerUrl: true,
            bio: true,
            statusText: true,
            statusIcon: true,
            createdAt: true,
          });
          return [
            {
              id: 'user-1',
              username: 'alice',
              displayName: 'A Person',
              avatarUrl: null,
              bannerUrl: null,
              bio: null,
              statusText: null,
              statusIcon: null,
              createdAt: new Date('2024-01-01T00:00:00Z'),
            },
          ];
        },
        count: async ({ where }) => {
          assert.deepEqual(
            where.OR.map((field) => Object.keys(field)[0]),
            ['username', 'displayName'],
          );
          return 3;
        },
      },
    })
    .overrideProvider(RabbitMqEventsService)
    .useValue({})
    .overrideProvider(MailService)
    .useValue({
      sendVerificationEmail: async () => {},
      sendPasswordResetEmail: async () => {},
    })
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

  const response = await request(app.getHttpServer())
    .get('/accounts/search?username=%20ali%20&page=2&limit=2')
    .expect(200);

  assert.equal(response.body.users[0].username, 'alice');
  assert.equal(response.body.users[0].displayName, 'A Person');
  assert.deepEqual(
    {
      total: response.body.total,
      page: response.body.page,
      limit: response.body.limit,
      totalPages: response.body.totalPages,
    },
    {
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    },
  );
  assert.equal(response.body.users[0].passwordHash, undefined);
  assert.equal(response.body.users[0].email, undefined);
  await request(app.getHttpServer())
    .get(`/accounts/search?username=${'a'.repeat(101)}`)
    .expect(400);
  await request(app.getHttpServer())
    .get('/accounts/search?username=ali&page=0')
    .expect(400);
  await request(app.getHttpServer())
    .get('/accounts/search?username=ali&limit=101')
    .expect(400);
  await request(app.getHttpServer())
    .get('/accounts/search?sortBy=email')
    .expect(400);
  await request(app.getHttpServer())
    .get('/accounts/search?sortOrder=up')
    .expect(400);
  await request(app.getHttpServer())
    .get('/accounts/search?joinedWithin=2d')
    .expect(400);
  await request(app.getHttpServer())
    .get('/accounts/search?hasStatus=yes')
    .expect(400);
});

test('account search applies filters and sorting, and browses without a term', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const calls = [];

  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      $transaction: async (queries) => Promise.all(queries),
      user: {
        findMany: async (args) => {
          calls.push(args);
          return [];
        },
        count: async () => 0,
      },
    })
    .overrideProvider(RabbitMqEventsService)
    .useValue({})
    .overrideProvider(MailService)
    .useValue({
      sendVerificationEmail: async () => {},
      sendPasswordResetEmail: async () => {},
    })
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

  const before = Date.now();
  await request(app.getHttpServer())
    .get(
      '/accounts/search?username=ali&sortBy=createdAt&sortOrder=desc&joinedWithin=30d&hasStatus=true&hasBio=false',
    )
    .expect(200);
  const filtered = calls.at(-1);
  assert.deepEqual(filtered.orderBy, [{ createdAt: 'desc' }, { id: 'asc' }]);
  const [termCondition, joinedCondition, statusCondition, bioCondition] =
    filtered.where.AND;
  assert.deepEqual(
    termCondition.OR.map((field) => Object.keys(field)[0]),
    ['username', 'displayName'],
  );
  const since = joinedCondition.createdAt.gte.getTime();
  assert.ok(
    since <= before - 30 * 86_400_000 + 5_000 &&
      since >= before - 30 * 86_400_000 - 5_000,
  );
  assert.deepEqual(statusCondition, {
    NOT: [{ statusText: null }, { statusText: '' }],
  });
  assert.deepEqual(bioCondition, { OR: [{ bio: null }, { bio: '' }] });

  await request(app.getHttpServer())
    .get('/accounts/search?sortBy=displayName')
    .expect(200);
  const browse = calls.at(-1);
  assert.deepEqual(browse.where, {});
  assert.deepEqual(browse.orderBy, [
    { displayName: { sort: 'asc', nulls: 'last' } },
    { id: 'asc' },
  ]);

  await request(app.getHttpServer())
    .get('/accounts/search?username=%20')
    .expect(200);
  assert.deepEqual(calls.at(-1).where, {});
});

test('friendship mutations require the caller to be part of the relationship', async () => {
  const service = new AccountsService({
    user: {
      update: async () => ({}),
    },
  });

  const friendships = new (
    await import('../dist/social/friendships.service.js')
  ).FriendshipsService({
    friendship: {
      findUnique: async ({ where }) => ({
        id: where.id,
        requesterId: 'user-a',
        addresseeId: 'user-b',
        status: 'PENDING',
      }),
      update: async () => ({ id: 'friend-1', status: 'ACCEPTED' }),
      delete: async () => ({ id: 'friend-1', status: 'PENDING' }),
    },
  });

  await assert.rejects(
    () => friendships.acceptFriendship('friend-1', 'user-c'),
    (error) => error?.name === 'ForbiddenException',
  );

  await assert.rejects(
    () => friendships.deleteFriendship('friend-1', 'user-c'),
    (error) => error?.name === 'ForbiddenException',
  );

  const pendingDelete = await friendships.deleteFriendship(
    'friend-1',
    'user-a',
  );
  assert.equal(pendingDelete.id, 'friend-1');

  const acceptedFriendship = {
    id: 'friend-2',
    requesterId: 'user-a',
    addresseeId: 'user-b',
    status: 'ACCEPTED',
  };

  const deleteAllowedService = new (
    await import('../dist/social/friendships.service.js')
  ).FriendshipsService({
    friendship: {
      findUnique: async ({ where }) => {
        if (where.id === 'friend-2') return acceptedFriendship;
        return null;
      },
      delete: async ({ where }) => ({
        id: where.id,
        requesterId: 'user-a',
        addresseeId: 'user-b',
        status: 'ACCEPTED',
      }),
    },
  });

  const acceptedDelete = await deleteAllowedService.deleteFriendship(
    'friend-2',
    'user-a',
  );
  assert.equal(acceptedDelete.id, 'friend-2');

  await service.updateMe('verified-user-id', {
    displayName: 'Allowed',
    id: 'other-user-id',
    role: 'SUPERADMIN',
    passwordHash: 'injected',
    emailVerifiedAt: new Date(),
    authProviders: { create: { provider: 'DISCORD' } },
  });
});

test('friendship creation rejects self requests and handles existing relationships', async () => {
  const { FriendshipsService } =
    await import('../dist/social/friendships.service.js');
  const updates = [];
  const relationships = new Map([
    [
      'user-a:user-b',
      {
        id: 'friend-1',
        requesterId: 'user-a',
        addresseeId: 'user-b',
        status: 'PENDING',
      },
    ],
    [
      'user-c:user-d',
      {
        id: 'friend-2',
        requesterId: 'user-c',
        addresseeId: 'user-d',
        status: 'ACCEPTED',
      },
    ],
  ]);
  let targetExists = true;
  let targetBlocked = false;
  const friendships = new FriendshipsService({
    friendship: {
      findFirst: async ({ where }) => {
        const [first, second] = where.OR;
        return (
          relationships.get(`${first.requesterId}:${first.addresseeId}`) ??
          relationships.get(`${second.requesterId}:${second.addresseeId}`) ??
          null
        );
      },
      update: async ({ where, data }) => {
        updates.push({ where, data });
        return { id: where.id, status: data.status };
      },
      create: async () => {
        throw new Error('create should not be called for guarded requests');
      },
    },
    $transaction: async (work) =>
      work({
        $queryRaw: async () => [],
        block: {
          findFirst: async () => (targetBlocked ? { id: 'block-ab' } : null),
        },
        user: {
          findUnique: async () => (targetExists ? { id: 'user-a' } : null),
        },
        friendship: {
          findFirst: async ({ where }) => {
            const [first, second] = where.OR;
            return (
              relationships.get(`${first.requesterId}:${first.addresseeId}`) ??
              relationships.get(
                `${second.requesterId}:${second.addresseeId}`,
              ) ??
              null
            );
          },
          create: async () => {
            throw new Error('create should not be called for guarded requests');
          },
        },
      }),
  });

  await assert.rejects(
    () => friendships.createFriendship('user-a', 'user-a'),
    (error) => error?.name === 'BadRequestException',
  );

  targetBlocked = true;
  await assert.rejects(
    () => friendships.createFriendship('user-a', 'user-b'),
    (error) => error?.name === 'ForbiddenException',
  );
  targetBlocked = false;

  targetExists = false;
  await assert.rejects(
    () => friendships.createFriendship('user-a', 'missing-user'),
    (error) => error?.name === 'NotFoundException',
  );
  targetExists = true;

  await assert.rejects(
    () => friendships.createFriendship('user-b', 'user-a'),
    (error) => error?.name === 'ConflictException',
  );
  assert.deepEqual(updates, []);

  await assert.rejects(
    () => friendships.createFriendship('user-c', 'user-d'),
    (error) => error?.name === 'ConflictException',
  );
});

test('friends expose the relationship ID for removal from either side', async () => {
  const { FriendshipsService } =
    await import('../dist/social/friendships.service.js');
  const alice = { id: 'user-a', username: 'alice' };
  const bob = { id: 'user-b', username: 'bob' };
  const service = new FriendshipsService({
    friendship: {
      findMany: async ({ where, select }) => {
        assert.equal(where.status, 'ACCEPTED');
        assert.equal(select.id, true);
        assert.equal(select.requester.select.passwordHash, undefined);
        return [
          {
            id: 'relationship-ab',
            requesterId: alice.id,
            addresseeId: bob.id,
            requester: alice,
            addressee: bob,
          },
        ];
      },
    },
  });
  assert.deepEqual(await service.getFriendships(alice.id), [
    { ...bob, friendshipId: 'relationship-ab' },
  ]);
  assert.deepEqual(await service.getFriendships(bob.id), [
    { ...alice, friendshipId: 'relationship-ab' },
  ]);
});
