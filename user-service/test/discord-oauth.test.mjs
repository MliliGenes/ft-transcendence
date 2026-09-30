import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app/app.module.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { Prisma } from '../dist/generated/prisma/client.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');

test('Discord authorization-code login', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const config = {
    JWT_PRIVATE_KEY: keys.privateKey,
    JWT_PUBLIC_KEY: keys.publicKey,
    DISCORD_CLIENT_ID: '123456789012345678',
    DISCORD_CLIENT_SECRET: 'test-secret',
    DISCORD_REDIRECT_URI: 'http://localhost:3000/auth/discord/callback',
  };
  const states = new Map(),
    users = new Map(),
    providers = new Map(),
    sessions = [];
  let lastCreate, dbFailure, raceWinner;
  let networkCalls = 0;
  let remote = {
    id: '223456789012345678',
    username: 'discord_player',
    global_name: 'Discord Player',
    email: 'discord@example.com',
    verified: true,
  };
  let remoteStatus = 200,
    remoteFailure = false,
    badToken = false;
  const safe = (user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
  });
  const prisma = {
    oAuthState: {
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
        assert.equal(where.provider_providerUserId.provider, 'DISCORD');
        const id = providers.get(where.provider_providerUserId.providerUserId);
        return id ? { user: safe(users.get(id)) } : null;
      },
    },
    user: {
      findFirst: async ({ where }) => {
        const email = where.email.equals
          .replace(/\\([\\%_])/g, '$1')
          .toLowerCase();
        return (
          [...users.values()].find((u) => u.email.toLowerCase() === email) ??
          null
        );
      },
      findUnique: async ({ where }) =>
        users.has(where.id) ? safe(users.get(where.id)) : null,
      create: async ({ data }) => {
        if (dbFailure) {
          if (raceWinner) {
            users.set(raceWinner.id, raceWinner);
            providers.set(
              data.authProviders.create.providerUserId,
              raceWinner.id,
            );
          }
          throw dbFailure;
        }
        lastCreate = data;
        users.set(data.id, data);
        providers.set(data.authProviders.create.providerUserId, data.id);
        sessions.push({ ...data.refreshTokens.create, userId: data.id });
        return safe(data);
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
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(config))
    .compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  t.after(() => app.close());
  await app.init();
  const server = app.getHttpServer();
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    networkCalls++;
    assert.ok(init.signal);
    assert.equal(init.redirect, 'error');
    if (remoteFailure) throw new Error('upstream connection error');
    if (remoteStatus !== 200)
      return new Response(
        JSON.stringify({ error: 'private-upstream-detail' }),
        { status: remoteStatus },
      );
    if (url === 'https://discord.com/api/oauth2/token') {
      assert.equal(init.method, 'POST');
      assert.equal(
        init.headers['Content-Type'],
        'application/x-www-form-urlencoded',
      );
      assert.equal(init.body.get('grant_type'), 'authorization_code');
      assert.equal(
        init.body.get('client_secret'),
        config.DISCORD_CLIENT_SECRET,
      );
      assert.equal(init.body.get('redirect_uri'), config.DISCORD_REDIRECT_URI);
      assert.ok(init.body.get('code'));
      return new Response(
        JSON.stringify(
          badToken
            ? {}
            : { access_token: 'discord-private-token', token_type: 'Bearer' },
        ),
      );
    }
    assert.equal(url, 'https://discord.com/api/v10/users/@me');
    assert.equal(init.headers.Authorization, 'Bearer discord-private-token');
    return new Response(JSON.stringify(remote));
  });
  const begin = async () => {
    const res = await request(server).get('/auth/discord').expect(302);
    const url = new URL(res.headers.location);
    const state = url.searchParams.get('state');
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    return { res, url, state, cookie };
  };
  const callback = (flow, query = {}) =>
    request(server)
      .get('/auth/discord/callback')
      .set('Cookie', flow.cookie)
      .query({ state: flow.state, code: 'test-code', ...query });

  await t.test(
    'empty config disables only Discord endpoints and does not write state',
    async () => {
      config.DISCORD_CLIENT_SECRET = '';
      await request(server).get('/auth/discord').expect(503);
      assert.equal(states.size, 0);
      config.DISCORD_CLIENT_SECRET = 'test-secret';
    },
  );
  await t.test(
    'redirect uses minimal scopes and a hashed expiring browser challenge',
    async () => {
      const { res, url, state, cookie } = await begin();
      assert.equal(url.origin, 'https://discord.com');
      assert.equal(url.searchParams.get('scope'), 'identify email');
      assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(
        url.searchParams.get('redirect_uri'),
        config.DISCORD_REDIRECT_URI,
      );
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.equal(res.headers['referrer-policy'], 'no-referrer');
      assert.match(res.headers['set-cookie'][0], /HttpOnly/);
      assert.match(res.headers['set-cookie'][0], /SameSite=Lax/);
      const stored = states.get(digest(state));
      assert.equal(stored.browserHash, digest(cookie.split('=')[1]));
      assert.ok(stored.expiresAt > new Date());
      assert.ok(stored.expiresAt.getTime() <= Date.now() + 600000);
    },
  );
  await t.test(
    'rejects missing, mismatched, expired, or replayed state before contacting Discord',
    async () => {
      const before = networkCalls;
      const flow = await begin(),
        other = await begin();
      await request(server)
        .get('/auth/discord/callback')
        .query({ state: flow.state, code: 'x' })
        .expect(401);
      await callback({ ...flow, cookie: other.cookie }).expect(401);
      await callback({ ...flow, state: 'bad' }).expect(401);
      states.get(digest(flow.state)).expiresAt = new Date(0);
      await callback(flow).expect(401);
      const cancelled = await begin();
      await callback(cancelled, { error: 'access_denied' }).expect(401);
      await callback(cancelled).expect(401);
      assert.equal(networkCalls, before);
    },
  );
  let localUser;
  await t.test(
    'creates account, provider and session together and returns our token pair',
    async () => {
      const flow = await begin();
      const result = await callback(flow).expect(200);
      localUser = result.body.user;
      assert.equal(result.headers['cache-control'], 'no-store');
      assert.equal(result.headers['referrer-policy'], 'no-referrer');
      assert.match(result.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
      assert.equal(lastCreate.role, 'USER');
      assert.equal(lastCreate.passwordHash, undefined);
      assert.ok(lastCreate.emailVerifiedAt instanceof Date);
      assert.equal(lastCreate.authProviders.create.provider, 'DISCORD');
      assert.equal(lastCreate.authProviders.create.providerUserId, remote.id);
      assert.equal(lastCreate.authProviders.create.accessToken, undefined);
      assert.ok(
        lastCreate.username.length >= 3 && lastCreate.username.length <= 30,
      );
      assert.equal(result.body.user.passwordHash, undefined);
      assert.equal(result.body.tokenType, 'Bearer');
      assert.equal(
        (await module.get(JwtService).verifyAsync(result.body.accessToken)).sub,
        localUser.id,
      );
      const [id, secret] = result.body.refreshToken.split('.');
      assert.equal(sessions.at(-1).id, id);
      assert.equal(sessions.at(-1).tokenHash, digest(secret));
      assert.ok(!JSON.stringify(result.body).includes('discord-private-token'));
      await callback(flow).expect(401);
    },
  );
  await t.test(
    'returning users are identified by provider ID without overwriting local data',
    async () => {
      const size = users.size;
      const stored = users.get(localUser.id);
      stored.role = 'SUPERADMIN';
      remote = { ...remote, email: null, verified: false, username: 'renamed' };
      const result = await callback(await begin()).expect(200);
      assert.deepEqual(result.body.user, localUser);
      assert.equal(users.size, size);
      assert.equal(stored.role, 'SUPERADMIN');
      assert.notEqual(sessions.at(-1).sessionId, sessions.at(-2).sessionId);
    },
  );
  await t.test(
    'a new provider cannot take over an existing email or sign up with an unverified email',
    async () => {
      const size = users.size,
        sessionCount = sessions.length;
      remote = {
        ...remote,
        id: '323456789012345678',
        email: 'DISCORD@example.com',
        verified: true,
      };
      const conflict = await callback(await begin()).expect(409);
      assert.match(conflict.body.message, /not linked automatically/);
      remote.email = 'new@example.com';
      remote.verified = false;
      await callback(await begin()).expect(401);
      remote.email = null;
      await callback(await begin()).expect(401);
      assert.equal(users.size, size);
      assert.equal(sessions.length, sessionCount);
      assert.equal(providers.has(remote.id), false);
    },
  );
  await t.test('only one concurrent callback can consume a state', async () => {
    remote = {
      id: '223456789012345678',
      username: 'returning',
      email: null,
      verified: false,
    };
    const flow = await begin();
    const results = await Promise.all([callback(flow), callback(flow)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  });
  await t.test(
    'upstream errors do not leak provider tokens or create sessions',
    async () => {
      const size = sessions.length;
      for (const status of [400, 401, 403, 429, 500]) {
        remoteStatus = status;
        const res = await callback(await begin()).expect(
          status < 429 ? 401 : 502,
        );
        assert.ok(
          !JSON.stringify(res.body).includes('private-upstream-detail'),
        );
      }
      remoteStatus = 200;
      remoteFailure = true;
      await callback(await begin()).expect(502);
      remoteFailure = false;
      badToken = true;
      await callback(await begin()).expect(502);
      badToken = false;
      remote = { id: 'invalid', username: 'x' };
      await callback(await begin()).expect(502);
      assert.equal(sessions.length, size);
    },
  );
  await t.test(
    'database failures never return a token pair; duplicate provider race uses the winner',
    async () => {
      const auth = module.get(AuthService);
      const profile = {
        id: '423456789012345678',
        username: 'new',
        displayName: 'New',
        email: 'race@example.com',
        verified: true,
      };
      dbFailure = new Error('database unavailable');
      const size = sessions.length;
      await assert.rejects(
        auth.loginWithDiscord(profile),
        /database unavailable/,
      );
      assert.equal(sessions.length, size);
      dbFailure = new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7',
      });
      await assert.rejects(
        auth.loginWithDiscord(profile),
        (error) => error.getStatus() === 409,
      );
      raceWinner = {
        id: randomUUID(),
        email: profile.email,
        username: 'winner',
      };
      const result = await auth.loginWithDiscord(profile);
      assert.equal(result.user.id, raceWinner.id);
      dbFailure = undefined;
      raceWinner = undefined;
    },
  );
  await t.test(
    'secure cookies in HTTPS and HTTP prohibited in production',
    async () => {
      config.DISCORD_REDIRECT_URI = 'https://example.com/auth/discord/callback';
      const flow = await begin();
      assert.match(flow.res.headers['set-cookie'][0], /; Secure/);
      config.DISCORD_REDIRECT_URI =
        'http://localhost:3000/auth/discord/callback';
      config.NODE_ENV = 'production';
      await request(server).get('/auth/discord').expect(503);
      config.NODE_ENV = 'test';
    },
  );
});
