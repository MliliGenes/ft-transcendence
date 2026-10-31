import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import request from 'supertest';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { ChatController } from '../dist/chat/chat.controller.js';
import { ChatService } from '../dist/chat/chat.service.js';
import { AuthModule } from '../dist/auth/auth.module.js';

// Never reset an existing schema: each run owns only this random schema.
const schema = `chat_dm_test_${randomUUID().replaceAll('-', '')}`;
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Set TEST_DATABASE_URL to a local test PostgreSQL database.');
const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const signer = new JwtService({
  privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  signOptions: { algorithm: 'RS256', issuer: 'user-service', audience: 'ft-transcendence-api', expiresIn: 900 },
});
const alice = '11111111-1111-4111-8111-111111111111';
const bob = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let app;
let ownsSchema = false;
const token = (id = alice, options = {}) => signer.sign({ sub: id }, options);
const post = (body, jwt = token()) => {
  const call = request(app.getHttpServer()).post('/chat/conversations/dm');
  if (jwt !== null) call.set('Authorization', `Bearer ${jwt}`);
  return call.send(body);
};

describe('POST /chat/conversations/dm (real HTTP, JWT and PostgreSQL)', () => {
  before(async () => {
    // Generate DDL from the actual schema without applying a migration to user data.
    const ddl = execFileSync(process.execPath, [
      'node_modules/prisma/build/index.js', 'migrate', 'diff',
      '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    ownsSchema = true;
    const connection = await pool.connect();
    try {
      await connection.query(`SET search_path TO "${schema}"`);
      await connection.query(ddl.replaceAll('"public"', `"${schema}"`));
      await connection.query(readFileSync('prisma/constraints.sql', 'utf8'));
    } finally {
      await connection.query('RESET search_path');
      connection.release();
    }
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => ({
          JWT_PUBLIC_KEY: keys.publicKey.export({ type: 'spki', format: 'pem' }),
        })] }),
        AuthModule,
      ],
      controllers: [ChatController],
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(async () => {
    await prisma.conversation.deleteMany();
    await prisma.chatUser.deleteMany();
    await prisma.chatUser.createMany({ data: [alice, bob, outsider].map(id => ({
      id, username: `test-${id}`, sourceUpdatedAt: new Date(),
    })) });
  });

  after(async () => {
    await app?.close();
    await prisma.$disconnect();
    // The identifier is generated above, never supplied by the caller.
    if (ownsSchema) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  });

  it('rejects missing, malformed, expired and wrong-audience credentials', async () => {
    for (const jwt of [null, 'invalid', token(alice, { expiresIn: -1 }), token(alice, { audience: 'other-api' })]) {
      await post({ userId: bob }, jwt).expect(401);
    }
    assert.equal(await prisma.conversation.count(), 0);
  });

  it('rejects missing/invalid target IDs and attempts to supply the caller ID', async () => {
    for (const body of [{}, { userId: 'invalid' }, { userId: bob, authorId: outsider }]) {
      await post(body).expect(400);
    }
    assert.equal(await prisma.conversation.count(), 0);
  });

  it('creates a DM using the token identity and canonical participant order', async () => {
    const response = await post({ userId: alice }, token(bob)).expect(201);
    assert.equal(response.body.kind, 'DM');
    assert.equal(response.body.dmUserAId, alice);
    assert.equal(response.body.dmUserBId, bob);
    const saved = await prisma.conversation.findUnique({ where: { id: response.body.id } });
    assert.ok(saved);
    assert.equal(await prisma.conversation.count(), 1);
  });

  it('returns the same DM for repeated requests and reversed participants', async () => {
    const first = await post({ userId: bob }).expect(201);
    const again = await post({ userId: bob }).expect(201);
    const reverse = await post({ userId: alice }, token(bob)).expect(201);
    assert.equal(again.body.id, first.body.id);
    assert.equal(reverse.body.id, first.body.id);
    assert.equal(await prisma.conversation.count(), 1);
  });

  it('normalizes uppercase UUIDs before comparing or storing them', async () => {
    const response = await post({ userId: bob.toUpperCase() }).expect(201);
    assert.equal(response.body.dmUserBId, bob);
    await post({ userId: bob.toUpperCase() }, token(bob)).expect(400);
  });

  it('rejects self-DMs with a client error and no database write', async () => {
    await post({ userId: alice }).expect(400);
    assert.equal(await prisma.conversation.count(), 0);
  });

  it('rejects an unknown target with a client error, not an internal server error', async () => {
    const response = await post({ userId: randomUUID() });
    assert.ok([400, 404].includes(response.status), `Expected 400/404, received ${response.status}`);
    assert.equal(await prisma.conversation.count(), 0);
  });

  it('returns one conversation when both users create it concurrently', async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, (_, i) =>
      i % 2 ? post({ userId: alice }, token(bob)) : post({ userId: bob }),
    ));
    for (const response of responses) assert.equal(response.status, 201);
    assert.equal(new Set(responses.map(response => response.body.id)).size, 1);
    assert.equal(await prisma.conversation.count(), 1);
  });
});
