import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SuperadminGuard } from '../dist/superadmin/guards/superadmin.guard.js';
import { SuperadminController } from '../dist/superadmin/superadmin.controller.js';
import { AccessTokenGuard } from '../dist/auth/guards/access-token.guard.js';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';

test('superadmin controller authenticates before checking permissions', () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, SuperadminController), [
    AccessTokenGuard,
    SuperadminGuard,
  ]);
});

test('superadmin guard uses current database permissions', async () => {
  let user = { role: 'SUPERADMIN' };
  let lookups = 0;
  const guard = new SuperadminGuard({
    user: {
      findUnique: async ({ where, select }) => {
        lookups++;
        assert.equal(where.id, 'verified-user-id');
        assert.deepEqual(select, { role: true });
        return user;
      },
    },
  });
  const context = (request) => ({
    switchToHttp: () => ({ getRequest: () => request }),
  });
  await assert.rejects(
    guard.canActivate(context({})),
    (error) => error.getStatus() === 401,
  );
  assert.equal(lookups, 0);
  const authenticated = context({ user: { sub: 'verified-user-id' } });
  assert.equal(await guard.canActivate(authenticated), true);
  user = { role: 'USER' };
  await assert.rejects(
    guard.canActivate(authenticated),
    (error) => error.getStatus() === 403,
  );
  user = null;
  await assert.rejects(
    guard.canActivate(authenticated),
    (error) => error.getStatus() === 401,
  );
  assert.equal(lookups, 3);
});
