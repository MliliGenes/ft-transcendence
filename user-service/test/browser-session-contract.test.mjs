import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../dist/auth/auth.controller.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { assertTrustedBrowserOrigin } from '../dist/auth/browser-origin.js';

const origin = 'https://arena.test';
const config = new ConfigService({
  NODE_ENV: 'production',
  AUTH_FRONTEND_URL: origin,
});
const headers = { Origin: origin, 'X-Requested-With': 'XMLHttpRequest' };
const dto = {
  email: 'test@example.com',
  password: 'test password',
  username: 'tester',
};

test('credential source and custom header are required in the service', () => {
  for (const values of [
    {},
    { origin },
    { 'x-requested-with': 'XMLHttpRequest' },
    { origin, 'x-requested-with': 'arbitrary' },
    { origin: 'https://foreign.test', 'x-requested-with': 'XMLHttpRequest' },
    {
      origin: 'null',
      referer: `${origin}/`,
      'x-requested-with': 'XMLHttpRequest',
    },
    { referer: 'invalid', 'x-requested-with': 'XMLHttpRequest' },
  ])
    assert.throws(
      () => assertTrustedBrowserOrigin({ headers: values }, config),
      (error) => error.getStatus() === 403,
    );
  for (const values of [
    { origin, 'x-requested-with': 'XMLHttpRequest' },
    { referer: `${origin}/play/`, 'x-requested-with': 'XMLHttpRequest' },
  ])
    assert.doesNotThrow(() =>
      assertTrustedBrowserOrigin({ headers: values }, config),
    );
});

async function fixture(t) {
  const calls = [];
  const session = {
    refreshToken: 'fixture-secret',
    refreshExpiresIn: 604800,
    accessToken: 'fixture-access',
    expiresIn: 900,
    tokenType: 'Bearer',
    user: { id: 'fixture-user' },
  };
  const service = {
    login: async () => {
      calls.push('login');
      return session;
    },
    register: async () => {
      calls.push('register');
      return session;
    },
    refresh: async ({ refreshToken }) => {
      calls.push('refresh');
      if (!refreshToken) throw new UnauthorizedException();
      return session;
    },
    logout: async () => {
      calls.push('logout');
    },
  };
  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: service },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  t.after(() => app.close());
  return { server: app.getHttpServer(), calls };
}
function bodyFor(endpoint) {
  return endpoint === 'register'
    ? dto
    : endpoint === 'login'
      ? { email: dto.email, password: dto.password }
      : undefined;
}
function cookies(response) {
  return response.headers['set-cookie'] ?? [];
}
function rootDeletion(response) {
  assert.ok(
    cookies(response).some(
      (cookie) =>
        /(?:^|; )Path=\/(?:;|$)/.test(cookie) &&
        /Expires=Thu, 01 Jan 1970/.test(cookie) &&
        /HttpOnly/.test(cookie) &&
        /Secure/.test(cookie),
    ),
    'server must expire legacy HttpOnly root cookie',
  );
}

test('equivalent credential routes cannot bypass source and header protection', async (t) => {
  const { server, calls } = await fixture(t);
  for (const endpoint of ['login', 'register', 'refresh', 'logout']) {
    for (const path of [
      `/auth/${endpoint}`,
      `/auth/${endpoint}/`,
      `/AUTH/${endpoint.toUpperCase()}/`,
    ]) {
      for (const partial of [
        {},
        { Origin: origin },
        { 'X-Requested-With': 'XMLHttpRequest' },
      ]) {
        await request(server)
          .post(path)
          .set(partial)
          .send(bodyFor(endpoint))
          .expect(403);
      }
    }
  }
  assert.deepEqual(calls, []);
  await request(server)
    .post('/AUTH/LOGIN/')
    .set(headers)
    .send(bodyFor('login'))
    .expect(200);
  assert.deepEqual(calls, ['login']);
});

test('login and refresh migrate a single legacy root cookie; logout clears both paths', async (t) => {
  const { server } = await fixture(t);
  for (const endpoint of ['login', 'register', 'refresh', 'logout']) {
    const response = await request(server)
      .post(`/auth/${endpoint}`)
      .set(headers)
      .set('Cookie', 'auth-refresh=legacy-root-token')
      .send(bodyFor(endpoint))
      .expect(
        endpoint === 'register' ? 201 : endpoint === 'logout' ? 204 : 200,
      );
    rootDeletion(response);
    const narrow = cookies(response).find((cookie) =>
      /Path=\/auth\//.test(cookie),
    );
    assert.ok(narrow, 'canonical narrow cookie must remain');
    if (endpoint === 'logout') assert.match(narrow, /Expires=Thu, 01 Jan 1970/);
    else {
      assert.match(narrow, /auth-refresh=fixture-secret/);
      assert.doesNotMatch(JSON.stringify(response.body), /fixture-secret/);
    }
  }
  const duplicate = await request(server)
    .post('/auth/refresh')
    .set(headers)
    .set('Cookie', 'auth-refresh=one; auth-refresh=two')
    .expect(401);
  rootDeletion(duplicate);
  assert.ok(
    cookies(duplicate).some(
      (cookie) =>
        /Path=\/auth\//.test(cookie) && /Expires=Thu, 01 Jan 1970/.test(cookie),
    ),
  );
});
