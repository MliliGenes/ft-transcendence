// Run from the repository root: node nginx/check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { get } from 'node:https';

const ca = readFileSync(new URL('../volumes/nginx/certs/localhost.crt', import.meta.url));
function request(path) {
  return new Promise((resolve, reject) => {
    const req = get(`https://localhost${path}`, { ca, timeout: 5000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
      response.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Gateway request timed out')));
    req.on('error', reject);
  });
}

const page = await request('/login');
assert.equal(page.status, 200);
assert.match(page.body, /<div id="root"><\/div>/);
const api = await request('/api/');
assert.equal(api.status, 200);
assert.equal(typeof JSON.parse(api.body).message, 'string');
const missing = await request('/api/does-not-exist');
assert.equal(missing.status, 404);
assert.match(missing.headers['content-type'], /application\/json/);
console.log('HTTPS certificate, frontend SPA routing, API forwarding, and API 404 handling passed.');
