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

test('GET /auth/principal returns userId+expiresAt ms; 401 on forged/deleted', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const user = { id: '15f154f1-b37f-4fe7-955f-e8f4de3ceb8d' };
  let account = { ...user };
  const deleteUser = async (id) => {
    if (account?.id === id) account = null;
  };
  const prisma = {
    user: {
      findUnique: async ({ where }) =>
        account && where.id === account.id ? { id: account.id } : null,
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService({
        JWT_PRIVATE_KEY: keys.privateKey,
        JWT_PUBLIC_KEY: keys.publicKey,
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_USERNAME: 'test@example.com',
        SMTP_PASSWORD: 'test-password',
        AUTH_FRONTEND_URL: 'http://localhost:5173',
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
  const signer = module.get(JwtService);
  const validToken = await signer.signAsync({ sub: user.id });

  const ok = await request(app.getHttpServer()).get('/auth/principal').set('Authorization', `Bearer ${validToken}`).expect(200);
  assert.equal(ok.body.userId, user.id); assert.ok(Number.isSafeInteger(ok.body.expiresAt) && ok.body.expiresAt > Date.now());
  const claims = JSON.parse(Buffer.from(validToken.split('.')[1], 'base64url').toString());
  assert.equal(ok.body.expiresAt, claims.exp * 1000);
  assert.equal(ok.headers['cache-control'], 'no-store');
  await request(app.getHttpServer()).get('/auth/principal').set('Authorization', 'Bearer forged').expect(401);
  await deleteUser(user.id);
  await request(app.getHttpServer()).get('/auth/principal').set('Authorization', `Bearer ${validToken}`).expect(401);
});
