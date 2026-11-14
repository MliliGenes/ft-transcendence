import assert from 'node:assert/strict';
import test from 'node:test';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from '../process.mjs';

test('topology checks work without private settings and leave checkout settings untouched', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'nook-clean-topology-'));
  try {
    for (const name of [
      'compose.yaml',
      'compose.monitoring.yaml',
      'nginx/default.conf',
      'services/judge-worker/test/compose-topology.test.ts',
    ]) {
      const destination = join(fixture, name);
      mkdirSync(join(destination, '..'), { recursive: true });
      copyFileSync(join(root, name), destination);
    }
    mkdirSync(join(fixture, 'envs'));
    for (const name of readdirSync(join(root, 'envs')).filter((name) =>
      name.endsWith('.env.example'),
    )) {
      copyFileSync(join(root, 'envs', name), join(fixture, 'envs', name));
    }
    const canary = 'POSTGRES_PASSWORD=test-only-canary\n';
    writeFileSync(join(fixture, 'envs/judge-worker.env'), canary);
    symlinkSync(
      join(root, 'node_modules'),
      join(fixture, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const result = spawnSync(
      process.execPath,
      [
        join(root, 'node_modules/vitest/vitest.mjs'),
        'run',
        'services/judge-worker/test/compose-topology.test.ts',
        '--root',
        fixture,
      ],
      {
        cwd: fixture,
        env: {
          ...process.env,
          COMPOSE_FILE: join(fixture, 'must-not-read.yaml'),
          COMPOSE_ENV_FILES: join(fixture, 'must-not-read.env'),
        },
        encoding: 'utf8',
        timeout: 30000,
      },
    );
    assert.equal(
      result.status,
      0,
      result.error?.message ?? result.stdout + result.stderr,
    );
    assert.equal(
      readFileSync(join(fixture, 'envs/judge-worker.env'), 'utf8'),
      canary,
    );
    assert.deepEqual(
      readdirSync(join(fixture, 'envs')).filter((name) =>
        name.endsWith('.env'),
      ),
      ['judge-worker.env'],
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('missing Docker stops the Arena runner before any workspace suite starts', () => {
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (name.toLowerCase() === 'path') delete env[name];
  env.PATH = '';
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts/checks/arena-tests.mjs')],
    { env, encoding: 'utf8', timeout: 5000 },
  );
  assert.equal(result.status, 1, result.error?.message);
  assert.match(result.stderr, /Docker must be installed and running/);
  assert.doesNotMatch(result.stdout, /Arena workspace:/);
});
