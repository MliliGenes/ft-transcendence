# Local MinIO

Copy `envs/minio.env.example` to `envs/minio.env` if missing and set a strong password.
From the repository root, run `docker compose up -d --build minio`.

- Console: http://localhost:9001 (credentials in `envs/minio.env`).
- S3 API from the host: http://localhost:9000.
- S3 API from other Compose services: http://minio:9000.
- Persistent data: `volumes/minio`.

The [upstream community repository](https://github.com/minio/minio) is archived
and no longer maintained. This Dockerfile builds a pinned upstream commit because
the official container images checked during setup were unavailable. The first
build downloads Go dependencies and compiles the server. Reassess maintenance
before using this service in production.
