import { readSession } from './helpers/session.mjs';
import { RabbitMqEventsService } from '../dist/events/rabbitmq-events.service.js';
import { MailService } from '../dist/mail/mail.service.js';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../dist/app/app.module.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

test('email and password login', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const dto = { email: 'test@example.com', password: ' test password ' };
  const storedUser = {
    id: '15f154f1-b37f-4fe7-955f-e8f4de3ceb8d',
    email: dto.email,
    username: 'tester',
    passwordHash: await bcrypt.hash(dto.password, 12),
  };
  const publicUser = {
    id: storedUser.id,
    email: storedUser.email,
    username: storedUser.username,
  };
  let account = storedUser;
  let lookupCount = 0;
  let writeError;
  const sessions = [];
  const prisma = {
    user: {
      findUnique: async ({ where, select }) => {
        lookupCount++;
        assert.deepEqual(select, {
          id: true,
          email: true,
          username: true,
          passwordHash: true,
        });
        return account?.email === where.email ? account : null;
      },
    },
    refreshToken: {
      create: async ({ data }) => {
        if (writeError) throw writeError;
        sessions.push(data);
        return data;
      },
    },
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

  await t.test(
    'returns verified access tokens and saves fresh hashed refresh credentials',
    async () => {
      const start = Date.now();
      const response = await request(server)
        .post('/auth/login')
        .send(dto)
        .expect(200);
      const end = Date.now();
      const result = readSession(response);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.deepEqual(result.user, publicUser);
      assert.equal(result.tokenType, 'Bearer');
      assert.equal(result.expiresIn, 900);
      assert.equal(result.refreshExpiresIn, 604800);
      const claims = await new JwtService({
        publicKey: keys.publicKey,
      }).verifyAsync(result.accessToken, {
        algorithms: ['RS256'],
        issuer: 'user-service',
        audience: 'ft-transcendence-api',
      });
      assert.equal(claims.sub, storedUser.id);
      assert.equal(claims.exp - claims.iat, 900);
      assert.deepEqual(Object.keys(claims).sort(), [
        'aud',
        'exp',
        'iat',
        'iss',
        'sub',
      ]);
      const [id, secret] = result.refreshToken.split('.');
      assert.equal(Buffer.from(secret, 'base64url').length, 32);
      const session = sessions[0];
      assert.equal(session.id, id);
      assert.equal(session.userId, storedUser.id);
      assert.equal(
        session.tokenHash,
        createHash('sha256').update(secret).digest('hex'),
      );
      assert.ok(session.expiresAt.getTime() >= start + 604800000);
      assert.ok(session.expiresAt.getTime() <= end + 604800000);
      assert.equal(JSON.stringify(session).includes(secret), false);
      assert.equal(JSON.stringify(result).includes(session.tokenHash), false);
      assert.equal(
        JSON.stringify(result).includes(storedUser.passwordHash),
        false,
      );
      const next = await request(server)
        .post('/auth/login')
        .send(dto)
        .expect(200);
      assert.notEqual(readSession(next).refreshToken, result.refreshToken);
      assert.equal(sessions.length, 2);
    },
  );

  await t.test(
    'uses the same 401 for wrong passwords, missing users and passwordless accounts',
    async () => {
      const count = sessions.length;
      const wrong = await request(server)
        .post('/auth/login')
        .send({ ...dto, password: dto.password.trim() })
        .expect(401);
      const missing = await request(server)
        .post('/auth/login')
        .send({ ...dto, email: 'missing@example.com' })
        .expect(401);
      account = { ...storedUser, passwordHash: null };
      const passwordless = await request(server)
        .post('/auth/login')
        .send(dto)
        .expect(401);
      account = storedUser;
      assert.deepEqual(wrong.body, {
        message: 'Invalid email or password',
        error: 'Unauthorized',
        statusCode: 401,
      });
      assert.deepEqual(missing.body, wrong.body);
      assert.deepEqual(passwordless.body, wrong.body);
      assert.equal(sessions.length, count);
    },
  );

  await t.test('rejects malformed bodies before looking up users', async () => {
    const count = lookupCount;
    for (const input of [
      {},
      { email: dto.email },
      { ...dto, email: 'invalid' },
      { ...dto, password: 12345678 },
      { ...dto, password: '' },
      { ...dto, password: 'a'.repeat(73) },
      { ...dto, password: '\u{1f600}'.repeat(19) },
      { ...dto, admin: true },
    ]) {
      await request(server).post('/auth/login').send(input).expect(400);
    }
    assert.equal(lookupCount, count);
  });

  await t.test('does not save a session on signing failure', async () => {
    const count = sessions.length;
    const failure = new Error('Signing unavailable');
    const service = new AuthService(prisma, {
      signAsync: async () => {
        throw failure;
      },
    });
    await assert.rejects(
      () => service.login(dto),
      (error) => error === failure,
    );
    assert.equal(sessions.length, count);
  });

  await t.test(
    'does not return tokens when refresh-token persistence fails',
    async () => {
      const count = sessions.length;
      writeError = new Error('Database unavailable');
      await assert.rejects(
        () => module.get(AuthService).login(dto),
        (error) => error === writeError,
      );
      writeError = undefined;
      assert.equal(sessions.length, count);
    },
  );
});
