// Run from the repository root: node nginx/check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { get } from 'node:https';

const ca = readFileSync(
  new URL('../volumes/nginx/certs/localhost.crt', import.meta.url),
);
function request(path) {
  return new Promise((resolve, reject) => {
    const req = get(
      `https://localhost${path}`,
      { ca, timeout: 5000 },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          }),
        );
        response.on('error', reject);
      },
    );
    req.on('timeout', () =>
      req.destroy(new Error('Gateway request timed out')),
    );
    req.on('error', reject);
  });
}

const page = await request('/login');
assert.equal(page.status, 200);
assert.ok(
  page.body.includes('<title>Log in — Nook</title>'),
  'Next.js should render the login page title',
);
assert.ok(
  page.body.includes('Welcome back.'),
  'Next.js should render the login page content',
);
const api = await request('/api/');
assert.equal(api.status, 200);
assert.equal(typeof JSON.parse(api.body).message, 'string');
const missing = await request('/api/does-not-exist');
assert.equal(missing.status, 404);
assert.match(missing.headers['content-type'], /application\/json/);
const game = await request('/api/game/health');
assert.equal(game.status, 200, 'Game HTTP route should reach game-service');
assert.equal(JSON.parse(game.body).service, 'game');
const socket = await request('/api/game/socket.io/?EIO=4&transport=polling');
assert.equal(
  socket.status,
  200,
  'Game Socket.IO path should reach game-service',
);
assert.match(socket.body, /^0\{"sid":/);
console.log(
  'HTTPS certificate, Next.js pages, User API, Game HTTP and Game Socket.IO routing passed.',
);
