import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import bcrypt from 'bcrypt';
import { AuthService } from '../dist/auth/auth.service.js';

test('password reset revokes every active refresh session for only its user', async () => {
  const id = randomUUID();
  const userId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const priorRevocation = new Date(0);
  const sessions = [
    { userId, revokedAt: null },
    { userId, revokedAt: null },
    { userId, revokedAt: priorRevocation },
    { userId: randomUUID(), revokedAt: null },
  ];
  const stored = {
    userId, purpose: 'PASSWORD_RESET', usedAt: null,
    expiresAt: new Date(Date.now() + 60000),
    tokenHash: createHash('sha256').update(secret).digest('hex'),
  };
  let resetTokens = [
    { id, ...stored },
    { id: 'older-reset', userId, purpose: 'PASSWORD_RESET', usedAt: null },
    { id: 'verification', userId, purpose: 'EMAIL_VERIFICATION' },
    { id: 'other-reset', userId: 'other-user', purpose: 'PASSWORD_RESET' },
  ];
  let passwordHash;
  let locked = false;
  let consumed = false;
  const tx = {
    $queryRaw: async (_query, lockUserId) => {
      assert.equal(lockUserId, userId);
      locked = true;
    },
    authToken: { updateMany: async ({ data }) => {
      assert.equal(locked, true);
      if (consumed) return { count: 0 };
      consumed = true;
      resetTokens.find(row => row.id === id).usedAt = data.usedAt;
      return { count: 1 };
    }, deleteMany: async ({ where }) => {
      assert.equal(locked, true);
      assert.deepEqual(where, { userId, purpose: 'PASSWORD_RESET', usedAt: null });
      resetTokens = resetTokens.filter(row =>
        row.userId !== where.userId || row.purpose !== where.purpose || row.usedAt !== null);
      return { count: 1 };
    } },
    user: { update: async ({ where, data }) => {
      assert.equal(where.id, userId);
      passwordHash = data.passwordHash;
    } },
    refreshToken: { updateMany: async ({ where, data }) => {
      assert.equal(locked, true);
      assert.deepEqual(where, { userId, revokedAt: null });
      for (const session of sessions) {
        if (session.userId === where.userId && session.revokedAt === null)
          session.revokedAt = data.revokedAt;
      }
      return { count: 2 };
    } },
  };
  const service = new AuthService({
    authToken: { findUnique: async ({ where }) => resetTokens.find(row => row.id === where.id) },
    $transaction: async (work) => work(tx),
  }, {}, {});
  const token = `${id}.${secret}`;
  await assert.rejects(service.confirmPasswordReset(`${id}.${'A'.repeat(43)}`, 'newpassword'));
  assert.equal(consumed, false);
  assert.equal(resetTokens.length, 4);
  assert.equal(sessions[0].revokedAt, null);
  await service.confirmPasswordReset(token, 'newpassword');
  assert.equal(await bcrypt.compare('newpassword', passwordHash), true);
  assert.ok(sessions[0].revokedAt instanceof Date);
  assert.equal(sessions[1].revokedAt, sessions[0].revokedAt);
  assert.equal(sessions[2].revokedAt, priorRevocation);
  assert.equal(sessions[3].revokedAt, null);
  assert.deepEqual(resetTokens.map(row => row.id), [id, 'verification', 'other-reset']);
  assert.ok(resetTokens[0].usedAt instanceof Date);
  const previousHash = passwordHash;
  await assert.rejects(service.confirmPasswordReset(token, 'otherpassword'));
  assert.equal(passwordHash, previousHash);
});
