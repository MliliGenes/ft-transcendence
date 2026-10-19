import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { createRequire } from 'node:module';
import { JwtService } from '@nestjs/jwt';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const requireUser = createRequire(
  join(repository, 'user-service/package.json'),
);
const bcrypt = requireUser('bcrypt');
const random = () => randomBytes(32).toString('hex');
const health = (port, path = '/') => ({
  test: [
    'CMD',
    'node',
    '-e',
    `fetch('http://127.0.0.1:${port}${path}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
  ],
  interval: '2s',
  timeout: '5s',
  retries: 45,
  start_period: '15s',
});

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 180000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

// Dedicated containers/credentials only. No local .env or team database is used.
test(
  'CHAT-01: real login, HTTPS routing, projection and database isolation',
  { timeout: 300000 },
  async (t) => {
    const project =
      'nook-chat01-' + randomUUID().replaceAll('-', '').slice(0, 12);
    const folder = mkdtempSync(join(tmpdir(), 'nook-chat01-'));
    const composeFile = join(folder, 'compose.json');
    const userPassword = random(),
      chatPassword = random(),
      internalKey = random();
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKey = keys.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    const privateKey = keys.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    const userId = randomUUID(),
      loginPassword = randomBytes(12).toString('hex');
    const passwordHash = await bcrypt.hash(loginPassword, 4);
    const fixture = {
      services: {
        'user-db': {
          image: 'postgres:18-alpine',
          networks: ['user-data'],
          environment: {
            POSTGRES_USER: 'nook_user',
            POSTGRES_PASSWORD: userPassword,
            POSTGRES_DB: 'nook_user',
          },
          healthcheck: {
            test: [
              'CMD-SHELL',
              'pg_isready -h 127.0.0.1 -U nook_user -d nook_user',
            ],
            interval: '2s',
            timeout: '5s',
            retries: 30,
          },
        },
        'chat-db': {
          image: 'postgres:18-alpine',
          networks: ['chat-data'],
          environment: {
            POSTGRES_PASSWORD: random(),
            CHAT_DB_PASSWORD: chatPassword,
          },
          volumes: [
            join(repository, 'chat-service/prisma/init-database.sh') +
              ':/docker-entrypoint-initdb.d/10-chat.sh:ro',
          ],
          healthcheck: {
            test: [
              'CMD-SHELL',
              'pg_isready -h 127.0.0.1 -U nook_chat -d nook_chat',
            ],
            interval: '2s',
            timeout: '5s',
            retries: 30,
          },
        },
        'user-service': {
          image: 'nook-user-chat-check:local',
          networks: ['services', 'user-data'],
          depends_on: { 'user-db': { condition: 'service_healthy' } },
          environment: {
            PORT: '3000',
            SUPERADMIN_USERNAME: 'bootstrap-fixture',
            SUPERADMIN_EMAIL: 'bootstrap-fixture@example.test',
            SUPERADMIN_PASSWORD: randomBytes(16).toString('hex'),
            POSTGRES_HOST: 'user-db',
            POSTGRES_PORT: '5432',
            POSTGRES_USER: 'nook_user',
            POSTGRES_PASSWORD: userPassword,
            POSTGRES_DB: 'nook_user',
            JWT_PRIVATE_KEY: privateKey,
            JWT_PUBLIC_KEY: publicKey,
            INTERNAL_API_SECRET: internalKey,
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: '1',
            SMTP_USERNAME: 'fixture@example.test',
            SMTP_PASSWORD: random(),
            AUTH_FRONTEND_URL: 'https://localhost',
            RABBITMQ_HOST: '127.0.0.1',
            RABBITMQ_PORT: '1',
            RABBITMQ_USER: 'fixture',
            RABBITMQ_PASS: random(),
          },
          healthcheck: health(3000),
        },
        'chat-service': {
          image: 'nook-chat-foundation-check:local',
          networks: ['services', 'chat-data'],
          depends_on: {
            'chat-db': { condition: 'service_healthy' },
            'user-service': { condition: 'service_healthy' },
          },
          environment: {
            PORT: '3001',
            DATABASE_URL: `postgresql://nook_chat:${chatPassword}@chat-db:5432/nook_chat`,
            USER_SERVICE_URL: 'http://user-service:3000',
            JWT_PUBLIC_KEY: publicKey,
            INTERNAL_API_SECRET: internalKey,
          },
          healthcheck: health(3001, '/health'),
        },
        nginx: {
          image: 'nook-gateway-chat-check:local',
          networks: ['services'],
          depends_on: { 'chat-service': { condition: 'service_healthy' } },
          ports: ['127.0.0.1::443'],
          volumes: ['certs:/etc/nginx/certs'],
          healthcheck: {
            test: ['CMD-SHELL', 'test -s /var/run/nginx.pid'],
            interval: '2s',
            timeout: '5s',
            retries: 30,
          },
        },
      },
      networks: {
        services: {},
        'user-data': { internal: true },
        'chat-data': { internal: true },
      },
      volumes: { certs: {} },
    };
    writeFileSync(composeFile, JSON.stringify(fixture), { mode: 0o600 });
    const compose = ['compose', '--project-name', project, '-f', composeFile];
    const id = (name) => docker([...compose, 'ps', '--quiet', name]);
    const query = (name, role, db, sql) =>
      docker(
        [
          'exec',
          '-i',
          id(name),
          'psql',
          '-U',
          role,
          '-d',
          db,
          '-At',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        { input: sql },
      );
    const scrub = (text) =>
      [
        privateKey,
        publicKey,
        userPassword,
        chatPassword,
        internalKey,
        loginPassword,
        passwordHash,
      ].reduce((s, value) => s.replaceAll(value, '[redacted]'), text);
    try {
      for (const [image, context] of [
        ['nook-user-chat-check:local', 'user-service'],
        ['nook-chat-foundation-check:local', 'chat-service'],
        ['nook-gateway-chat-check:local', 'nginx'],
      ]) {
        try {
          docker(['image', 'inspect', '--format', '{{.Id}}', image]);
        } catch {
          throw new Error(
            'Build the ' + context + ' test image first; see CHAT01.md.',
          );
        }
      }
      try {
        docker([
          ...compose,
          'up',
          '--detach',
          '--wait',
          '--wait-timeout',
          '120',
        ]);
      } catch {
        // No environment dump or token output; bounded/redacted startup logs only.
        const logs = docker([...compose, 'logs', '--no-color', '--tail', '35']);
        throw new Error('Isolated startup failed:\n' + scrub(logs));
      }
      const gateway = id('nginx');
      const certificate = docker([
        'exec',
        gateway,
        'cat',
        '/etc/nginx/certs/localhost.crt',
      ]);
      const bindings = JSON.parse(
        docker([
          'inspect',
          '--format',
          '{{json .NetworkSettings.Ports}}',
          gateway,
        ]),
      );
      const port = Number(bindings['443/tcp'][0].HostPort);
      const request = (path, { method = 'GET', headers = {}, body } = {}) =>
        new Promise((resolve, reject) => {
          const text = body === undefined ? undefined : JSON.stringify(body);
          const req = https.request(
            {
              hostname: '127.0.0.1',
              servername: 'localhost',
              port,
              path,
              method,
              ca: certificate,
              agent: false,
              headers: {
                ...headers,
                ...(text
                  ? {
                      'Content-Type': 'application/json',
                      'Content-Length': Buffer.byteLength(text),
                    }
                  : {}),
              },
            },
            (res) => {
              let response = '';
              res.setEncoding('utf8');
              res.on('data', (chunk) => {
                response += chunk;
              });
              res.on('end', () => {
                let json;
                try {
                  json = JSON.parse(response);
                } catch {}
                resolve({
                  status: res.statusCode,
                  body: json,
                  headers: res.headers,
                });
              });
            },
          );
          req.on('error', reject);
          req.setTimeout(10000, () =>
            req.destroy(new Error('HTTPS request timed out')),
          );
          req.end(text);
        });
      query(
        'user-db',
        'nook_user',
        'nook_user',
        `INSERT INTO "User" (id,username,email,"passwordHash","updatedAt") VALUES ('${userId}','chat01fixture','chat01@example.test','${passwordHash}',now());`,
      );
      assert.equal(
        query(
          'chat-db',
          'postgres',
          'nook_chat',
          `SELECT count(*) FROM "ChatUser" WHERE id='${userId}';`,
        ),
        '0',
      );
      let accessToken;
      await t.test(
        'existing login issues a token accepted through the HTTPS Chat route',
        async () => {
          const login = await request('/api/auth/login', {
            method: 'POST',
            headers: { Origin: 'https://localhost' },
            body: { email: 'chat01@example.test', password: loginPassword },
          });
          assert.equal(login.status, 200);
          assert.equal(typeof login.body.accessToken, 'string');
          accessToken = login.body.accessToken;
          const response = await request('/api/chat/session', {
            headers: { Authorization: 'Bearer ' + accessToken },
          });
          assert.equal(response.status, 200);
          assert.deepEqual(response.body, { userId });
          assert.equal(response.headers['cache-control'], 'no-store');
          assert.equal(
            query(
              'chat-db',
              'postgres',
              'nook_chat',
              `SELECT username FROM "ChatUser" WHERE id='${userId}';`,
            ),
            'chat01fixture',
          );
        },
      );
      await t.test(
        'rejects missing, invalid and expired tokens via the gateway',
        async () => {
          assert.equal((await request('/api/chat/session')).status, 401);
          assert.equal(
            (
              await request('/api/chat/session', {
                headers: { Authorization: 'Bearer invalid' },
              })
            ).status,
            401,
          );
          const expired = await new JwtService().signAsync(
            { sub: userId, exp: Math.floor(Date.now() / 1000) - 60 },
            {
              privateKey,
              algorithm: 'RS256',
              issuer: 'user-service',
              audience: 'ft-transcendence-api',
            },
          );
          assert.equal(
            (
              await request('/api/chat/session', {
                headers: { Authorization: 'Bearer ' + expired },
              })
            ).status,
            401,
          );
          assert.equal((await request('/api/chat/health')).status, 200);
        },
      );
      await t.test(
        'keeps internal endpoints private even when the caller has the server key',
        async () => {
          for (const path of [
            '/api/internal/users',
            '/internal/users',
            '/api/chat/internal/users',
            '/api/INTERNAL/users',
          ]) {
            assert.equal(
              (
                await request(path + '?ids=' + userId, {
                  headers: { 'x-internal-key': internalKey },
                })
              ).status,
              404,
            );
          }
          const probe = `(async()=>{const r=await fetch('http://user-service:3000/internal/users?ids=${userId}');process.stdout.write(String(r.status));})();`;
          assert.equal(
            docker(['exec', id('chat-service'), 'node', '-e', probe]),
            '401',
          );
        },
      );
      await t.test(
        'Chat cannot connect to the User database and holds no private signing key',
        async () => {
          const probe =
            "const net=require('node:net');const s=net.createConnection({host:'user-db',port:5432});s.once('connect',()=>{s.destroy();process.exit(1)});s.once('error',()=>process.exit(0));s.setTimeout(2000,()=>{s.destroy();process.exit(0)});";
          docker(['exec', id('chat-service'), 'node', '-e', probe]);
          const privateNetworks = JSON.parse(
            docker([
              'inspect',
              '--format',
              '{{json .NetworkSettings.Networks}}',
              id('user-db'),
            ]),
          );
          const privateAddress = Object.values(privateNetworks)[0].IPAddress;
          assert.match(privateAddress, /^[0-9.]+$/);
          const directProbe = probe.replace(
            "host:'user-db'",
            'host:' + JSON.stringify(privateAddress),
          );
          docker(['exec', id('chat-service'), 'node', '-e', directProbe]);

          assert.equal(
            docker([
              'exec',
              id('chat-service'),
              'node',
              '-e',
              "process.stdout.write(String(!process.env.JWT_PRIVATE_KEY && process.env.DATABASE_URL.includes('@chat-db:')))",
            ]),
            'true',
          );
        },
      );
      await t.test(
        'account deletion rejects the old token and anonymizes the local row',
        async () => {
          query(
            'user-db',
            'nook_user',
            'nook_user',
            `DELETE FROM "RefreshToken" WHERE "userId"='${userId}'; DELETE FROM "User" WHERE id='${userId}';`,
          );
          assert.equal(
            (
              await request('/api/chat/session', {
                headers: { Authorization: 'Bearer ' + accessToken },
              })
            ).status,
            401,
          );
          assert.equal(
            query(
              'chat-db',
              'postgres',
              'nook_chat',
              `SELECT (username IS NULL AND "displayName" IS NULL AND "avatarUrl" IS NULL AND "deletedAt" IS NOT NULL)::text FROM "ChatUser" WHERE id='${userId}';`,
            ),
            'true',
          );
        },
      );
    } finally {
      try {
        docker([...compose, 'down', '--volumes', '--remove-orphans']);
      } finally {
        assert.ok(
          realpathSync(folder).startsWith(resolve(tmpdir()) + '/nook-chat01-'),
        );
        rmSync(folder, { recursive: true, force: true });
      }
    }
  },
);
