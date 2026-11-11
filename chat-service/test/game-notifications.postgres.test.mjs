import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import request from 'supertest';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { ChatController } from '../dist/chat/chat.controller.js';
import { ChatService } from '../dist/chat/chat.service.js';
import { ChatGateway } from '../dist/chat/gateway/chat.gateway.js';
import { UserProfilesService } from '../dist/chat/user-profiles.service.js';
import { MinioService } from '../dist/minio/minio.service.js';
import { FeedService } from '../dist/feed/feed.service.js';
import { GameNotificationsService } from '../dist/chat/game-notifications.service.js';
import { GameEventsConsumer } from '../dist/events/game-events.consumer.js';
import { AuthModule } from '../dist/auth/auth.module.js';

// Never reset an existing schema: each run owns only this random schema.
const schema = `chat_game_test_${randomUUID().replaceAll('-', '')}`;
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
const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SYSTEM_AUTHOR = '0000a11e-0000-4000-8000-000000000000';
let app;
let notifications;
let broadcasts = [];
let ownsSchema = false;
const token = (id = alice) => signer.sign({ sub: id });

const ROOM = 'AB12CD';

function startedEvent(roomCode = ROOM) {
  return {
    eventId: randomUUID(),
    eventType: 'game.match.started',
    occurredAt: new Date().toISOString(),
    data: {
      matchId: 'match-1',
      mode: '1v1',
      roomCode,
      participants: [
        { userId: alice, sideId: 'left' },
        { userId: bob, sideId: 'right' },
      ],
    },
  };
}

function endedEvent(matchId = 'match-1') {
  return {
    eventId: randomUUID(),
    eventType: 'game.match.ended',
    occurredAt: new Date().toISOString(),
    data: {
      matchId,
      mode: '1v1',
      participants: [
        { userId: alice, sideId: 'left', outcome: 'win', score: 300 },
        { userId: bob, sideId: 'right', outcome: 'loss', score: 225 },
      ],
      forfeit: null,
      endedBecause: 'completed',
    },
  };
}

async function createDm() {
  const response = await request(app.getHttpServer())
    .post('/chat/conversations/dm')
    .set('Authorization', `Bearer ${token()}`)
    .send({ userId: bob })
    .expect(201);
  return response.body.id;
}

