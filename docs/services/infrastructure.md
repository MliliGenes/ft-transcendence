# Infrastructure

Docker Compose runs everything. This covers startup, environment files, the Nginx gateway, PostgreSQL, RabbitMQ, MinIO and monitoring. Run commands from the repository root.

## Services

| Service | Role | Reachable from the host |
| --- | --- | --- |
| `nginx` | TLS gateway | `443`, and `127.0.0.1:9443` for MinIO S3 |
| `client` | Next.js app | Through Nginx |
| `user-service`, `chat-service` | NestJS APIs | Through Nginx |
| `user-db`, `chat-db` | PostgreSQL 18, one per service | No |
| `user-db-backup`, `chat-db-backup` | Scheduled PostgreSQL dumps with retention | No |
| `backup-storage-init` | One-shot backup-volume permissions setup | No |
| `rabbitmq` | Broker | `127.0.0.1:5672`, management UI `127.0.0.1:15672` |
| `minio` | Object storage | Console `127.0.0.1:9001` |
| `minio-init` | One-shot bucket and user setup | No |
| `grafana` | Dashboards | `https://localhost/grafana/` |
| `prometheus`, `loki`, `alloy`, `cadvisor`, `docker-socket-proxy` | Monitoring internals | No |

## Running the stack

### First startup

1. Copy each `envs/*.env.example` to the same name without `.example`. Keep existing local files.
2. Replace every `<...>` placeholder, removing the brackets. Do not source these files as shell scripts. See `envs/README.md` for ownership and quoting rules.
3. Run `node scripts/generate-jwt-keys.mjs` in `user-service/`. Put the pair in `envs/user-auth.env` and only the public key in `envs/chat-service.env`.
4. Set SMTP and the initial superadmin in `envs/user-service.env`.
5. Start it:

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Open `https://localhost` and accept the local certificate. Source changes need `docker compose up --build -d <service>`, because hot reload is not configured.

### Environment files

| File | Holds |
| --- | --- |
| `backend.env` | Runtime mode for both backends |
| `user-db.env`, `chat-db.env` | Database credentials, loaded by the database, its service, and its backup container |
| `rabbitmq.env` | Broker credentials, loaded by the broker and both backends |
| `minio.env` | MinIO root account and CORS origins |
| `user-service.env` | Internal addresses, SMTP, initial superadmin |
| `user-auth.env` | JWT keys, frontend origin, OAuth |
| `chat-service.env` | Internal addresses, public JWT key, storage credentials |
| `grafana.env`, `monitoring.env` | Monitoring credentials |

### Superadmin bootstrap

After migrations, user-service creates the superadmin from env values only when none exists. Changing the env later does not alter an existing account. A regular account with the same username or email stops startup. To promote someone manually:

```sh
docker compose exec user-service npm run bootstrap:superadmin -- user@example.com
```

### Data

Database, MinIO and RabbitMQ data live under `volumes/`, and `docker compose down` keeps them. Monitoring and database backups use named volumes, which `docker compose down -v` deletes. Use `docker compose down` without `-v` to preserve backups.

## Database backups

The root stack includes one `prodrigestivill/postgres-backup-local:18-alpine`
container for each database, matching PostgreSQL 18. Each reads its database's
existing env file; no additional credentials are needed. The containers wait for
database health and volume initialization, then run as `postgres:postgres`.
They have no published ports. The initializer only sets ownership and mode `0700`
on the two backup volume roots, and exits.

### Schedule and storage

- A backup runs at container startup and daily at midnight in `Africa/Casablanca`.
- Retention settings are 7 days, 4 weeks, and 6 months. The `last` directory also
  retains timestamped backups for the image's default 24-hour window.
- Dumps include all schemas, data, and large objects. They omit ownership and ACL
  commands for portable restores. Cluster roles/passwords and server configuration
  are not included; provision those separately from the deployment configuration.
- `user-db-backups` and `chat-db-backups` are separate Docker named volumes
  (normally `nook_user-db-backups` and `nook_chat-db-backups`). Inside each backup
  container, `/backups` contains `last`, `daily`, `weekly`, and `monthly` folders.
