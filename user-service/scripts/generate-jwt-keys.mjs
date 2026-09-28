// Run from the project root: node scripts/generate-jwt-keys.mjs
// Generates key files for reference; does not modify .env.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Resolve paths relative to this script, regardless of the working directory.
const directory = new URL('../.keys/', import.meta.url);
const privatePath = new URL('jwt-private.pem', directory);
const publicPath = new URL('jwt-public.pem', directory);

if (existsSync(privatePath) || existsSync(publicPath)) {
  console.error('Key files already exist in .keys/. No files were changed.');
  process.exit(1);
}

// Generate a matching RSA pair. PEM encodes each key as text.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

mkdirSync(directory, { recursive: true, mode: 0o700 });
// The wx flag prevents overwriting an existing file.
writeFileSync(privatePath, privateKey, { flag: 'wx', mode: 0o600 });
writeFileSync(publicPath, publicKey, { flag: 'wx', mode: 0o644 });

console.log(`Key pair saved to ${fileURLToPath(directory)}`);
console.log('Copy the PEM contents into JWT_PRIVATE_KEY and JWT_PUBLIC_KEY in .env.');
