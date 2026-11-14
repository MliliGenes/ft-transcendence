import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { run } from '../process.mjs';

test('aborting a command terminates its grandchildren before cleanup returns', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'nook-process-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ready = join(dir, 'ready'),
    leaked = join(dir, 'leaked');
  const grandchild = `require('node:fs').writeFileSync(${JSON.stringify(ready)},'ready');setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(leaked)},'leak'),500)`;
  const child = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setInterval(()=>{},1000)`;
  const controller = new AbortController();
  const running = run(process.execPath, ['-e', child], {
    signal: controller.signal,
    capture: true,
  });
  const rejected = assert.rejects(running, /abort/i);
  const deadline = Date.now() + 10000;
  while (!existsSync(ready)) {
    assert.ok(Date.now() < deadline, 'grandchild started');
    await delay(20);
  }
  controller.abort();
  await rejected;
  await delay(650);
  assert.equal(existsSync(leaked), false);
});
