import { ConfigService } from '@nestjs/config';
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { UserServiceClient } from './user-service.client.js';

const id = '00000000-0000-4000-8000-000000000001';
const key = 'fixture-internal-key-'.repeat(3);
const profile = {
  id,
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  updatedAt: '2026-10-18T00:00:00.000Z',
  deleted: false,
};

describe('User-service REST client', () => {
  let server: Server;
  let base: string;
  let handle: (req: IncomingMessage, res: ServerResponse) => void;
  let client: UserServiceClient;
  let requests = 0;
  beforeAll(async () => {
    server = createServer((req, res) => {
      requests++;
      handle(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    base = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  });
  beforeEach(() => {
    requests = 0;
    client = new UserServiceClient(
      new ConfigService({ USER_SERVICE_URL: base, INTERNAL_API_SECRET: key }),
    );
    handle = (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([profile]));
    };
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it('uses the agreed path, batch query and server key', async () => {
    handle = (req, res) => {
      expect(req.headers['x-internal-key']).toBe(key);
      expect(new URL(req.url!, base).pathname).toBe('/internal/users');
      expect(new URL(req.url!, base).searchParams.get('ids')).toBe(id);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([profile]));
    };
    expect((await client.getUsers([id])).users[0]).toMatchObject({
      id,
      username: 'alice',
    });
  });
  it('checks both-way blocking using the agreed authenticated REST contract', async () => {
    const other = '00000000-0000-4000-8000-000000000002';
    handle = (req, res) => {
      const url = new URL(req.url!, base);
      expect(url.pathname).toBe('/internal/blocks/check');
      expect(url.searchParams.get('a')).toBe(id);
      expect(url.searchParams.get('b')).toBe(other);
      expect(req.headers['x-internal-key']).toBe(key);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ blocked: false }));
    };
    await client.assertUnblocked(id, other);
    await client.assertUnblocked(id, other);
    expect(requests).toBe(2); // Privacy decisions are never cached.
  });
  it('denies a blocked pair', async () => {
    handle = (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ blocked: true }));
    };
    await expect(client.assertUnblocked(id, id)).rejects.toMatchObject({
      status: 403,
    });
  });
  it.each([{}, { blocked: 'false' }, [], null])(
    'fails closed for malformed privacy data %#',
    async (body) => {
      handle = (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      };
      await expect(client.assertUnblocked(id, id)).rejects.toMatchObject({
        status: 503,
      });
    },
  );
  it('fails closed when the privacy endpoint is unavailable', async () => {
    handle = (_req, res) => {
      res.writeHead(503);
      res.end();
    };
    await expect(client.assertUnblocked(id, id)).rejects.toMatchObject({
      status: 503,
    });
  });
  it('coalesces simultaneous lookups without caching future account checks', async () => {
    await Promise.all([client.getUsers([id]), client.getUsers([id])]);
    expect(requests).toBe(1);
    await client.getUsers([id]);
    expect(requests).toBe(2);
  });
  it('recognizes a source tombstone', async () => {
    handle = (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify([
          { ...profile, username: null, displayName: null, deleted: true },
        ]),
      );
    };
    expect((await client.getUsers([id])).missingIds).toEqual([id]);
  });
  it.each([
    [],
    [profile, profile],
    [{ ...profile, id: 'bad' }],
    [{ ...profile, updatedAt: 'yesterday' }],
    [{ ...profile, username: 42 }],
    [{ ...profile, deleted: true }],
  ])('rejects malformed or incomplete snapshots %#', async (value) => {
    handle = (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    };
    await expect(client.getUsers([id])).rejects.toThrow(
      'User service is unavailable',
    );
  });
  it('rejects server errors without exposing their response body', async () => {
    handle = (_req, res) => {
      res.writeHead(500);
      res.end('private upstream details');
    };
    await expect(client.getUsers([id])).rejects.toThrow(
      'User service is unavailable',
    );
  });
  it('never follows redirects with the internal key', async () => {
    handle = (_req, res) => {
      res.writeHead(302, { Location: base + '/redirected' });
      res.end();
    };
    await expect(client.getUsers([id])).rejects.toThrow(
      'User service is unavailable',
    );
    expect(requests).toBe(1);
  });
  it('bounds the response body', async () => {
    handle = (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(' '.repeat(262145));
    };
    await expect(client.getUsers([id])).rejects.toThrow(
      'User service is unavailable',
    );
  });
  it('bounds stalled requests', async () => {
    handle = () => {};
    await expect(client.getUsers([id])).rejects.toThrow(
      'User service is unavailable',
    );
  }, 4000);
  it.each([
    'http://example.com',
    'http://localhost/path',
    'https://user:password@example.com',
    'https://example.com?query=1',
  ])('rejects unsafe base configuration %s', (url) => {
    expect(
      () =>
        new UserServiceClient(
          new ConfigService({
            USER_SERVICE_URL: url,
            INTERNAL_API_SECRET: key,
          }),
        ),
    ).toThrow();
  });
  it('requires replacing the example key before starting', () => {
    expect(
      () =>
        new UserServiceClient(
          new ConfigService({
            USER_SERVICE_URL: base,
            INTERNAL_API_SECRET: 'REPLACE_WITH_SHARED_RANDOM_SECRET',
          }),
        ),
    ).toThrow('INTERNAL_API_SECRET');
  });
});
