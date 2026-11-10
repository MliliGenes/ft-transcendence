# Infrastructure

Docker Compose runs everything. This covers startup, environment files, the Nginx gateway, PostgreSQL, RabbitMQ, MinIO and monitoring. Run commands from the repository root.

## Services

| Service | Role | Reachable from the host |
| --- | --- | --- |
| `nginx` | TLS gateway | `443`, and `127.0.0.1:9443` for MinIO S3 |
| `client` | Next.js app | Through Nginx |
| `user-service`, `chat-service` | NestJS APIs | Through Nginx |
| `user-db`, `chat-db` | PostgreSQL 18, one per service | No |
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
| `user-db.env`, `chat-db.env` | Database credentials, loaded by the database and its service |
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

Database, MinIO and RabbitMQ data live under `volumes/`, and `docker compose down` keeps them. Monitoring uses named volumes, which `docker compose down -v` deletes.

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
