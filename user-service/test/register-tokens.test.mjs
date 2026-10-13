// Compiled classes preserve the Nest dependency-injection and DTO metadata.
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
import { MailService } from '../dist/mail/mail.service.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { Prisma } from '../dist/generated/prisma/client.js';

test('registration issues tokens and prepares a nested user/session write', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const config = new ConfigService({
    JWT_PRIVATE_KEY: keys.privateKey.replace(/\n/g, '\\n'),
    JWT_PUBLIC_KEY: keys.publicKey.replace(/\n/g, '\\n'),
  });
  const writes = [];
  let duplicate = false;
  let createError;
  const prisma = {
    authToken: {
      create: async () => ({}),
    },
    user: {
      findFirst: async () => (duplicate ? { id: 'existing' } : null),
      create: async (args) => {
        if (createError) throw createError;
        writes.push(args);
        return {
          id: args.data.id,
          email: args.data.email,
          username: args.data.username,
        };
      },
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(MailService)
    .useValue({
      sendVerificationEmail: async () => {},
    })
    .overrideProvider(ConfigService)
    .useValue(config)
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
  const dto = {
    username: 'tester',
    email: 'test@example.com',
    password: 'test password',
  };

  await t.test(
    'returns verifiable access tokens and stores only refresh-secret hashes',
    async () => {
      const start = Date.now();
      const response = await request(server)
        .post('/auth/register')
        .send(dto)
        .expect(201);
      const end = Date.now();
      assert.equal(response.headers['cache-control'], 'no-store');
      const result = response.body;
      const { data, select } = writes[0];
      assert.deepEqual(select, { id: true, email: true, username: true });
      assert.deepEqual(result.user, {
        id: data.id,
        username: dto.username,
        email: dto.email,
      });
      assert.equal(await bcrypt.compare(dto.password, data.passwordHash), true);
      assert.equal(data.password, undefined);
      const verifier = new JwtService({ publicKey: keys.publicKey });
      const payload = await verifier.verifyAsync(result.accessToken, {
        algorithms: ['RS256'],
        issuer: 'user-service',
        audience: 'ft-transcendence-api',
      });
      assert.equal(payload.sub, result.user.id);
      assert.equal(payload.exp - payload.iat, 900);
      assert.deepEqual(Object.keys(payload).sort(), [
        'aud',
        'exp',
        'iat',
        'iss',
        'sub',
      ]);
      assert.equal(result.tokenType, 'Bearer');
      assert.equal(result.expiresIn, 900);
      assert.deepEqual(Object.keys(result).sort(), [
        'accessToken',
        'expiresIn',
        'tokenType',
        'user',
      ]);
      const cookie = response.headers['set-cookie']?.find((entry) =>
        entry.startsWith('auth-refresh='),
      );
      assert.ok(cookie, 'expected an auth-refresh cookie');
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /Path=\/auth\//);
      assert.match(cookie, /SameSite=Lax/);
      const [id, secret] = cookie.split(';')[0].slice(13).split('.');
      assert.equal(Buffer.from(secret, 'base64url').length, 32);
      const stored = data.refreshTokens.create;
      assert.equal(stored.id, id);
      assert.equal(
        stored.tokenHash,
        createHash('sha256').update(secret).digest('hex'),
      );
      assert.ok(stored.expiresAt.getTime() >= start + 604800000);
      assert.ok(stored.expiresAt.getTime() <= end + 604800000);
      assert.equal(JSON.stringify(data).includes(secret), false);
      assert.equal(JSON.stringify(result).includes(data.passwordHash), false);
      assert.equal(JSON.stringify(result).includes(stored.tokenHash), false);
      const next = await request(server)
        .post('/auth/register')
        .send({ ...dto, username: 'tester2', email: 'test2@example.com' })
        .expect(201);
      const nextCookie = next.headers['set-cookie']?.find((entry) =>
        entry.startsWith('auth-refresh='),
      );
      assert.notEqual(nextCookie, cookie);
      assert.notEqual(next.body.user.id, result.user.id);
    },
  );

  await t.test(
    'rejects invalid input and existing users before writing',
    async () => {
      const before = writes.length;
      await request(server)
        .post('/auth/register')
        .send({ ...dto, password: 'short' })
        .expect(400);
      duplicate = true;
      await request(server).post('/auth/register').send(dto).expect(409);
      duplicate = false;
      assert.equal(writes.length, before);
    },
  );

  await t.test('handles a concurrent unique-constraint failure', async () => {
    createError = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });
    const response = await request(server)
      .post('/auth/register')
      .send(dto)
      .expect(409);
    assert.equal(response.body.accessToken, undefined);
    assert.equal(response.body.refreshToken, undefined);
    createError = undefined;
  });

  await t.test('does not write a user when signing fails', async () => {
    const before = writes.length;
    const error = new Error('Signing failed');
    const service = new AuthService(prisma, {
      signAsync: async () => {
        throw error;
      },
    });
    await assert.rejects(
      () => service.register(dto),
      (failure) => failure === error,
    );
    assert.equal(writes.length, before);
  });

  await t.test(
    'does not return tokens when the nested database write fails',
    async () => {
      createError = new Error('Database write failed');
      await assert.rejects(
        () => module.get(AuthService).register(dto),
        (failure) => failure === createError,
      );
      createError = undefined;
    },
  );
});
