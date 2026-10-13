# Local Compose setup

Run commands from the `ft-transcendence/` root.

```text
compose.yaml
envs/
  user-db.env.example
  user-db.env             # local, ignored by Git
  user-service.env.example
  user-service.env        # local, ignored by Git
  auth-profile-web.env.example
  auth-profile-web.env    # local, ignored by Git
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
auth-profile-web/
  Dockerfile
```

## First startup

Backend env files have been populated from the existing user-service `.env` on this machine. The original file remains for commands run outside Docker. Future changes to these copies are independent. The test frontend has its own `envs/auth-profile-web.env`.

On a fresh clone, copy each `envs/*.env.example` to the same name without `.example`. Set matching database credentials in both files, and supply the existing authentication system's RSA key pair in `user-service.env`. Run `node scripts/generate-jwt-keys.mjs` from `user-service/` to generate keys, then paste the PEM contents into `envs/user-service.env`. Update browser-facing URLs when wiring Nginx and the frontend.

```sh
docker compose config --quiet
docker compose up --build -d
docker compose logs -f user-service
```

Postgres initializes fresh storage, then its health check allows user-service to start. The service's Dockerfile generates Prisma Client and compiles during build. At runtime it applies migrations, bootstraps the initial superadmin, then starts Node. A failed migration or bootstrap prevents the API from starting.

Set `SUPERADMIN_USERNAME`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD` in `envs/user-service.env` before the first startup. The username must be 3–30 characters and the password 8–32 characters (at most 72 UTF-8 bytes). Use a valid email. Passwords are bcrypt-hashed with cost 12. Keep these settings in the ignored local env file, never in the Docker image or committed examples. Single-quote values containing `$` to prevent Compose interpolation.

The bootstrap runs after migrations on every service start, but creates an account only when no superadmin exists. Existing superadmins and their credentials remain unchanged, even if the env settings change. It does not automatically promote a regular account with a matching username or email: that conflict stops startup. The manual promotion command remains available: `docker compose exec user-service npm run bootstrap:superadmin -- existing-user@example.com` (use `docker compose run --rm --no-deps user-service npm run bootstrap:superadmin -- existing-user@example.com` if the service cannot start). Changing the env password does not reset an existing account's password.

The consolidated initial migration requires a fresh database. This stack uses a new `volumes/user-db/` directory and does not reuse or reset the previous testing database.

## Network and storage

- All services use the default shared bridge network. Containers address the API at `user-service:3000` and its database at `user-db:5432`.
- Open the app at `https://localhost`. Nginx publishes local port 443 and routes `/api/` to user-service, stripping that prefix, and other paths to the frontend. Backend and database ports remain private. The frontend's direct `http://localhost:5173` port remains available for debugging; use the HTTPS origin for OAuth.
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

## Test frontend

The frontend container runs the Vite development server for local testing. `VITE_API_URL=/api` stays unchanged: on `https://localhost`, Nginx forwards these requests directly to user-service. On the direct frontend debug port, Vite's existing proxy still handles them. The internal Docker hostname is never used as the browser's API address. Nginx also forwards WebSocket upgrades for Vite.

Frontend source changes require an image rebuild; no source bind mount is configured. After changing its env file, run `docker compose up -d auth-profile-web` to recreate the container. Keep secrets out of `VITE_` variables because they are exposed to the browser.

## Local HTTPS and OAuth

The Nginx entrypoint generates a self-signed certificate for `localhost` and `127.0.0.1` only when both certificate files are absent. It retains them under `volumes/nginx/certs/`, checks the config with `nginx -t`, then starts Nginx. Your browser will show a certificate warning until you accept or trust this local certificate. No system trust settings are changed automatically. Port 80 is not published; type `https://localhost` explicitly.

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
