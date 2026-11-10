# Environment configuration

The root Compose stack loads local `*.env` files from this directory.
Commit only the `*.env.example` templates. Local files contain credentials
and are ignored by Git.

## Placeholder convention

Every example assignment uses `VAR_NAME=<EXAMPLE_VALUE>`:

- For a concrete example such as `PORT=<3000>`, remove the angle brackets
  to get `PORT=3000`.
- For a descriptive placeholder such as
  `SMTP_PASSWORD=<SMTP_PROVIDER_PASSWORD_OR_APP_PASSWORD>`, replace the
  entire value, including its brackets, with your own credential.
- Never start services with unresolved placeholders. These templates are
  documentation, not valid runtime configuration.
- Do not execute or source example files as shell scripts; unquoted angle
  brackets have shell meanings.
- In local files, single-quote values containing `$` or `#` so Compose
  does not interpolate or truncate secrets.
- For RSA keys, use the complete PEM contents with literal `\n` separators,
  wrapped in single quotes. Both services convert these separators to newlines.
- For an unused OAuth provider, leave its client ID and client secret empty
  or omit them. Do not leave example placeholder text as provider credentials.

## File ownership

| Local file | Loaded by | Contents |
| --- | --- | --- |
| `backend.env` | User and Chat services | Shared runtime mode |
| `user-db.env` | User database and User service | User database credentials/name |
| `chat-db.env` | Chat database and Chat service | Chat database credentials/name |
| `rabbitmq.env` | RabbitMQ and both backend services | Shared broker credentials |
| `minio.env` | MinIO only | Storage admin credentials and browser CORS origins |
| `user-service.env` | User service only | Internal addresses, SMTP, initial app admin |
| `user-auth.env` | User service only | RSA key pair, frontend origin, OAuth |
| `chat-service.env` | Chat service only | Internal addresses, public RSA key, storage settings |

Compose loads these files in the order declared under each service's
`env_file`. Later files override earlier values with the same name.
Define database and broker credentials only in their shared files.

The Next.js client currently needs no project-specific env file: browser
requests use `/api/` and `/api/chat/` on the current origin. The obsolete
`client.example` Vite settings are no longer used.

## Configure a fresh clone

1. Copy each `*.env.example` in this directory to the same filename without
   `.example`, but keep any existing local `*.env` files.
2. Replace every `<...>` placeholder. Comments describe required values,
   local Compose examples, and settings shared with another service.
3. Generate the RSA pair from `user-service/` using
   `node scripts/generate-jwt-keys.mjs`. Put both keys in `user-auth.env`;
   copy only the matching public key into `chat-service.env`.
4. Configure SMTP, `AUTH_FRONTEND_URL`, and the initial superadmin.
   SMTP is required even when OAuth is disabled. Superadmin settings do not
   reset an account that already exists.
5. Configure any OAuth providers you want to use. Their callback registrations
   must agree with the public URLs in `user-auth.env`, including HTTPS
   and the `/api` prefix for Compose.
6. Provision the private attachment bucket and a restricted MinIO service account.
   Use that account in `chat-service.env`; keep MinIO root credentials separate.
7. From the repository root, run `docker compose config --quiet` and then
   `docker compose up --build -d`. The config check validates Compose syntax
   and file references; it does not prove that credentials or endpoints work.

## Internal and public addresses

Compose applications use Docker service names such as `user-db`, `chat-db`,
`rabbitmq`, and `minio`. Browser URLs use the public Nginx address.

The local application origin is `https://localhost`. Browser attachment
requests use `https://localhost:9443`; internal storage requests use
`http://minio:9000`. Keep the internal and public storage settings distinct.
The browser must trust the local HTTPS certificate. The storage proxy is
bound to loopback; remote clients require a reachable TLS endpoint and
a matching CORS origin.

Changing database/broker environment credentials does not rotate credentials
already stored in their persistent volumes. Do not delete data just to apply
an example file.

For standalone User-service development, use
[`user-service/.env.example`](../user-service/.env.example). It includes all
settings in one local file and uses host addresses instead of Compose DNS.
See [Infrastructure](../docs/services/infrastructure.md) for the full deployment workflow.