- Rotation uses hardlinks and symlinks. Docker-managed storage avoids the Windows
  bind-mount filesystem limitations described in the
  [upstream documentation](https://github.com/prodrigestivill/docker-postgres-backup-local#how-the-backups-folder-works).

Daily/weekly/monthly entries retain the latest successful backup for each period;
retention is age-based, not an exact count of files. Each database dump has its own
consistent snapshot; the two services are not backed up in one shared transaction.
Settings live in the `x-db-backup-environment` section of `compose.yaml`.

### Start and inspect

Normal `docker compose up -d` starts backups with the stack. To start just these
services and their dependencies:

```sh
docker compose up -d user-db-backup chat-db-backup
docker compose ps -a backup-storage-init user-db-backup chat-db-backup
docker compose logs --tail=100 user-db-backup chat-db-backup
docker compose exec user-db-backup ls -lh /backups/last
docker compose exec chat-db-backup ls -lh /backups/last
```

Look for successful backup completion in the logs and a timestamped `.sql.gz`
file for each database. The inherited image health check probes the scheduler on
internal port 8080; it does not demonstrate that a dump can be restored.

To request a backup manually, run these when no scheduled/startup backup is in
progress (the image's backup script does not serialize concurrent runs):

```sh
docker compose exec user-db-backup /backup.sh
docker compose exec chat-db-backup /backup.sh
```

### Export a copy

Copy backups out of the Docker volumes; `-L` follows the `latest` symlinks:

```sh
docker compose cp -L user-db-backup:/backups ./volumes/user-db-backup-export
docker compose cp -L chat-db-backup:/backups ./volumes/chat-db-backup-export
```

Use fresh destination directories for subsequent exports. These paths are already
ignored by Git. Backups contain private account and chat data; restrict access
and encrypt copies sent to separate storage. A copy on the same host does not
protect against loss of that host or Docker's disk. Keep an off-host copy.
MinIO attachment/profile files and RabbitMQ state are outside these SQL backups.

### Restore into a new database

The following Bash command restores the latest User database dump into a separate
database named `nook_users_restore`. It refuses to create that database if the
name already exists, and leaves the live database untouched. Use a unique restore
database name for each drill. Run this only when the backup container is running
and a successful dump exists:

```sh
docker compose exec -T user-db-backup bash -euo pipefail -c '
export PGPASSWORD="$POSTGRES_PASSWORD"
backup_file="/backups/last/${POSTGRES_DB}-latest.sql.gz"

gzip -t "$backup_file"

createdb \
  --host="$POSTGRES_HOST" \
  --username="$POSTGRES_USER" \
  --template=template0 \
  nook_users_restore

gzip -dc "$backup_file" |
  psql \
    --host="$POSTGRES_HOST" \
    --username="$POSTGRES_USER" \
    --dbname=nook_users_restore \
    --single-transaction \
    --set=ON_ERROR_STOP=1
'
```

For Chat, replace `user-db-backup` with `chat-db-backup` and both occurrences of
`nook_users_restore` with `nook_chat_restore`. A failed restore leaves the new
database for inspection; it never drops a database automatically. To restore an
older dump, use its timestamped path instead of the `latest` symlink.

Inspect restored tables, row counts, and Prisma migration history, then exercise
the application against isolated restored databases before planning a live
recovery. Restore drills and application checks must be performed explicitly;
adding this configuration alone does not prove recovery. Recreate any extra roles
and grants separately. A live recovery also requires coordinating both services
and restoring the matching MinIO files.

## Gateway (Nginx)

| Path | Destination | Notes |
| --- | --- | --- |
| `/api/chat/socket.io/` | chat-service `/socket.io/` | Unbuffered, 65-second timeouts |
| `/api/chat/` | chat-service `/chat/` | 300 requests per minute per IP |
| `/api/` | user-service, prefix stripped | Rate limited, cookie path rewritten to `/api/auth/` |
| `/socket.io/` | chat-service | Legacy path |
| `/grafana/` | Grafana | Login required |
| `/` | client | Everything else |
| `:9443` | minio `:9000` | S3 API, 52 MB body limit, `Host` preserved |

Stricter per-IP limits apply to login (10 per minute), register (3), password reset request (3) and reset confirm (5). The main server has a 6 MB body limit.

### TLS and OAuth

The entrypoint creates a self-signed certificate for `localhost` and `127.0.0.1` when none exists, and keeps it in `volumes/nginx/certs/`. Register these OAuth callbacks with the providers:

```text
https://localhost/api/auth/discord/callback
https://localhost/api/auth/discord/link/callback
https://localhost/api/auth/github/callback
https://localhost/api/auth/github/link/callback
```

To check the gateway:

```sh
docker compose exec nginx nginx -t
node nginx/check.mjs
```

## RabbitMQ

Image `rabbitmq:4-management`, with the management and Prometheus plugins enabled in `infra/rabbitmq/enabled_plugins`. Credentials are created only on first initialization of the data directory. How it is used is in [user-chat integration](../integrations/user-chat.md).

## MinIO

Built from a pinned upstream commit in `minio/Dockerfile`, because the upstream community repository is archived. Reassess this before any production use. The S3 port is internal, and browsers go through Nginx on `:9443`. How it is used is in [chat-storage integration](../integrations/chat-storage.md).

## Monitoring

The stack starts with the app. It is defined in `compose.monitoring.yaml`, which `compose.yaml` includes. Open `https://localhost/grafana/` and use the admin account from `envs/grafana.env`.

```text
cAdvisor, RabbitMQ (:15692), PostgreSQL exporters, health probes
        | scraped every 15 s by Alloy
        v
     Alloy --remote write--> Prometheus --> Grafana
     Alloy --redacted container logs--> Loki --> Grafana
```

### Dashboards

| Dashboard | Shows |
| --- | --- |
| Overview | Service and database health, firing alerts, CPU and memory |
| Containers | CPU, memory, network, disk writes, restarts |
| Databases & Broker | PostgreSQL activity, RabbitMQ queue depth and rates |
| Logs | Searchable container logs and error rate |
| HTTP & Realtime | Probe availability, latency and status codes |

Dashboards are generated by `infra/monitoring/grafana/build-dashboards.mjs`. Edit that script, run it, then restart Grafana.

### Alerts

Rules are in `infra/monitoring/prometheus/alerts.yml` and are shown in Grafana only. Nothing is sent by email or chat.

| Alert | Fires when |
| --- | --- |
| `ServiceDown` | A health probe fails for 1 minute |
| `ContainerRestarting` | More than 3 restarts in 15 minutes |
| `ContainerHighMemory` | Over 90% of the limit, or over 1 GiB with no limit, for 5 minutes |
| `PostgresDown` | A database is unreachable for 1 minute |
| `PostgresTooManyConnections` | Over 80% of `max_connections` for 5 minutes |
| `RabbitMQQueueBacklog` | Over 100 waiting messages for 5 minutes |
| `RabbitMQUnackedHigh` | Over 50 unacknowledged messages for 5 minutes |

To demo one, run `docker compose stop chat-service`, wait about 90 seconds, then start it again.

### Security

- Only Grafana is exposed, with login required and anonymous access and sign-up off.
- Alloy reaches Docker through a read-only socket proxy on an internal network.
- The `monitoring` database login has only `pg_monitor`.
- Alloy redacts signed URL parameters, OAuth codes, tokens and cookies before storing logs. Message contents are never collected.

### Existing databases

New databases create the `monitoring` login automatically. For a database that already had data, run this once for `user-db` and again for `chat-db`:

```sh
docker compose exec user-db sh /docker-entrypoint-initdb.d/10-monitoring-role.sh
```

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Dashboard says "No data" | Wait 30 seconds, then check `docker compose logs alloy` |
| PostgreSQL panels empty | The `monitoring` login is missing or has the wrong password |
| Container panels empty | cAdvisor must be 0.54.0 or newer with the containerd image store |
| `/grafana/` returns 502 | Grafana is still starting |

## Adding a service

1. Add its directory and Dockerfile at the root.
2. Add env files under `envs/` with committed examples.
3. Add its database bind mount and Compose entries.
4. Keep migrations in its startup command and wait for its database health check.
5. For a browser-facing API, add an upstream and a location in `nginx/default.conf`.
