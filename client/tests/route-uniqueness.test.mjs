import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const app = fileURLToPath(new URL('../app', import.meta.url));

test('App Router pages resolve to unique URL paths across route groups', () => {
  const routes = new Map();
  for (const file of readdirSync(app, { recursive: true })) {
    if (!/^page\.(tsx|jsx|js)$/.test(file.split(sep).at(-1))) continue;
    const segments = relative(app, dirname(resolve(app, file)))
      .split(sep)
      .filter((segment) => segment && !/^\(.*\)$/.test(segment));
    const route = `/${segments.join('/')}`;
    assert.equal(
      routes.has(route),
      false,
      `${file} duplicates ${routes.get(route)} at ${route}`,
    );
    routes.set(route, file);
  }
  assert.ok(routes.has('/privacy'));
  assert.ok(routes.has('/terms'));
});
