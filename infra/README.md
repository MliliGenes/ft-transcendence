# Game infrastructure

## Overview

This directory groups the gateway build/routing declarations and the shared
PostgreSQL initialization hook used by the Game stack. Service topology lives
in the root Compose file. Other applications' implementations are outside this
Game documentation scope.

## Subdirectories & Boundaries

[postgres](./postgres/README.md) owns the initialization hook. Gateway/nginx directories contain configuration-only files linked in Interface.

## Interface

- [postgres](./postgres/README.md) creates missing configured Game database
  resources and grants access during fresh PostgreSQL initialization.
- [gateway/Dockerfile](./gateway/Dockerfile) builds static gateway assets from
  the repository root, including Arena under `/play/`, with `VITE_API_URL=/api`.
- [nginx/nginx.conf](./nginx/nginx.conf) routes Game HTTP prefixes and Socket.IO
  while retaining static SPA fallbacks. These configuration-only directories
  are linked directly to their files.
- [docker-compose.yml](../docker-compose.yml) declares networks, services,
  published ports, volumes and per-service environment values.
- The [Game runbook](../docs/game-local-run.md) explains local deployment.

## Invariants

- Only Nginx publishes ports 80/443 in the current Compose topology.
- Game joins the application and Judge networks. The worker only joins
  `judge-internal`, has no published port and alone mounts the Docker socket;
  Nginx does not expose a Judge upstream.
- Game API and Socket.IO routes must reach their upstream rather than being
  interpreted as successful static SPA responses.
- Gateway-local health responses do not prove downstream readiness. Game's
  `/health` is liveness; `/ready` additionally requires an available runtime.
- PostgreSQL initialization runs for a fresh data directory. It preserves
  existing role credentials and database ownership on reuse.

## Side Effects

- Gateway image building installs dependencies and compiles static assets.
- Nginx forwards HTTP/socket traffic and writes request logs whose format omits
  query strings; its routing configuration is not a gameplay verifier.
- Starting Compose can build images and create services, networks and volumes.
  Database initialization can create roles/databases and grant privileges.

## Verification

The non-executing SQL-hook syntax check is `sh -n infra/postgres/init-db.sh`.
The configured repository check is `npm run check:repository` from the root.
Neither establishes Nginx/Compose runtime behavior.

Use the [manual guide](../docs/manual-game-testing.md) for separately prepared
runtime verification and disposable database fixtures. Preserve existing data
and certificates; do not start infrastructure solely to validate these docs.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. Gateway/Nginx/Compose
configuration was sampled within scout bounds; the SQL hook was read completely.
No Compose, Nginx, certificate or database operation was executed for this pass.
