# User service setup

The local testing flow is:

```text
Clone branch
  -> configure root .env
  -> make -C postgres       (create database user and empty database)
  -> npm i                 (install backend dependencies)
  -> npx prisma generate   (generate the TypeScript client)
  -> npx prisma migrate deploy (create application tables)
  -> configure JWT keys
  -> npm run start:dev     (start the backend)
```

## Configure the shared environment

From `user-service`, copy `.env.example` to `.env` if the file does not exist yet.
Keep an existing `.env` so you preserve your configuration.

Every template assignment uses `VAR_NAME=<EXAMPLE_VALUE>`. Replace placeholders
and remove their angle brackets before running anything; do not source the
template as a shell script. The full Compose stack instead uses the split
templates described in [envs/README.md](../../envs/README.md).

Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. For the test container,
use `POSTGRES_HOST=127.0.0.1` and a free `POSTGRES_PORT` such as `5433`. Docker
Compose, Prisma, and NestJS all read the same root `.env`.

## Start the database and prepare the backend

Requires Docker with Compose, GNU Make, and a POSIX shell (Linux, macOS, or WSL).
Node.js/npm are needed for the backend steps after the container starts.

```sh
make -C postgres
npm i
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` applies the branch's existing migrations. To create a migration
for a new schema change during development, use
`npx prisma migrate dev --name your_change` instead.

The test database is disposable: stopping/removing its container clears its data.
Start it again and rerun `npx prisma migrate deploy` to recreate its tables. See
[postgres/README.md](postgres/README.md) for the flow diagram and Make commands.

If you prefer your locally installed Postgres, skip `make -C postgres`, create
the database yourself, and point the same `POSTGRES_*` settings at that server.

## Configure authentication and run

If you do not already have JWT keys:

```sh
node scripts/generate-jwt-keys.mjs
```

Copy the PEM contents from `.keys/jwt-private.pem` and `.keys/jwt-public.pem` into
`JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in the root `.env`. Existing keys can be
reused; generating keys is not part of resetting the database.

```sh
npm run start:dev
```

Before starting, configure the required SMTP transport and `AUTH_FRONTEND_URL`
for verification/password-reset emails, and ensure RabbitMQ is reachable with
the configured credentials. These settings are documented in `.env.example`.

The API defaults to `http://localhost:3000`. Register a test account through the
API; a fresh database contains no users. Discord and GitHub configuration is
optional until you want to test provider login; leave unused provider IDs and
secrets empty or omit them from your local file.

Endpoint examples are in [API.md](API.md). The Discord strategy walkthrough is in
[DISCORD_AUTH.md](DISCORD_AUTH.md).