describe('Code Arena notifications in chat (real HTTP, JWT and PostgreSQL)', () => {
  before(async () => {
    const ddl = execFileSync(process.execPath, [
      'node_modules/prisma/build/index.js', 'migrate', 'diff',
      '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...process.env,
      POSTGRES_HOST: new URL(url).hostname,
      POSTGRES_PORT: new URL(url).port || '5432',
      POSTGRES_USER: decodeURIComponent(new URL(url).username),
      POSTGRES_PASSWORD: decodeURIComponent(new URL(url).password),
      POSTGRES_DB: decodeURIComponent(new URL(url).pathname.slice(1)),
    } });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    ownsSchema = true;
    const connection = await pool.connect();
    try {
      await connection.query(`SET search_path TO "${schema}"`);
      await connection.query(ddl.replaceAll('"public"', `"${schema}"`));
    } finally {
      await connection.query('RESET search_path');
      connection.release();
    }
    const gateway = {
      broadcastMessageCreated: (userIds, message) => broadcasts.push({ userIds, message }),
      broadcastReadState: () => {},
    };
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => ({
          JWT_PUBLIC_KEY: keys.publicKey.export({ type: 'spki', format: 'pem' }),
        })] }),
        AuthModule,
      ],
      controllers: [ChatController],
      providers: [
        ChatService,
        GameNotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatGateway, useValue: gateway },
        { provide: MinioService, useValue: {} },
        { provide: FeedService, useValue: {} },
        { provide: UserProfilesService, useValue: {
          ensureCanContact: async () => {},
          ensureActiveUsers: async (ids) => {
            const count = await prisma.chatUser.count({ where: { id: { in: ids }, deletedAt: null } });
            if (count !== new Set(ids).size) throw new Error('Unknown user');
          },
        } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    notifications = module.get(GameNotificationsService);
  });

  beforeEach(async () => {
    broadcasts = [];
    await prisma.message.deleteMany();
    await prisma.gameChallenge.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.chatUser.deleteMany();
    await prisma.chatUser.createMany({ data: [alice, bob, stranger].map(id => ({
      id, username: `test-${id.slice(0, 4)}`, sourceUpdatedAt: new Date(),
    })) });
  });

  after(async () => {
    await app?.close();
    await prisma.$disconnect();
    if (ownsSchema) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  });

  it('links a Code Arena challenge to the conversation that carries the invitation', async () => {
    const conversationId = await createDm();
    const response = await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token()}`)
      .send({
        content: '🎮 Code Arena challenge\n\n[Accept & Join](/play/lobby/AB12CD)',
        clientRequestId: randomUUID(),
        gameChallenge: { roomCode: 'ab12cd' },
      })
      .expect(201);

    assert.equal(response.body.kind ?? 'USER', 'USER');
    const link = await prisma.gameChallenge.findUnique({ where: { roomCode: ROOM } });
    assert.ok(link, 'the challenge should be linked to the conversation');
    assert.equal(link.conversationId, conversationId);
    assert.equal(link.matchId, null);
  });

  it('rejects an invitation that carries an invalid room code', async () => {
    const conversationId = await createDm();
    await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token()}`)
      .send({
        content: 'not a challenge',
        clientRequestId: randomUUID(),
        gameChallenge: { roomCode: 'toolong' },
      })
      .expect(400);
    assert.equal(await prisma.gameChallenge.count(), 0);
  });

  it('persists one notification for a match start and ignores the replay', async () => {
    const conversationId = await createDm();
    await notifications.linkChallenge(conversationId, ROOM);

    const first = await notifications.applyGameEvent(startedEvent());
    const replay = await notifications.applyGameEvent(startedEvent());

    assert.equal(first.delivered, true);
    assert.equal(replay.delivered, true);
    const messages = await prisma.message.findMany({ where: { conversationId } });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].authorId, SYSTEM_AUTHOR);
    assert.equal(messages[0].kind, 'SYSTEM');
    assert.match(messages[0].content, /match-started/);
    assert.equal(broadcasts.length, 1, 'a replay must not be delivered live again');
    assert.deepEqual(broadcasts[0].userIds.sort(), [alice, bob].sort());
  });

  it('persists the match result in the same conversation', async () => {
    const conversationId = await createDm();
    await notifications.linkChallenge(conversationId, ROOM);
    await notifications.applyGameEvent(startedEvent());
    await notifications.applyGameEvent(endedEvent());

    const messages = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
    assert.equal(messages.length, 2);
    assert.match(messages[1].content, /match-result/);
    assert.match(messages[1].content, /300/);
    assert.equal(messages[1].kind, 'SYSTEM');
  });

  it('rejects a notification for participants outside the linked conversation', async () => {
    const conversationId = await createDm();
    await notifications.linkChallenge(conversationId, ROOM);

    const outcome = await notifications.applyGameEvent({
      ...startedEvent(),
      data: {
        ...startedEvent().data,
        participants: [
          { userId: alice, sideId: 'left' },
          { userId: stranger, sideId: 'right' },
        ],
      },
    });

    assert.equal(outcome.delivered, false);
    assert.equal(await prisma.message.count({ where: { conversationId } }), 0);
  });

  it('announces a cancelled challenge and a forfeit result', async () => {
    const conversationId = await createDm();
    await notifications.linkChallenge(conversationId, ROOM);

    const cancelled = await notifications.applyGameEvent({
      eventId: randomUUID(),
      eventType: 'game.challenge.cancelled',
      occurredAt: new Date().toISOString(),
      data: { roomCode: ROOM, reason: 'room-closed', participantUserIds: [alice, bob] },
    });
    assert.equal(cancelled.delivered, true);

    await notifications.applyGameEvent(startedEvent());
    const forfeited = await notifications.applyGameEvent({
      ...endedEvent(),
      data: {
        ...endedEvent().data,
        participants: [
          { userId: alice, sideId: 'left', outcome: 'win', score: 0 },
          { userId: bob, sideId: 'right', outcome: 'loss', score: 0 },
        ],
        forfeit: { winnerSideId: 'left', loserSideId: 'right', reason: 'leave' },
        endedBecause: 'forfeit',
      },
    });
    assert.equal(forfeited.delivered, true);

    const messages = await prisma.message.findMany({ where: { conversationId } });
    assert.equal(messages.length, 3);
    assert.ok(messages.some((message) => /challenge-cancelled/.test(message.content ?? '')));
    assert.ok(messages.some((message) => /forfeit/.test(message.content ?? '')));
    assert.ok(messages.every((message) => message.authorId === SYSTEM_AUTHOR));
  });

  it('keeps notification payloads free of source, editor and hidden test data', async () => {
    const conversationId = await createDm();
    await notifications.linkChallenge(conversationId, ROOM);
    await notifications.applyGameEvent(startedEvent());
    await notifications.applyGameEvent(endedEvent());

    const messages = await prisma.message.findMany({ where: { conversationId } });
    for (const message of messages) {
      assert.doesNotMatch(message.content ?? '', /source|hidden|editor|submission/i);
    }
  });

  it('delivers an event published by the Game service into the linked conversation', async (t) => {
    if (!process.env.RABBITMQ_HOST) {
      t.skip('RABBITMQ_HOST is not set; broker round-trip needs the integration environment');
      return;
    }
    const amqp = (await import('amqp-connection-manager')).default;
    // The real publisher of the Game service, so this proves the production
    // envelope and routing key are what the Chat consumer understands.
    const { GameEventsPublisher } = await import(
      '../../services/game/dist/game/game-events.publisher.js'
    );
    const consumer = new GameEventsConsumer(
      new ConfigService({
        RABBITMQ_HOST: process.env.RABBITMQ_HOST,
        RABBITMQ_PORT: process.env.RABBITMQ_PORT,
        RABBITMQ_DEFAULT_USER: process.env.RABBITMQ_DEFAULT_USER,
        RABBITMQ_DEFAULT_PASS: process.env.RABBITMQ_DEFAULT_PASS,
      }),
      notifications,
    );
    consumer.onModuleInit();
    const conversationId = await createDm();
    await notifications.linkChallenge(conversationId, ROOM);

    const brokerUrl = new URL(`amqp://${process.env.RABBITMQ_HOST}`);
    brokerUrl.port = process.env.RABBITMQ_PORT ?? '5672';
    brokerUrl.username = process.env.RABBITMQ_DEFAULT_USER;
    brokerUrl.password = process.env.RABBITMQ_DEFAULT_PASS;

    // The connection manager reconnects on its own: a broker that has just
    // started can drop the first handshake.
    const connection = amqp.connect(brokerUrl.toString());
    const channel = connection.createChannel({
      name: 'game-notification-test-publisher',
      setup: async (raw) => {
        await raw.assertExchange('game.events', 'topic', { durable: true });
      },
    });
    try {
      // Wait until the consumer is attached: an event published before the
      // queue is bound would never reach the conversation.
      const deadline = Date.now() + 30000;
      for (;;) {
        let attached = false;
        try {
          const queue = await channel.checkQueue('chat.game-events');
          attached = queue.consumerCount > 0;
        } catch {
          // The channel is being re-established; try again.
        }
        if (attached) break;
        if (Date.now() > deadline) throw new Error('the game-events consumer did not attach');
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const publisher = new GameEventsPublisher();
      publisher.onModuleInit();
      try {
        // A broker that has just started can drop the first handshake; the
        // publisher reconnects, so retry until the event is accepted.
        let published = false;
        for (let attempt = 0; attempt < 10 && !published; attempt++) {
          published = await publisher.publishMatchStarted({
            matchId: 'match-1',
            mode: '1v1',
            roomCode: ROOM,
            participants: [
              { userId: alice, sideId: 'left' },
              { userId: bob, sideId: 'right' },
            ],
          });
          if (!published) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        assert.equal(published, true, 'the publisher should reach the broker');
      } finally {
        await publisher.onModuleDestroy();
      }

      const messages = [];
      const until = Date.now() + 15000;
      for (;;) {
        const found = await prisma.message.findMany({ where: { conversationId } });
        if (found.length > 0) { messages.push(...found); break; }
        if (Date.now() > until) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(messages.length, 1, 'the broker event should reach the conversation');
      assert.match(messages[0].content, /match-started/);
    } finally {
      await connection.close().catch(() => {});
      await consumer.onModuleDestroy();
    }
  });
});
