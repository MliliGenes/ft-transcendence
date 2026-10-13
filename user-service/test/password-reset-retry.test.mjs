import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthService } from '../dist/auth/auth.service.js';

test('reset requests replace old links and clean up only their failed email token', async () => {
  let rows = [
    { id: 'old', userId: 'user', purpose: 'PASSWORD_RESET', usedAt: null },
    { id: 'history', userId: 'user', purpose: 'PASSWORD_RESET', usedAt: new Date(0) },
    { id: 'verification', userId: 'user', purpose: 'EMAIL_VERIFICATION' },
    { id: 'other', userId: 'other-user', purpose: 'PASSWORD_RESET' },
  ];
  let locked = false;
  const authToken = {
    deleteMany: async ({ where }) => {
      if (where.userId) assert.equal(locked, true);
      const before = rows.length;
      rows = rows.filter(row => !Object.entries(where).every(([key, value]) => row[key] === value));
      return { count: before - rows.length };
    },
    create: async ({ data }) => {
      assert.equal(locked, true);
      rows.push({ ...data, usedAt: null });
      return data;
    },
  };
  const prisma = {
    user: { findUnique: async () => ({ id: 'user', email: 'test@example.com' }) },
    authToken,
    $transaction: async work => {
      const before = rows.slice();
      try { return await work({ authToken, $queryRaw: async () => { locked = true; } }); }
      catch (error) { rows = before; throw error; }
      finally { locked = false; }
    },
  };
  const sent = [];
  const mail = { sendPasswordResetEmail: async (_email, token) => { sent.push(token); } };
  const service = new AuthService(prisma, {}, mail);
  await service.requestPasswordReset('test@example.com');
  const firstId = sent[0].split('.')[0];
  assert.equal(rows.some(row => row.id === 'old'), false);
  assert.ok(rows.some(row => row.id === firstId));
  await service.requestPasswordReset('test@example.com');
  assert.equal(rows.some(row => row.id === firstId), false);
  const sendError = new Error('SMTP failed');
  mail.sendPasswordResetEmail = async () => { throw sendError; };
  await assert.rejects(service.requestPasswordReset('test@example.com'), error => error === sendError);
  assert.deepEqual(rows.map(row => row.id), ['history', 'verification', 'other']);
  mail.sendPasswordResetEmail = async () => {
    mail.sendPasswordResetEmail = async (_email, token) => { sent.push(token); };
    await service.requestPasswordReset('test@example.com');
    throw sendError;
  };
  await assert.rejects(service.requestPasswordReset('test@example.com'), error => error === sendError);
  assert.ok(rows.some(row => row.id === sent.at(-1).split('.')[0]));
  assert.equal(rows.filter(row => row.userId === 'user' && row.purpose === 'PASSWORD_RESET' && row.usedAt === null).length, 1);
  assert.ok(rows.some(row => row.id === 'history'));
});
