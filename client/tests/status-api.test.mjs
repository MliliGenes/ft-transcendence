import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPlatformHealth } from '../app/api/status/route.ts';

test('status endpoint returns operational status and all service categories', async () => {
  // Mock global fetch for health checks
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200 });

  try {
    const health = await checkPlatformHealth();
    assert.equal(health.status, 'operational');
    assert.ok(Array.isArray(health.services));
    assert.equal(health.services.length, 4);

    const names = health.services.map((s) => s.name);
    assert.ok(names.includes('Authentication & Accounts'));
    assert.ok(names.includes('Chat & Messaging'));
    assert.ok(names.includes('Code Arena Game Engine'));
    assert.ok(names.includes('Media & Object Storage'));

    for (const service of health.services) {
      assert.equal(service.status, 'operational');
      assert.ok(typeof service.latencyMs === 'number');
      assert.ok(typeof service.description === 'string');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('status endpoint marks degraded or outage when a service is unreachable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('game-service')) {
      throw new Error('Connection refused');
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const health = await checkPlatformHealth();
    assert.equal(health.status, 'outage');
    const game = health.services.find(
      (s) => s.name === 'Code Arena Game Engine',
    );
    assert.equal(game?.status, 'down');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
