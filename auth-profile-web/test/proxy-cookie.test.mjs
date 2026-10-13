import assert from 'node:assert/strict';
import { test } from 'node:test';
import configure from '../vite.config.js';

test('development proxy keeps the canonical cookie narrow and root deletion at root', () => {
  const proxy = configure({ mode: 'test' }).server.proxy['/api'];
  assert.deepEqual(proxy.cookiePathRewrite, { '/auth/': '/api/auth/', '/': '/' });
  assert.equal(proxy.rewrite('/api/auth/refresh'), '/auth/refresh');
});
