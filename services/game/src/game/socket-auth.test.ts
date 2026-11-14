import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import crypto from 'node:crypto';
import {
  attachSocketPrincipal,
  principalFromHandshake,
  requireSocketPrincipal,
  socketPrincipal,
} from './socket-auth.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const publicKeyPem = publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

function makeToken(payloadOverrides: Record<string, unknown> = {}): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-token-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'user-service',
      aud: 'ft-transcendence-api',
      ...payloadOverrides,
    }),
  ).toString('base64url');
  const sign = crypto.createSign('sha256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(privateKey, 'base64url');
  return `${header}.${payload}.${sig}`;
}

function fakeSocket(
  auth: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Socket {
  return { handshake: { auth, query, headers }, data } as unknown as Socket;
}

describe('socket authorization context', () => {
  beforeEach(() => {
    vi.stubEnv('DEV_PRINCIPAL', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads one trusted identity from auth and accepts an equivalent query fallback', () => {
    const client = fakeSocket(
      { userId: 'alice', matchId: 'match-1' },
      { userId: 'alice', matchId: 'match-1' },
    );

    expect(principalFromHandshake(client, { matchIdRequired: true })).toEqual({
      userId: 'alice',
      matchId: 'match-1',
    });
  });

  it('supports user-only lobby handshakes while requiring Match identity for Match namespaces', () => {
    const client = fakeSocket({}, { userId: 'alice' });

    expect(principalFromHandshake(client)).toEqual({ userId: 'alice' });
    expect(() =>
      principalFromHandshake(client, { matchIdRequired: true }),
    ).toThrow('missing socket matchId');
  });

  it('fails closed on conflicting identity sources or disabled development auth', () => {
    expect(() =>
      principalFromHandshake(
        fakeSocket({ userId: 'alice' }, { userId: 'mallory' }),
      ),
    ).toThrow('conflicting socket userId');
    vi.stubEnv('DEV_PRINCIPAL', 'false');
    expect(() =>
      principalFromHandshake(fakeSocket({ userId: 'alice' })),
    ).toThrow('authentication required');
  });

  it('attaches and requires the verified principal without trusting raw client fields', () => {
    const client = fakeSocket();
    expect(socketPrincipal(client)).toBeNull();

    attachSocketPrincipal(client, { userId: 'alice', matchId: 'match-1' });
    expect(requireSocketPrincipal(client, { matchIdRequired: true })).toEqual({
      userId: 'alice',
      matchId: 'match-1',
    });
    expect(requireSocketPrincipal(client)).toEqual({
      userId: 'alice',
      matchId: 'match-1',
    });
  });

  it('authenticates using a valid JWT token when DEV_PRINCIPAL is disabled', () => {
    vi.stubEnv('DEV_PRINCIPAL', 'false');
    vi.stubEnv('JWT_PUBLIC_KEY', publicKeyPem);

    const token = makeToken();
    const client = fakeSocket({ token, matchId: 'match-42' });
    expect(principalFromHandshake(client, { matchIdRequired: true })).toEqual({
      userId: 'user-token-123',
      matchId: 'match-42',
    });
  });

  it('rejects an invalid or expired JWT token', () => {
    vi.stubEnv('DEV_PRINCIPAL', 'false');
    vi.stubEnv('JWT_PUBLIC_KEY', publicKeyPem);

    const expiredToken = makeToken({
      exp: Math.floor(Date.now() / 1000) - 100,
    });
    const client = fakeSocket({ token: expiredToken });
    expect(() => principalFromHandshake(client)).toThrow(
      'Access token expired',
    );
  });
});
