# Local Compose setup

Run commands from the `ft-transcendence/` root.

```text
compose.yaml
envs/
  README.md                # placeholder rules and configuration ownership
  backend.env.example      # runtime mode shared by both backend services
  user-db.env.example      # User database credentials
  chat-db.env.example      # Chat database credentials
  rabbitmq.env.example     # broker credentials shared with both backends
  minio.env.example        # storage admin credentials and browser origins
  user-service.env.example # internal addresses, SMTP, initial app admin
  user-auth.env.example    # JWT keys, frontend origin, OAuth settings
  chat-service.env.example # internal addresses, public JWT key, attachment storage
  *.env                    # configured local copies, ignored by Git
volumes/
  user-db/                # persistent Postgres data, ignored by Git
  nginx/certs/            # local TLS certificate/key, ignored by Git
nginx/
  Dockerfile
  entrypoint.sh
  default.conf
  check.mjs
user-service/
  Dockerfile
chat-service/
  Dockerfile
client/                   # Next.js frontend
  dockerfile
```

## First startup

Each container receives only its own settings and the shared configuration files it needs. `backend.env` holds runtime settings such as `NODE_ENV` for both backend services. Database credentials are defined once in the matching `*-db.env` file and loaded by both its database and application container. RabbitMQ credentials are defined once in `rabbitmq.env` and loaded by RabbitMQ and the backend services. User-service signing keys and OAuth settings live in `user-auth.env`; required SMTP settings live in `user-service.env`. Internal service hostnames and ports live in the application's own env file and refer to Compose service names.

On a fresh clone, copy each `envs/*.env.example` to the same name without `.example`, preserving existing local files. Every assignment uses `VAR_NAME=<EXAMPLE_VALUE>`: remove the brackets around concrete examples and replace descriptive placeholders with your own values. Do not run with unresolved placeholders or source templates as shell scripts. See [envs/README.md](../../envs/README.md) for setup order, file ownership, and quoting rules.

Set shared backend settings in `backend.env`, each database credential once in its `*-db.env` file, and RabbitMQ credentials once in `rabbitmq.env`. Configure SMTP in `user-service.env`; all four SMTP settings are required at startup. Run `node scripts/generate-jwt-keys.mjs` from `user-service/`, put the key pair in `user-auth.env`, and copy only the matching public key into `chat-service.env`. Provision the attachment bucket and dedicated storage credentials documented in that template.

```sh
docker compose config --quiet
docker compose up --build -d
docker compose logs -f user-service
```

Postgres initializes fresh storage, then its health check allows user-service to start. The service's Dockerfile generates Prisma Client and compiles during build. At runtime it applies migrations, bootstraps the initial superadmin, then starts Node. A failed migration or bootstrap prevents the API from starting.

Set `SUPERADMIN_USERNAME`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD` in `envs/user-service.env` before the first startup. The username must be 3–30 characters and the password 8–32 characters (at most 72 UTF-8 bytes). Use a valid email. Passwords are bcrypt-hashed with cost 12. Keep these settings in the ignored local env file, never in the Docker image or committed examples. Single-quote values containing `$` to prevent Compose interpolation.

The bootstrap runs after migrations on every service start, but creates an account only when no superadmin exists. Existing superadmins and their credentials remain unchanged, even if the env settings change. It does not automatically promote a regular account with a matching username or email: that conflict stops startup. The manual promotion command remains available: `docker compose exec user-service npm run bootstrap:superadmin -- existing-user@example.com` (use `docker compose run --rm --no-deps user-service npm run bootstrap:superadmin -- existing-user@example.com` if the service cannot start). Changing the env password does not reset an existing account's password.

The consolidated initial migration requires a fresh database. This stack uses a new `volumes/user-db/` directory and does not reuse or reset the previous testing database.

## Monitoring

The monitoring stack (Grafana, Prometheus, Loki, Alloy, cAdvisor) starts with the app. It is defined in `compose.monitoring.yaml` and included by `compose.yaml`. Copy `envs/grafana.env.example` and `envs/monitoring.env.example` before the first start, then open https://localhost/grafana/. See [Monitoring](../infra/monitoring.md).

## Network and storage

- All services use the default shared bridge network. Containers address the API at `user-service:3000` and its database at `user-db:5432`.
- Open the app at `https://localhost`. Nginx publishes local port 443 and routes `/api/` to user-service, stripping that prefix, and other paths to the frontend. Backend and database ports remain private. Use the HTTPS origin for OAuth.
- Postgres 18 mounts `volumes/user-db/` at `/var/lib/postgresql`; its actual database lives below that path. The initial image login is a Postgres superuser, separate from the application's superadmin.
- `docker compose down` stops/removes containers but preserves this bind-mounted database directory. Do not delete its contents unless deliberately discarding local data.
- Source changes require another `docker compose up --build -d`. Hot reload is not configured.

## Plug in another service

1. Add its directory and Dockerfile at the root.
2. Add its own application and database env files under `envs/`, with committed placeholder examples.
3. Add `volumes/<service>-db/.gitkeep` and a dedicated database bind mount.
4. Copy the service/database pair in `compose.yaml`, updating names, build context, env paths, and storage path. Set its database host to its own Compose database service name.
5. Keep migrations in the owning service's startup command and wait for its database health check. Publish no backend/database ports.

RabbitMQ and notifications can be added under `services:` when ready. For another browser-facing API, add its upstream and a distinct location to `nginx/default.conf`, then rebuild Nginx. Keep existing paths stable so OAuth callback registrations do not change again.

## Frontend

The `client` container builds and serves the Next.js app; Nginx routes non-API paths to it. Browser code calls user-service through `/api/` and chat-service through `/api/chat/` (plus Socket.IO) on the same HTTPS origin, never through internal Docker hostnames. It needs no project-specific env file; the old `VITE_API_URL` and `API_PROXY_TARGET` settings are unused. Source changes require `docker compose up --build -d client`. Never put secrets in `NEXT_PUBLIC_` variables; they are exposed to the browser.

The previous Vite test frontend (`auth-profile-web`) was removed; its notes are in [docs/archive/auth-profile-web.md](../archive/auth-profile-web.md).

## Local HTTPS and OAuth

The Nginx entrypoint generates a self-signed certificate for `localhost` and `127.0.0.1` only when both certificate files are absent. It retains them under `volumes/nginx/certs/`, checks the config with `nginx -t`, then starts Nginx. Your browser will show a certificate warning until you accept or trust this local certificate. No system trust settings are changed automatically. Port 80 is not published; type `https://localhost` explicitly. The same certificate secures the loopback-only MinIO S3 proxy at `https://localhost:9443`; MinIO remains HTTP-only inside Compose.

The backend Compose env uses `NODE_ENV=production` again because the public callbacks now use HTTPS, with `AUTH_FRONTEND_URL=https://localhost`. Register these URLs in the matching provider applications:

```text
https://localhost/api/auth/discord/callback
https://localhost/api/auth/discord/link/callback
https://localhost/api/auth/github/callback
https://localhost/api/auth/github/link/callback
```

Nginx preserves OAuth query parameters and rewrites cookie paths from `/auth/` to `/api/auth/`. Full provider login still requires valid credentials and matching callback registrations. Sign in afresh on the HTTPS origin; browser storage from `http://localhost:5173` is separate.

```sh
docker compose up --build -d
docker compose exec nginx nginx -t
node nginx/check.mjs
```

The check trusts only this stack's certificate and verifies frontend and API routing. Nginx currently has one user-service upstream instance. Its upstream uses Docker DNS resolution and supports multiple addresses, but scaling is not configured or tested here.
