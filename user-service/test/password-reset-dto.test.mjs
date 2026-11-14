import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../dist/auth/auth.controller.js';
import { AuthService } from '../dist/auth/auth.service.js';

test('password reset endpoints validate input before calling the service', async (t) => {
  const calls = [];
  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: ConfigService, useValue: new ConfigService({}) }, { provide: AuthService, useValue: {
      requestPasswordReset: async (...args) => { calls.push(args); },
      requestEmailVerification: async (...args) => { calls.push(args); },
      confirmPasswordReset: async (...args) => { calls.push(args); },
    } }],
  }).compile();
  const app = module.createNestApplication();
  t.after(() => app.close());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
  }));
  await app.init();
  // Bind once: SuperTest's per-request listen/close churn resets in-flight sockets.
  await app.listen(0);
  const server = app.getHttpServer();
  // The harness owns the listener: SuperTest must not close and restart an
  // ephemeral port around a request (that churn resets in-flight sockets).
  assert.ok(server.listening, 'the test server must be bound before the first request');
  const token = `${randomUUID()}.${randomBytes(32).toString('base64url')}`;
  for (const body of [{}, { email: 'invalid' }, { email: 42 }]) {
    await request(server).post('/auth/password-reset/request').send(body).expect(400);
  }
  for (const body of [
    {}, { token: 'invalid', newPassword: 'validpass' },
    { token, newPassword: '' }, { token, newPassword: 42 },
    { token, newPassword: 'a'.repeat(33) },
    { token, newPassword: '😀'.repeat(19) },
    { token, newPassword: 'validpass', extra: true },
  ]) {
    await request(server).post('/auth/password-reset/confirm').send(body).expect(400);
  }
  assert.equal(calls.length, 0);
  for (const body of [{}, { email: 'invalid' }, { email: 42 }, { email: 'test@example.com', extra: true }]) {
    await request(server).post('/auth/email-verification/request').send(body).expect(400);
  }
  assert.equal(calls.length, 0);
  await request(server).post('/auth/email-verification/request')
    .send({ email: 'test@example.com' }).expect(200, { requested: true });
  await request(server).post('/auth/password-reset/request')
    .send({ email: 'test@example.com' }).expect(200);
  await request(server).post('/auth/password-reset/confirm')
    .send({ token, newPassword: 'validpass' }).expect(200);
  assert.deepEqual(calls, [['test@example.com'], ['test@example.com'], [token, 'validpass']]);
});
