import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('Created .env from .env.example');
}

let envContent = fs.readFileSync(envPath, 'utf8');

if (envContent.includes('JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\nchange-me') || !envContent.includes('JWT_PRIVATE_KEY=')) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const formattedPriv = privateKey.trim().replace(/\r?\n/g, '\\n');
  const formattedPub = publicKey.trim().replace(/\r?\n/g, '\\n');

  envContent = envContent.replace(
    /JWT_PRIVATE_KEY=.*/,
    `JWT_PRIVATE_KEY=${formattedPriv}`
  );
  envContent = envContent.replace(
    /JWT_PUBLIC_KEY=.*/,
    `JWT_PUBLIC_KEY=${formattedPub}`
  );

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('Generated and configured 2048-bit RSA keypair in .env');
} else {
  console.log('.env already contains valid JWT keys');
}
