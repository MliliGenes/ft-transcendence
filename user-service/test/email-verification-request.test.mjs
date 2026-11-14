import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { AuthService } from '../dist/auth/auth.service.js';

test('verification resend replaces eligible tokens, observes cooldown, and hides account state', async () => {
  const oldDate = new Date(Date.now() - 11 * 60 * 1000);
  const recentDate = new Date();
  const rows = [
    {
      id: randomUUID(),
      userId: 'user',
      purpose: 'EMAIL_VERIFICATION',
      usedAt: null,
      createdAt: oldDate,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: createHash('sha256').update('old-secret').digest('hex'),
    },
    {
      id: 'history',
      userId: 'user',
      purpose: 'EMAIL_VERIFICATION',
      usedAt: new Date(),
      createdAt: oldDate,
    },
  ];
  let account = {
    id: 'user',
    email: 'test@example.com',
    emailVerifiedAt: null,
  };
  const oldId = rows[0].id;
  const oldToken = `${rows[0].id}.old-secret`;
  const sent = [];
  const authToken = {
    findUnique: async ({ where }) =>
      rows.find((row) => row.id === where.id) ?? null,
    findFirst: async ({ where }) =>
      rows.find(
        (row) =>
          row.userId === where.userId &&
          row.purpose === where.purpose &&
          row.createdAt > where.createdAt.gt,
      ) ?? null,
    deleteMany: async ({ where }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (Object.entries(where).every(([key, value]) => row[key] === value))
          rows.splice(i, 1);
      }
      return { count: before - rows.length };
    },
    create: async ({ data }) => {
      const row = { ...data, createdAt: recentDate, usedAt: null };
      rows.push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const row = rows.find(
        (candidate) =>
          candidate.id === where.id &&
          candidate.tokenHash === where.tokenHash &&
          candidate.purpose === where.purpose &&
          candidate.usedAt === null &&
          candidate.expiresAt > where.expiresAt.gt,
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  };
  const prisma = {
    user: { findUnique: async () => account },
    authToken,
    $transaction: async (work) =>
      work({
        user: {
          findUnique: async () => account,
          update: async ({ data }) => {
            account = { ...account, ...data };
          },
        },
        authToken,
        $queryRaw: async () => [],
      }),
  };
  const mail = {
    sendVerificationEmail: async (email, token) => {
      sent.push({ email, token });
    },
  };
  const service = new AuthService(prisma, {}, mail);

  await service.requestEmailVerification('test@example.com');
  assert.equal(
    rows.some((row) => row.id === oldId),
    false,
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, 'test@example.com');
  const issued = rows.find((row) => row.id === sent[0].token.split('.')[0]);
  assert.ok(issued);
  assert.equal(issued.purpose, 'EMAIL_VERIFICATION');
  assert.equal(
    issued.expiresAt.getTime() - Date.now() <= 2 * 60 * 60 * 1000,
    true,
  );
  await assert.rejects(service.verifyEmail(oldToken), /invalid or expired/);
  await service.verifyEmail(sent[0].token);
  assert.ok(account.emailVerifiedAt);
  await assert.rejects(
    service.verifyEmail(sent[0].token),
    /invalid or expired/,
  );

  await service.requestEmailVerification('test@example.com');
  assert.equal(sent.length, 1);

  account = { ...account, emailVerifiedAt: new Date() };
  await service.requestEmailVerification('test@example.com');
  account = null;
  await service.requestEmailVerification('missing@example.com');
  assert.equal(sent.length, 1);
});

test('failed verification mail keeps generic behavior and cooldown state', async () => {
  const rows = [
    {
      id: 'other',
      purpose: 'EMAIL_VERIFICATION',
      userId: 'another-user',
      usedAt: null,
    },
  ];
  const authToken = {
    findFirst: async () => null,
    deleteMany: async ({ where }) => {
      const index = rows.findIndex((row) => row.id === where.id);
      if (index >= 0) rows.splice(index, 1);
      return { count: index >= 0 ? 1 : 0 };
    },
    create: async ({ data }) => {
      rows.push({ ...data, createdAt: new Date(), usedAt: null });
    },
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user',
        email: 'test@example.com',
        emailVerifiedAt: null,
      }),
    },
    authToken,
    $transaction: async (work) =>
      work({
        user: {
          findUnique: async () => ({
            email: 'test@example.com',
            emailVerifiedAt: null,
          }),
        },
        authToken,
        $queryRaw: async () => [],
      }),
  };
  const service = new AuthService(
    prisma,
    {},
    {
      sendVerificationEmail: async () => {
        throw new Error('SMTP failed');
      },
    },
  );
  await service.requestEmailVerification('test@example.com');
  assert.equal(rows.length, 2);
  assert.ok(rows.some((row) => row.id === 'other'));
});
