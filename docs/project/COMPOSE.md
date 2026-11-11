# Local Compose setup

Run commands from the `ft-transcendence/` root.

```text
compose.yaml
envs/
  README.md                # placeholder rules and configuration ownership
  backend.env.example      # runtime mode shared by backend services
  user-db.env.example      # User database credentials
  chat-db.env.example      # Chat database credentials
  game-db.env.example      # Game database credentials
  rabbitmq.env.example     # broker credentials shared with both backends
  minio.env.example        # storage admin credentials and browser origins
  user-service.env.example # internal addresses, SMTP, initial app admin
  user-auth.env.example    # JWT keys, frontend origin, OAuth settings
  chat-service.env.example # internal addresses, public JWT key, attachment storage
  game-service.env.example # Game DB URL, public JWT key, judge worker settings
  judge-worker.env.example # shared judge token and execution limits
  *.env                    # configured local copies, ignored by Git
volumes/
  user-db/                # persistent Postgres data, ignored by Git
  game-db/                # persistent Postgres data, ignored by Git
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

Each container receives only its own settings and the shared configuration files it needs. `backend.env` holds runtime settings such as `NODE_ENV` for User, Chat and Game services. Database credentials are defined in the matching `*-db.env` file; the Game credentials must also match the Game service's `DATABASE_URL`. RabbitMQ credentials are shared by RabbitMQ and the User and Chat services. User-service signing keys and OAuth settings live in `user-auth.env`; required SMTP settings live in `user-service.env`. Game and judge-worker settings live in separate files, and the shared judge token must match in both. Internal service hostnames and ports refer to Compose service names.

On a fresh clone, copy each `envs/*.env.example` to the same name without `.example`, preserving existing local files. Every assignment uses `VAR_NAME=<EXAMPLE_VALUE>`: remove the brackets around concrete examples and replace descriptive placeholders with your own values. Do not run with unresolved placeholders or source templates as shell scripts. See [envs/README.md](../../envs/README.md) for setup order, file ownership, and quoting rules.

Set shared runtime settings in `backend.env`, database credentials in their `*-db.env` files, and RabbitMQ credentials in `rabbitmq.env`. Configure SMTP in `user-service.env`; all four SMTP settings are required at startup. Run `node scripts/generate-jwt-keys.mjs` from `user-service/`, put the key pair in `user-auth.env`, and copy only the matching public key into `chat-service.env` and `game-service.env`. The User service alone receives the private signing key. Match the Game `DATABASE_URL` to `game-db.env` and use the same generated judge token in both Game and worker environment files. Provision the attachment bucket and dedicated storage credentials documented in the MinIO templates.

```sh
docker compose config --quiet
docker compose up --build -d
docker compose logs -f user-service
```

Postgres initializes fresh storage, then its health checks allow the owning services to start. The User service's Dockerfile generates Prisma Client and compiles during build; at runtime it applies migrations and bootstraps the initial superadmin. Game initializes its owned schema before reporting ready. A failed migration or bootstrap prevents the corresponding API from starting.

Set `SUPERADMIN_USERNAME`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD` in `envs/user-service.env` before the first startup. The username must be 3–30 characters and the password 8–32 characters (at most 72 UTF-8 bytes). Use a valid email. Passwords are bcrypt-hashed with cost 12. Keep these settings in the ignored local env file, never in the Docker image or committed examples. Single-quote values containing `$` to prevent Compose interpolation.

The bootstrap runs after migrations on every service start, but creates an account only when no superadmin exists. Existing superadmins and their credentials remain unchanged, even if the env settings change. It does not automatically promote a regular account with a matching username or email: that conflict stops startup. The manual promotion command remains available: `docker compose exec user-service npm run bootstrap:superadmin -- existing-user@example.com` (use `docker compose run --rm --no-deps user-service npm run bootstrap:superadmin -- existing-user@example.com` if the service cannot start). Changing the env password does not reset an existing account's password.

The consolidated initial migration requires a fresh database. This stack uses a new `volumes/user-db/` directory and does not reuse or reset the previous testing database.

## Monitoring

The monitoring stack (Grafana, Prometheus, Loki, Alloy, cAdvisor) starts with the app. It is defined in `compose.monitoring.yaml` and included by `compose.yaml`. Copy `envs/grafana.env.example` and `envs/monitoring.env.example` before the first start, then open https://localhost/grafana/. See [Monitoring](../services/infrastructure.md).

## Network and storage

- User, Chat, Game and application databases use the default Compose bridge network. The judge worker shares a separate internal network with Game; evaluation containers have no network access. Containers address services by Compose service name.
- Open the app at `https://localhost`. Nginx publishes local port 443 and routes `/api/` to User, `/api/chat/` to Chat, `/api/game/` and `/api/game/socket.io/` to Game, and other paths to the frontend. Backend and database ports remain private. Use the HTTPS origin for OAuth.
- Postgres 18 mounts `volumes/user-db/` at `/var/lib/postgresql`; its actual database lives below that path. The initial image login is a Postgres superuser, separate from the application's superadmin.
- `docker compose down` stops/removes containers but preserves this bind-mounted database directory. Do not delete its contents unless deliberately discarding local data.
- Source changes require another `docker compose up --build -d`. Hot reload is not configured.

## Plug in another service

1. Add its directory and Dockerfile at the root.
2. Add its own application and database env files under `envs/`, with committed placeholder examples.
3. Add `volumes/<service>-db/.gitkeep` and a dedicated database bind mount.
4. Copy the service/database pair in `compose.yaml`, updating names, build context, env paths, and storage path. Set its database host to its own Compose database service name.
5. Keep migrations in the owning service's startup command and wait for its database health check. Publish no backend/database ports.

The existing RabbitMQ service carries User events to Chat. A separate notification service can be added under `services:` when ready. For another browser-facing API, add its upstream and a distinct location to `nginx/default.conf`, then rebuild Nginx. Keep existing paths stable so OAuth callback registrations do not change again.

## Frontend

The `client` container builds and serves the Next.js app; Nginx routes non-API paths to it. Browser code calls User through `/api/`, Chat through `/api/chat/`, and Game through `/api/game/` plus `/api/game/socket.io/` on the same HTTPS origin, never through internal Docker hostnames. It needs no project-specific env file; the old `VITE_API_URL` and `API_PROXY_TARGET` settings are unused. Source changes require `docker compose up --build -d client`. Never put secrets in `NEXT_PUBLIC_` variables; they are exposed to the browser.

The previous Vite test frontend (`auth-profile-web`) was removed; its notes are in [docs/archive/auth-profile-web.md](../services/client.md).

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
