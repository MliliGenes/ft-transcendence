import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import configure from '../vite.config.js';

test('development proxy keeps the canonical cookie narrow and root deletion at root', () => {
  const proxy = configure({ mode: 'test' }).server.proxy['/api'];
  assert.deepEqual(proxy.cookiePathRewrite, { '/auth/': '/api/auth/', '/auth/github': '/api/auth/github', '/auth/discord': '/api/auth/discord', '/': '/' });
  assert.equal(proxy.rewrite('/api/auth/refresh'), '/auth/refresh');
});


test('actual development proxy scopes refresh and provider cookies to public callback paths', async (t) => {
  const upstream = createHttpServer((request, response) => {
    assert.equal(request.url, '/auth/github');
    response.setHeader('Set-Cookie', [
      'refresh_token=fixture; HttpOnly; Path=/auth/',
      'refresh_token=; HttpOnly; Max-Age=0; Path=/',
      'github_state=fixture; HttpOnly; Path=/auth/github',
      'discord_state=fixture; HttpOnly; Path=/auth/discord',
    ]);
    response.end('fixture');
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => upstream.close(resolve)));
  const config = configure({ mode: 'test' });
  config.server.proxy['/api'].target = `http://127.0.0.1:${upstream.address().port}`;
  const vite = await createViteServer({
    ...config,
    configFile: false,
    envDir: false,
    server: { ...config.server, host: '127.0.0.1', port: 0 },
  });
  t.after(() => vite.close());
  await vite.listen();
  const response = await fetch(`http://127.0.0.1:${vite.httpServer.address().port}/api/auth/github`);
  assert.equal(await response.text(), 'fixture');
  assert.deepEqual(response.headers.getSetCookie(), [
    'refresh_token=fixture; HttpOnly; Path=/api/auth/',
    'refresh_token=; HttpOnly; Max-Age=0; Path=/',
    'github_state=fixture; HttpOnly; Path=/api/auth/github',
    'discord_state=fixture; HttpOnly; Path=/api/auth/discord',
  ]);
});
