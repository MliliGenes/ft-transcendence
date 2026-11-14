import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../dist/app/app.module.js';
import { PrismaService } from '../../dist/prisma/prisma.service.js';
import { MailService } from '../../dist/mail/mail.service.js';
import { RabbitMqEventsService } from '../../dist/events/rabbitmq-events.service.js';

test('Discord harness teardown isolation fixture', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const config = {
    JWT_PRIVATE_KEY: keys.privateKey,
    JWT_PUBLIC_KEY: keys.publicKey,
    DISCORD_CLIENT_ID: '123456789012345678', // gitleaks:allow -- synthetic public app ID.
    DISCORD_CLIENT_SECRET: 'test-secret',
    DISCORD_REDIRECT_URI: 'http://localhost:3000/auth/discord/callback',
  };
  const states = new Map();
  const users = new Map();
  const providers = new Map();
  const sessions = [];

  const defaultRemote = () => ({
    id: '223456789012345678',
    username: 'discord_player',
    global_name: 'Discord Player',
    email: 'discord@example.com',
    verified: true,
  });

  let remote = defaultRemote();
  let remoteStatus = 200;
  let remoteFailure = false;
  let badToken = false;
  let expectedRedirect;

  const resetStubState = () => {
    remoteStatus = 200;
    remoteFailure = false;
    badToken = false;
    remote = defaultRemote();
    config.DISCORD_CLIENT_SECRET = 'test-secret';
    config.DISCORD_REDIRECT_URI = 'http://localhost:3000/auth/discord/callback';
    config.NODE_ENV = 'test';
    expectedRedirect = undefined;
  };

  const safe = (user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
  });

  const prisma = {
    oAuthState: {
      findUnique: async ({ where }) => states.get(where.tokenHash) ?? null,
      create: async ({ data }) => {
        states.set(data.tokenHash, data);
        return data;
      },
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [key, item] of states) {
          const matches = where.tokenHash
            ? key === where.tokenHash &&
              item.browserHash === where.browserHash &&
              item.purpose === where.purpose &&
              item.userId === where.userId &&
              item.expiresAt > where.expiresAt.gt
            : item.expiresAt <= where.expiresAt.lte;
          if (matches) {
            states.delete(key);
            count++;
          }
        }
        return { count };
      },
    },
    authProvider: {
      findUnique: async ({ where }) => {
        if (where.userId_provider) {
          const match = [...providers].find(
            ([, userId]) => userId === where.userId_provider.userId,
          );
          return match ? { id: match[0], userId: match[1] } : null;
        }
        const id = providers.get(where.provider_providerUserId.providerUserId);
        return id ? { userId: id, user: safe(users.get(id)) } : null;
      },
      create: async ({ data }) => {
        providers.set(data.providerUserId, data.userId);
        return data;
      },
    },
    user: {
      findFirst: async ({ where }) => {
        const email = where.email.equals.toLowerCase();
        return [...users.values()].find((u) => u.email.toLowerCase() === email) ?? null;
      },
      findUnique: async ({ where }) =>
        users.has(where.id) ? safe(users.get(where.id)) : null,
      create: async ({ data }) => {
        users.set(data.id, data);
        providers.set(data.authProviders.create.providerUserId, data.id);
        sessions.push({ ...data.refreshTokens.create, userId: data.id });
        return safe(data);
      },
      update: async ({ where, data }) => {
        const user = users.get(where.id);
        Object.assign(user, data);
        return safe(user);
      },
    },
    refreshToken: {
      create: async ({ data }) => {
        sessions.push(data);
        return data;
      },
    },
    $queryRaw: async () => [],
    $transaction: async (callback) => callback(prisma),
  };

  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MailService)
    .useValue({ sendVerificationEmail: async () => {}, sendPasswordResetEmail: async () => {} })
    .overrideProvider(RabbitMqEventsService)
    .useValue({ publishCreated: async () => {}, publishUpdated: async () => {}, publishDeleted: async () => {} })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(config))
    .compile();

  const app = module.createNestApplication();
  app.useLogger(false);
  t.after(() => app.close());

  // Conditional registration: simulates the presence or absence of automatic harness cleanup
  if (process.env.DISABLE_HARNESS_CLEANUP !== '1') {
    t.afterEach(() => resetStubState());
  }

  await app.init();
  await app.listen(0);
  const server = app.getHttpServer();

  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (remoteFailure) throw new Error('upstream connection error');
    if (remoteStatus !== 200) {
      return new Response(JSON.stringify({ error: 'upstream-error' }), { status: remoteStatus });
    }
    if (url === 'https://discord.com/api/oauth2/token') {
      assert.equal(init.body.get('redirect_uri'), expectedRedirect ?? config.DISCORD_REDIRECT_URI);
      return new Response(
        JSON.stringify(
          badToken
            ? {}
            : { access_token: 'discord-private-token', token_type: 'Bearer' },
        ),
      );
    }
    return new Response(JSON.stringify(remote));
  });

  const begin = async () => {
    expectedRedirect = config.DISCORD_REDIRECT_URI;
    const res = await request(server).get('/auth/discord').expect(302);
    const url = new URL(res.headers.location);
    const state = url.searchParams.get('state');
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    return { res, url, state, cookie };
  };

  const callback = (flow) => {
    expectedRedirect = config.DISCORD_REDIRECT_URI;
    return request(server)
      .get('/auth/discord/callback')
      .set('Cookie', flow.cookie)
      .query({ state: flow.state, code: 'test-code' });
  };

  // Subtest 1: An upstream error test that fails and aborts before manual resets
  await t.test('upstream failure leaves dirty stub state', async () => {
    remoteFailure = true;
    badToken = true;
    remoteStatus = 500;
    // Fails with an unhandled assertion error before resetting flags
    assert.fail('simulated assertion failure in upstream-error scenario');
  });

  // Subtest 2: Subsequent scenario relying on the harness having cleaned up the dirty state
  await t.test('subsequent scenario should succeed if cleaned up', async () => {
    const flow = await begin();
    await callback(flow).expect(200);
  });
});
