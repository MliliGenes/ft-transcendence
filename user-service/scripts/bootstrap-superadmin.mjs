import 'dotenv/config';
import pg from 'pg';

const args = process.argv.slice(2);
if (args.length !== 1 || !args[0].trim()) {
  console.error(
    'Usage: npm run bootstrap:superadmin -- existing-user@example.com',
  );
  process.exitCode = 1;
} else {
  const email = args[0].trim();
  const required = [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Missing environment settings: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    const client = new pg.Client({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });
    try {
      await client.connect();
      await client.query('BEGIN');
      // Same lock as the admin API to serialize role changes.
      await client.query('SELECT pg_advisory_xact_lock(73929101)');
      const result = await client.query(
        'SELECT "id", "role" FROM "User" WHERE "email" = $1 FOR UPDATE',
        [email],
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        console.error(
          'Account not found. Register the testing account first, then rerun this command.',
        );
        process.exitCode = 1;
      } else {
        const user = result.rows[0];
        if (user.role !== 'SUPERADMIN') {
          await client.query(
            'UPDATE "User" SET "role" = $1, "updatedAt" = NOW() WHERE "id" = $2',
            ['SUPERADMIN', user.id],
          );
        }
        await client.query('COMMIT');
        console.log(
          user.role === 'SUPERADMIN'
            ? 'Account is already SUPERADMIN.'
            : 'Account promoted to SUPERADMIN.',
        );
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      // Avoid printing connection strings or credentials from database errors.
      console.error(
        `Bootstrap failed${error.code ? ` (${error.code})` : ''}. Check database connectivity and applied migrations.`,
      );
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }
}
