# Local microservices setup plan

> **Historical upstream plan — not the current setup guide.** This imported
> document describes an earlier layout with `compose.yaml`, `envs/`, `volumes/`
> and `COMPOSE.md`. Aimane uses root `docker-compose.yml`, `.env`, named
> database volumes and `infra/nginx/`. Use the current [README](../README.md)
> and [local runbook](../docs/game-local-run.md). Keep existing accounts and
> volumes; the migration/reset notes below are historical instructions.

Original status: initial scaffold and environment-based superadmin bootstrap
were implemented in the upstream repository. The checklist below records that
checkpoint and does not describe current Aimane completion.

## Goal

Run the first service and its database through a root `compose.yaml`. Adding a finished service later should require its Dockerfile, environment files, Compose entries, and database storage directory. Target local use; skip API keys and advanced recovery machinery for now.

## Directory structure

```text
ft-transcendence/
├── compose.yaml
├── envs/
│   ├── user-service.env
│   ├── user-service.env.example
│   ├── user-db.env
│   └── user-db.env.example
├── volumes/
│   └── user-db/
├── user-service/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── prisma/
│   └── src/
└── future-service/
```

- Use one environment file per container. Compose loads it through that service's `env_file`.
- Application settings are copied from the current `.env` into `envs/user-service.env`; database initialization settings are in `envs/user-db.env`. The original `.env` remains for commands outside Docker; the copies are independent.
- Keep matching database credentials in sync between the two files.
- Commit placeholder `.env.example` files; ignore real environment files and database contents in Git.
- Use `volumes/user-db/` as a bind-mounted persistent database directory. Choose the container mount path for the selected Postgres version.
- A root `.env` is optional and only needed for Compose variable substitution; it does not automatically populate container environments.

## Compose configuration

- One shared bridge network for Nginx, the frontend, and backend infrastructure.
- Each microservice owns a separate Postgres container and storage directory. No direct access to another service's database.
- Use the official Postgres image directly; no custom database Dockerfile is required.
- Configure database initialization with `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. These initialize empty storage, not existing databases. The official image's initial user has database superuser privileges; this is separate from the application superadmin.
- Add a Postgres health check and make user-service depend on the database being healthy.
- User-service connects to `user-db:5432`, not `localhost` or a published host port.
- Publish only Nginx HTTPS and the frontend port. Assume HTTPS means `443` (confirm the earlier `433`); frontend port remains undecided. Do not publish backend or database ports.

## Application startup

Migration history is consolidated into `prisma/migrations/20261009000000_init/migration.sql`, including the custom OAuth ownership check. Use a fresh database for this new history; existing temporary databases using the old migrations must be reset separately. Future schema changes receive new migrations.

1. Build the service image: install dependencies once, generate Prisma Client, and compile the app.
2. At container startup, run `prisma migrate deploy` after Postgres becomes healthy.
3. Run `npm run bootstrap:superadmin:env` using `SUPERADMIN_USERNAME`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD`. Create only when no superadmin exists; preserve existing superadmins and passwords. Fail on invalid settings or a collision with an existing regular account.
4. Start the server with `exec node dist/main.js`.

Stop startup if migrations or any required bootstrap step fails. Do not infer schema readiness from the existence of a volume. Database creation belongs to Postgres initialization; application tables belong to Prisma migrations.

## Implementation checklist

- [x] Resolve superadmin setup. The scaffold currently uses image rebuilds rather than development reload.
- [x] Create root `envs/`, `volumes/`, example files, and Git ignore rules.
- [x] Create root Compose entries for user-service and user-db, including network, persistent storage, and database health check.
- [x] Chain migrations, bootstrap, and server startup in the Docker CMD; copy startup scripts into the image.
- [ ] Verify startup with empty storage, migrations, and the agreed superadmin behavior.
- [ ] Restart and rebuild; verify that data and existing account credentials remain unchanged.
- [ ] Verify that a migration failure prevents server startup and that database/backend ports are not published.

## Adding another service later

Add its service directory, Dockerfile, environment examples and local values, Compose service/database entries, and a dedicated storage directory. Follow the same startup and health-check conventions.

RabbitMQ and notifications are deferred. Planned flow: services publish events; notification-service consumes its queue and forwards notifications over WebSockets. Other services may maintain local user projections and use REST for missing data. A future reconciliation job may refresh those projections through APIs without accessing another service's database.
