import { generateKeyPairSync } from 'node:crypto';
import { getVerificationKey } from './verification-key.js';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = keys.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

describe('verification key configuration', () => {
  it('accepts a public RSA key, including escaped newlines from env files', () => {
    expect(getVerificationKey(publicKey)).toBe(publicKey.trim());
    expect(getVerificationKey(publicKey.replace(/\n/g, '\\n'))).toBe(
      publicKey.trim(),
    );
  });

  it('rejects a private signing key', () => {
    const privateKey = keys.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    expect(() => getVerificationKey(privateKey)).toThrow('public RSA key');
  });

  it('rejects malformed configuration', () => {
    expect(() => getVerificationKey('not a key')).toThrow();
  });

  it('explains malformed PEM contents without exposing the supplied value', () => {
    const malformed =
      '-----BEGIN PUBLIC KEY-----\ninvalid-test-contents\n-----END PUBLIC KEY-----';
    expect(() => getVerificationKey(malformed)).toThrow(
      'JWT_PUBLIC_KEY is not a valid PEM public key. Copy the complete public key, including BEGIN/END lines.',
    );
  });

  it('rejects weak RSA keys', () => {
    const weak = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const pem = weak.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    expect(() => getVerificationKey(pem)).toThrow('at least 2048 bits');
  });

  it('rejects keys for another algorithm', () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = ec.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(() => getVerificationKey(pem)).toThrow('RSA key');
  });
});
