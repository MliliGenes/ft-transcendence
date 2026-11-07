# Local MinIO

Copy `envs/minio.env.example` to `envs/minio.env` if missing and set a strong password.
From the repository root, run `docker compose up -d --build` to start MinIO and its HTTPS proxy.

- Console: http://localhost:9001 (credentials in `envs/minio.env`).
- S3 API from the browser: https://localhost:9443 through Nginx TLS.
- S3 API from other Compose services: http://minio:9000.
- Port `9000` is not published to the host; browser clients must use the HTTPS proxy.
- Persistent data: `volumes/minio`.

The [upstream community repository](https://github.com/minio/minio) is archived
and no longer maintained. This Dockerfile builds a pinned upstream commit because
the official container images checked during setup were unavailable. The first
build downloads Go dependencies and compiles the server. Reassess maintenance
before using this service in production.
