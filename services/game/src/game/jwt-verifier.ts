import crypto from 'node:crypto';

export interface TokenPayload {
  sub: string;
  exp: number;
  iss?: string;
  aud?: string;
  username?: string;
  preferred_username?: string;
}

/**
 * Verify an RS256 access token issued by Nook's user-service.
 * Zero external dependencies — uses Node standard library crypto.
 */
export function verifyAccessToken(
  token: string,
  rawPublicKey?: string,
): TokenPayload {
  const publicKeyPem = (
    rawPublicKey ??
    process.env.JWT_PUBLIC_KEY ??
    ''
  ).replace(/\\n/g, '\n');
  if (!publicKeyPem) {
    throw new Error('JWT_PUBLIC_KEY is not configured');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string };
  let payload: TokenPayload;

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid token encoding or JSON');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported token algorithm: ${header.alg ?? 'unknown'}`);
  }

  const data = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = Buffer.from(sigB64, 'base64url');

  let isVerified = false;
  try {
    isVerified = crypto.verify('sha256', data, publicKeyPem, signature);
  } catch {
    throw new Error('Invalid token signature');
  }

  if (!isVerified) {
    throw new Error('Invalid token signature');
  }

  if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new Error('Invalid token: missing subject (sub)');
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    throw new Error('Access token expired');
  }

  if (payload.iss && payload.iss !== 'user-service') {
    throw new Error('Invalid token issuer');
  }

  if (payload.aud && payload.aud !== 'ft-transcendence-api') {
    throw new Error('Invalid token audience');
  }

  return payload;
}
