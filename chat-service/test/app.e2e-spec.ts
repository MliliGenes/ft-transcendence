import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { type INestApplication } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import request from 'supertest';
import { UserProjectionService } from '../src/users/user-projection.service.js';
import { UserServiceClient } from '../src/users/user-service.client.js';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = keys.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();
const privateKey = keys.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();
const userId = '2f1c2d1e-3c5a-4d6a-8b1c-123456789abc';
const now = () => Math.floor(Date.now() / 1000);
const signer = new JwtService();

function token(
  claims: Record<string, unknown> = {},
  options: JwtSignOptions = {},
) {
  const payload: Record<string, unknown> = {
    sub: userId,
    exp: now() + 900,
    ...claims,
  };
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }

  return signer.signAsync(payload, {
    privateKey,
    algorithm: 'RS256',
    issuer: 'user-service',
    audience: 'ft-transcendence-api',
    ...options,
  });
}

describe('Chat HTTP authentication', () => {
  let app: INestApplication;
  const database = {
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
  };

  const users = { ensureUsers: vi.fn(async () => [{ id: userId }]) };

  afterEach(() => {
    users.ensureUsers.mockReset();
    users.ensureUsers.mockResolvedValue([{ id: userId }]);
  });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow(name: string) {
          if (name === 'JWT_PUBLIC_KEY') return publicKey;
          throw new Error('Unexpected test configuration key');
        },
      })
      .overrideProvider(UserProjectionService)
      .useValue(users)
      .overrideProvider(UserServiceClient)
      .useValue({})
      .overrideProvider(DatabaseService)
      .useValue(database)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps the health endpoint public', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({ service: 'chat-service', status: 'ok' });
  });

  it('rejects a missing token', async () => {
    await request(app.getHttpServer()).get('/session').expect(401);
  });

  it.each([
    'Basic abc',
    'Bearer not-a-jwt',
    'Bearer a b',
    'Bearer ' + 'a'.repeat(4096),
  ])('rejects malformed authorization %#', async (authorization) => {
    await request(app.getHttpServer())
      .get('/session')
      .set('Authorization', authorization)
      .expect(401);
  });

  it('uses the signed identity, ignoring a client-supplied userId', async () => {
    await request(app.getHttpServer())
      .get('/session?userId=someone-else')
      .set('Authorization', 'Bearer ' + (await token()))
      .expect('Cache-Control', 'no-store')
      .expect(200)
      .expect({ userId });
  });

  it.each([
    { exp: now() - 60 },
    { exp: undefined },
    { sub: 'not-a-uuid' },
    { sub: undefined },
    { nbf: now() + 300 },
  ])('rejects invalid or expired claims %#', async (claims) => {
    await request(app.getHttpServer())
      .get('/session')
      .set('Authorization', 'Bearer ' + (await token(claims)))
      .expect(401);
  });

  it.each([{ issuer: 'another-service' }, { audience: 'another-api' }])(
    'rejects another issuer or audience %#',
    async (options) => {
      await request(app.getHttpServer())
        .get('/session')
        .set('Authorization', 'Bearer ' + (await token({}, options)))
        .expect(401);
    },
  );

  it('rejects a token signed by an untrusted RSA key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = other.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    await request(app.getHttpServer())
      .get('/session')
      .set('Authorization', 'Bearer ' + (await token({}, { privateKey: key })))
      .expect(401);
  });

  it('rejects a token using another algorithm', async () => {
    const forged = await signer.signAsync(
      { sub: userId, exp: now() + 900 },
      {
        secret: publicKey,
        algorithm: 'HS256',
        issuer: 'user-service',
        audience: 'ft-transcendence-api',
      },
    );
    await request(app.getHttpServer())
      .get('/session')
      .set('Authorization', 'Bearer ' + forged)
      .expect(401);
  });
  it('creates/refreshes the signed caller before allowing the protected route', async () => {
    await request(app.getHttpServer())
      .get('/chat/session')
      .set('Authorization', 'Bearer ' + (await token()))
      .expect(200);
    expect(users.ensureUsers).toHaveBeenCalledWith([userId], true);
  });

  it('rejects a deleted caller even with an otherwise valid token', async () => {
    users.ensureUsers.mockRejectedValueOnce(new NotFoundException());
    await request(app.getHttpServer())
      .get('/session')
      .set('Authorization', 'Bearer ' + (await token()))
      .expect(401);
  });

  it('fails closed when current account status cannot be checked', async () => {
    users.ensureUsers.mockRejectedValueOnce(new ServiceUnavailableException());
    await request(app.getHttpServer())
      .get('/session')
      .set('Authorization', 'Bearer ' + (await token()))
      .expect(503);
  });
});
