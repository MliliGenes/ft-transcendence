import assert from 'node:assert/strict';
import { test } from 'node:test';

test('browser-auth entry point loads with no exports yet', async () => {
  const entry = await import('../src/client.js');
  assert.deepEqual(Object.keys(entry), []);
});
