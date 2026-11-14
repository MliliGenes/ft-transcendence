import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import pg from 'pg';
import validation from 'class-validator';

const { isEmail, length, isByteLength } = validation;

export async function bootstrapSuperadmin(client, env = process.env) {
  await client.query('BEGIN');
  try {
    // Serialize with other bootstrap instances and the admin API.
    await client.query('SELECT pg_advisory_xact_lock(73929101)');
    const existing = await client.query(
      'SELECT "id" FROM "User" WHERE "role" = $1 LIMIT 1',
      ['SUPERADMIN'],
    );
    if (existing.rows.length) {
      await client.query('COMMIT');
      return 'Superadmin already exists; credentials unchanged.';
    }

    const username = env.SUPERADMIN_USERNAME?.trim();
    const email = env.SUPERADMIN_EMAIL?.trim();
    const password = env.SUPERADMIN_PASSWORD;
    if (!username || !email || !password) {
      throw new Error(
        'Set SUPERADMIN_USERNAME, SUPERADMIN_EMAIL, and SUPERADMIN_PASSWORD in envs/user-service.env.',
      );
    }
    if (
      !length(username, 3, 30) ||
      !isEmail(email) ||
      !length(password, 8, 32) ||
      !isByteLength(password, 0, 72)
    ) {
      throw new Error(
        'Invalid superadmin settings: username must be 3–30 characters, email must be valid, and password must be 8–32 characters and at most 72 UTF-8 bytes.',
      );
    }
    const conflict = await client.query(
      'SELECT "id" FROM "User" WHERE "username" = $1 OR "email" = $2 LIMIT 1',
      [username, email],
    );
    if (conflict.rows.length) {
      throw new Error(
        'Superadmin username or email is already in use. Choose unused credentials or explicitly promote the existing account with bootstrap:superadmin.',
      );
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      'INSERT INTO "User" ("id", "username", "email", "passwordHash", "role", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW())',
      [randomUUID(), username, email, passwordHash, 'SUPERADMIN'],
    );
    await client.query('COMMIT');
    return 'Initial superadmin created.';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  try {
    await client.connect();
    console.log(await bootstrapSuperadmin(client));
  } catch (error) {
    // Database error details may contain credentials or account data.
    console.error(
      error.code
        ? `Superadmin bootstrap failed (${error.code}). Check database connectivity, migrations, and unique account settings.`
        : error.message,
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
