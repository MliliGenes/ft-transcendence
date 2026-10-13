import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const databaseUrl = new URL('postgresql://localhost');
databaseUrl.hostname = env('POSTGRES_HOST');
databaseUrl.port = env('POSTGRES_PORT');
databaseUrl.username = env('POSTGRES_USER');
databaseUrl.password = env('POSTGRES_PASSWORD');
databaseUrl.pathname = `/${encodeURIComponent(env('POSTGRES_DB'))}`;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl.toString(),
  },
});
