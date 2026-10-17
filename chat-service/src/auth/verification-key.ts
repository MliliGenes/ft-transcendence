import { createPublicKey, type KeyObject } from 'node:crypto';

export function getVerificationKey(value: string): string {
  const pem = value.replace(/\\n/g, '\n').trim();

  if (!/^-----BEGIN (RSA )?PUBLIC KEY-----/.test(pem)) {
    throw new Error('JWT_PUBLIC_KEY must contain a public RSA key.');
  }

  let key: KeyObject;

  try {
    key = createPublicKey(pem);
  } catch {
    throw new Error(
      'JWT_PUBLIC_KEY is not a valid PEM public key. Copy the complete public key, including BEGIN/END lines.',
    );
  }

  if (
    key.asymmetricKeyType !== 'rsa' ||
    (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
  ) {
    throw new Error('JWT_PUBLIC_KEY must be an RSA key of at least 2048 bits.');
  }

  return pem;
}
