import { MailService } from '../dist/mail/mail.service.js';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../dist/app/app.module.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { RabbitMqEventsService } from '../dist/events/rabbitmq-events.service.js';

test('avatar and banner uploads', async (t) => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const id = '15f154f1-b37f-4fe7-955f-e8f4de3ceb8d';
  const images = new Map();
  const updates = [];
  let user = {
    id,
    username: 'tester',
    avatarUrl: null,
    bannerUrl: null,
    passwordHash: 'secret',
  };
  let failUpdate = false;
  const prisma = {
    $queryRaw: async (_sql, userId) => {
      assert.equal(userId, id);
      return user ? [{ id }] : [];
    },
    userImage: {
      deleteMany: async ({ where }) => {
        assert.equal(where.userId, id);
        return { count: Number(images.delete(where.kind)) };
      },
      findUnique: async ({ where, select }) => {
        assert.deepEqual(select, { data: true, contentType: true });
        const image =
          user && where.userId_kind.userId === id
            ? images.get(where.userId_kind.kind)
            : null;
        return image
          ? { data: image.data, contentType: image.contentType }
          : null;
      },
      upsert: async ({ where, create, update }) => {
        assert.equal(where.userId_kind.userId, id);
        const kind = where.userId_kind.kind;
        images.set(
          kind,
          images.has(kind) ? { ...images.get(kind), ...update } : create,
        );
        return { id: kind };
      },
    },
    user: {
      update: async ({ where, data, select }) => {
        assert.equal(where.id, id);
        if (failUpdate) throw new Error('Simulated write failure');
        Object.assign(user, data);
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, user[key]]),
        );
      },
    },
    $transaction: async (callback) => {
      const snapshot = new Map(images);
      try {
        return await callback(prisma);
      } catch (error) {
        images.clear();
        for (const entry of snapshot) images.set(...entry);
        throw error;
      }
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(RabbitMqEventsService)
    .useValue({ publishUpdated: async (profile) => updates.push(profile) })
    .overrideProvider(MailService)
    .useValue({ sendVerificationEmail: async () => {}, sendPasswordResetEmail: async () => {} })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService({
        JWT_PRIVATE_KEY: keys.privateKey,
        JWT_PUBLIC_KEY: keys.publicKey,
      }),
    )
    .compile();
  const app = module.createNestApplication();
  app.useLogger(false);
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
  const token = await module.get(JwtService).signAsync({ sub: id });
  const input = await sharp({
    create: { width: 600, height: 400, channels: 3, background: 'red' },
  })
    .png()
    .toBuffer();
  const upload = (kind, bytes = input, name = 'image.png') =>
    request(server)
      .put(`/accounts/me/${kind}`)
      .auth(token, { type: 'bearer' })
      .attach('file', bytes, name);

  await t.test('requires authentication and a single image file', async () => {
    await request(server)
      .put('/accounts/me/avatar')
      .attach('file', input, 'image.png')
      .expect(401);
    await request(server)
      .put('/accounts/me/avatar')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(server)
      .put('/accounts/me/avatar')
      .auth(token, { type: 'bearer' })
      .attach('wrong', input, 'image.png')
      .expect(400);
    await upload('avatar').attach('file', input, 'extra.png').expect(400);
    assert.equal(images.size, 0);
  });
  await t.test(
    'missing images return 404 and malformed user IDs return 400',
    async () => {
      for (const kind of ['avatar', 'banner']) {
        await request(server).get(`/accounts/${id}/${kind}`).expect(404);
        await request(server).get(`/accounts/not-a-uuid/${kind}`).expect(400);
        await request(server)
          .get(`/accounts/25f154f1-b37f-4fe7-955f-e8f4de3ceb8d/${kind}`)
          .expect(404);
      }
    },
  );
  await t.test(
    'rejects oversized, fake, unsupported, and excessive-pixel images',
    async () => {
      await upload('avatar', Buffer.alloc(1024 * 1024 + 1)).expect(413);
      await upload('banner', Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
      await upload('avatar', Buffer.from('not an image')).expect(400);
      await upload(
        'avatar',
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>',
        ),
        'image.svg',
      ).expect(400);
      const huge = await sharp({
        create: { width: 5000, height: 4001, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer();
      await upload('avatar', huge).expect(400);
      assert.equal(images.size, 0);
    },
  );
  await t.test(
    'stores resized WebP bytes and managed URLs for each kind',
    async () => {
      for (const [kind, width, height] of [
        ['avatar', 256, 256],
        ['banner', 1500, 500],
      ]) {
        const response = await upload(kind).expect(200);
        assert.equal(response.body[`${kind}Url`], `/accounts/${id}/${kind}`);
        assert.equal(response.body.passwordHash, undefined);
        assert.equal(response.body.images, undefined);
        const stored = images.get(kind.toUpperCase());
        assert.equal(stored.contentType, 'image/webp');
        const metadata = await sharp(stored.data).metadata();
        assert.equal(metadata.format, 'webp');
        assert.equal(metadata.width, width);
        assert.equal(metadata.height, height);
      }
      assert.equal(images.size, 2);
    },
  );
  await t.test(
    'public image URLs return exact stored bytes and image headers',
    async () => {
      for (const kind of ['avatar', 'banner']) {
        const response = await request(server)
          .get(user[`${kind}Url`])
          .expect(200);
        const stored = images.get(kind.toUpperCase());
        assert.deepEqual(response.body, Buffer.from(stored.data));
        assert.equal(response.headers['content-type'], 'image/webp');
        assert.equal(
          Number(response.headers['content-length']),
          stored.data.byteLength,
        );
        assert.equal(response.headers['content-disposition'], 'inline');
        assert.equal(response.headers['x-content-type-options'], 'nosniff');
        assert.equal(response.headers['cache-control'], 'no-store');
      }
    },
  );
  await t.test(
    'replaces only the requested image and rolls back on URL write failure',
    async () => {
      const oldAvatar = images.get('AVATAR');
      const oldBanner = images.get('BANNER');
      const replacement = await sharp({
        create: { width: 100, height: 100, channels: 3, background: 'blue' },
      })
        .jpeg()
        .toBuffer();
      failUpdate = true;
      await upload('avatar', replacement).expect(500);
      assert.equal(images.get('AVATAR'), oldAvatar);
      failUpdate = false;
      await upload('avatar', replacement).expect(200);
      assert.notDeepEqual(images.get('AVATAR').data, oldAvatar.data);
      assert.equal(images.get('BANNER'), oldBanner);
      assert.equal(images.size, 2);
      const fetched = await request(server).get(user.avatarUrl).expect(200);
      assert.deepEqual(fetched.body, Buffer.from(images.get('AVATAR').data));
    },
  );
  await t.test('profile PATCH cannot overwrite image URLs', async () => {
    for (const field of ['avatarUrl', 'bannerUrl']) {
      await request(server)
        .patch('/accounts/me')
        .auth(token, { type: 'bearer' })
        .send({ [field]: 'https://example.com/image.webp' })
        .expect(400);
    }
  });
  await t.test('removal requires authentication and cannot target another user', async () => {
    for (const kind of ['avatar', 'banner']) {
      await request(server).delete(`/accounts/me/${kind}`).expect(401);
      await request(server)
        .delete(`/accounts/me/${kind}`)
        .auth('invalid', { type: 'bearer' })
        .expect(401);
      await request(server)
        .delete(`/accounts/${id}/${kind}`)
        .auth(token, { type: 'bearer' })
        .expect(404);
    }
    assert.equal(images.size, 2);
  });
  await t.test('removal rolls back if clearing the URL fails', async () => {
    const avatar = images.get('AVATAR');
    const url = user.avatarUrl;
    const eventCount = updates.length;
    failUpdate = true;
    await request(server)
      .delete('/accounts/me/avatar')
      .auth(token, { type: 'bearer' })
      .expect(500);
    failUpdate = false;
    assert.equal(images.get('AVATAR'), avatar);
    assert.equal(user.avatarUrl, url);
    assert.equal(updates.length, eventCount);
  });
  await t.test('removes only the selected image and allows repeated removal', async () => {
    for (const kind of ['avatar', 'banner']) {
      const other = kind === 'avatar' ? 'banner' : 'avatar';
      const otherImage = images.get(other.toUpperCase());
      const otherUrl = user[`${other}Url`];
      for (let attempt = 0; attempt < 2; attempt++) {
        const eventCount = updates.length;
        const response = await request(server)
          .delete(`/accounts/me/${kind}`)
          .auth(token, { type: 'bearer' })
          .expect(204);
        assert.equal(response.text, '');
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(user[`${kind}Url`], null);
        assert.equal(images.has(kind.toUpperCase()), false);
        assert.equal(images.get(other.toUpperCase()), otherImage);
        assert.equal(user[`${other}Url`], otherUrl);
        assert.equal(updates.length, eventCount + (kind === 'avatar' ? 1 : 0));
        if (kind === 'avatar') assert.equal(updates.at(-1).avatarUrl, null);
      }
      await request(server).get(`/accounts/${id}/${kind}`).expect(404);
    }
  });
  await t.test('a deleted account cannot upload or remove images', async () => {
    user = null;
    for (const kind of ['avatar', 'banner']) {
      await request(server)
        .delete(`/accounts/me/${kind}`)
        .auth(token, { type: 'bearer' })
        .expect(404);
    }
    await upload('avatar').expect(404);
    await request(server).get(`/accounts/${id}/avatar`).expect(404);
    await request(server).get(`/accounts/${id}/banner`).expect(404);
  });
});
