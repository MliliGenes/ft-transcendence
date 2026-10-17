# Chat development checkpoints

For the current authenticated/database setup, follow checkpoint 3 below.
Earlier checkpoints explain the smaller steps that led here.

## 1. Service health endpoint

This checkpoint replaces the NestJS greeting with `GET /health`.

Response (HTTP 200):

```json
{
  "service": "chat-service",
  "status": "ok"
}
```

This is a public liveness endpoint: it confirms the application can answer an
HTTP request. It does not check database connectivity, authentication, the user
service, or readiness to handle messages. It returns no credentials or user data.
Docker and Nginx routing are not connected in this checkpoint.

### Follow the request

1. `src/main.ts` starts NestJS and loads `AppModule`.
2. `src/app.module.ts` registers the controller and service.
3. `@Controller('health')` selects the `/health` path.
4. `@Get()` sends GET requests to the controller's `getHealth()` function.
5. The controller calls `AppService.getHealth()` and NestJS sends its object as JSON.

`constructor(private readonly appService: AppService)` asks NestJS to supply
an AppService instance. `private` keeps that reference inside the controller;
`readonly` prevents replacing the reference. `@Injectable()` lets NestJS manage
the service. `.js` import endings follow this project's TypeScript/ESM setup.

### Run locally

From the `chat-service` directory, using the project's Node.js environment:

```sh
npm ci
PORT=3001 npm run start:dev
```

Open `http://localhost:3001/health`. Port 3001 avoids the user service's default
port 3000; this is a direct local check, not a production HTTPS route.

### Check before committing

```sh
npm run lint
npm test
npm run test:e2e
npm run build
```

The HTTP test checks the actual route, status, JSON content type, and response.
The existing controller test has been updated for the new response.

Verification: lint and build passed; the controller test and HTTP test both
passed (two tests total).

Next learning checkpoint: establish the trusted identity contract before adding
protected chat operations. Database, authentication, Socket.IO, and deployment
integration remain separate work.

## 2. Predictable startup and shutdown

Chat now uses port **3001** by default, rather than the user service's default
3000. An explicit `PORT` setting overrides it. This chooses the chat process's
listening port; it does not reserve the port or configure Docker/Nginx.

### New words

- **Environment variable:** a setting passed to a running program from outside
  its code. `PORT=4000 npm run start:dev` passes `4000` to this program.
- **`process.env.PORT`:** Node.js reads that setting as text, or `undefined`
  when it is not set. This checkpoint does not load a `.env` file automatically.
- **`getPort(value: string | undefined): number`:** a function accepting text
  or an absent value, and returning a number. This is like a small C++ helper
  with a declared parameter and return type.
- **`Number(value)`:** converts the setting's text into a JavaScript number.
- **`/^[0-9]+$/.test(value)`:** checks that the entire text contains only digits.
  It rejects values such as `3001abc`, `1e3`, and an empty string.
- **`throw new Error(...)`:** reports a configuration error and stops startup.
  The allowed port range is 1 through 65535; zero is deliberately excluded so
  this service does not accidentally start on an unpredictable assigned port.
- **Shutdown signal:** an operating-system message asking a program to stop.
  Ctrl+C sends SIGINT in WSL; Docker normally sends SIGTERM.
- **`app.enableShutdownHooks()`:** enables NestJS's normal shutdown handling,
  including closing the HTTP server. There are no database or socket resources
  to clean up in this checkpoint. This is not yet a tested deployment drain policy.

### Try it in WSL

From `chat-service`, run one example at a time. Stop the first with Ctrl+C
before starting another:

```sh
npm run start:dev
# Open http://localhost:3001/health

PORT=4000 npm run start:dev
# Open http://localhost:4000/health

PORT=hello npm run start
# Startup fails with: PORT must be a whole number from 1 to 65535.
```

### What changed

- `src/port.ts`: reads and validates a supplied port value.
- `src/main.ts`: validates the setting before creating the application, enables
  shutdown handling, and listens on the resulting number.
- `src/port.spec.ts`: checks the default, valid overrides, and invalid settings.
  `it.each` runs the same test once for every value in its list.

No packages were added. Authentication and message storage remain future work.

Verification for checkpoint 2: lint and build passed; 14 unit cases and the
existing HTTP test passed (15 total). A temporary built-server check also
verified rejection of `PORT=hello`, `/health` on an explicitly chosen available
port, and process/port closure after SIGTERM. The temporary server was stopped.

## 3. Authentication and the private-message database

### What now works

1. The application opens a connection to its own PostgreSQL database at startup.
2. `GET /health` remains public and returns the original liveness response.
3. Other routes require the existing User service access token. `GET /session`
   returns `{ "userId": "<the signed user UUID>" }` for a valid token, or HTTP 401
   for missing/invalid credentials. The response uses `Cache-Control: no-store`.
4. The initial migration creates the three DM tables and their constraints.

There are no send/history endpoints or live sockets yet. This checkpoint checks
cryptographic identity, not current account existence, blocks, or session revocation.
The real User-service login/refresh flow and gateway route have not been exercised
end to end. Those checks must be connected before private messaging is enabled.

### Definitions, connected to your C++ knowledge

- **Access token / JWT:** a signed text credential supplied after login. Its
  `sub` field is the user ID and its `exp` field is the expiry time. Decoding
  its text is not sufficient: Chat must verify its signature and claims.
- **Public/private key pair:** User service keeps the private key to sign
  credentials. Chat receives only the public key so it can check signatures.
  This resembles checking a seal; Chat cannot issue new valid credentials.
- **Guard:** a function NestJS runs before a controller. The global guard
  protects routes by default. Only an explicit `@Public()` skips that check.
- **Issuer and audience:** who issued the token and which application it is
  intended for. These match the existing User service: `user-service` and
  `ft-transcendence-api`. Only RSA/RS256 tokens are accepted.
- **Database table:** a collection of records with defined fields; think of
  many stored objects sharing a struct layout, with database rules attached.
- **Prisma:** the library that gives TypeScript code a typed way to query
  PostgreSQL. `DatabaseService` manages that connection.
- **Schema:** the declaration of tables and their fields in `schema.prisma`.
- **Migration:** a versioned SQL file that creates/changes database structure.
  Commit it so teammates can reproduce the same structure.
- **Constraint:** a rule enforced by PostgreSQL itself, even if application
  code makes a mistake. For example: one DM per pair, and no self-DMs.
- **Foreign key:** a reference to another stored record that the database
  checks exists. This does not replace permission checks.

### Files to read in this order

1. `src/auth/session.controller.ts`: a small protected endpoint returning the
   identity already verified by the guard.
2. `src/auth/access-token.guard.ts`: reads the Bearer header, verifies the
   credential, validates its claims, and puts the signed identity on the request.
3. `src/auth/auth.module.ts`: supplies the verification library with its trusted
   key and registers the guard for the application.
4. `src/auth/verification-key.ts`: rejects invalid, private, non-RSA, and weak keys.
5. `prisma/schema.prisma`: the three tables, relations, indexes, and fields.
6. `src/database/database.service.ts`: opens/closes the database connection.
7. `src/app.module.ts`: registers the configuration, authentication, and database.

### Run locally in WSL

From `chat-service`:

```sh
npm ci
cp .env.example .env
```

Edit `.env` locally. Set two different local database passwords and put the Chat
password into `DATABASE_URL` (URL-encode special characters). Copy only the
existing User service **public** key into `JWT_PUBLIC_KEY`; escaped `\n` line
breaks are supported. Never copy its private signing key. `.env` is Git-ignored.
The example placeholders are not working credentials.

The database helper uses localhost port 5433. If it is occupied, set `CHAT_DB_PORT` in `.env` to another port and update
`DATABASE_URL` to match. It creates a separate PostgreSQL
instance and a normal `nook_chat` role; the application never uses the admin role.
Initialization runs only for an empty data volume. Later password changes require
an intentional database-role update; editing `.env` alone does not change it.

```sh
docker compose -f compose.database.yaml up -d --wait
npm run prisma:migrate
npm run build
npm run start:dev
```

Open `http://localhost:3001/health`. A direct `/session` request without a token
should return 401. To check a real user token in an HTTP client, send it only in
`Authorization: Bearer <accessToken>`. Do not put tokens in URLs, commits, or logs.
Chat does not need or receive refresh tokens. There is no second login screen.
The standalone local HTTP setup is for development; shared HTTPS gateway wiring
is a later integration step.

### Verify before committing

```sh
npm run prisma:validate
npm run lint
npm test
npm run test:e2e
docker pull postgres:18-alpine
npm run test:postgres
npm run build
```

The HTTP tests use real RSA signatures with ephemeral test keys. They substitute
the database provider; the separate PostgreSQL test checks real migrations and
also runs the built application against a real temporary database.

Next: the authenticated User-service contract, conversation creation, and
send/history endpoints. Private-message access must check both membership and
current block/account state before reads, writes, or subscriptions are enabled.

Verification for checkpoint 3: schema validation, generation, build, and lint
passed. There are 19 passing unit cases, 16 passing HTTP authentication cases,
and 5 passing PostgreSQL integration subtests (plus the parent test). The latter
includes real built-server startup, signed-session verification, bad-database-
credential startup rejection, and shutdown. Temporary servers/containers were
removed. These use test keys, not a real User-service login.

Prisma packages are pinned together to 7.10.1, a compatible patch of the team's
7.10 tooling. `npm audit --omit=dev` reported zero advisories at verification.
Full audit still reports 5 entries under the inherited development dependency
`@nestjs/mau` (deployment tooling). That separate deployment path has not been
reviewed or repaired here; this checkpoint uses the documented local commands.

## Debugging follow-up

- Malformed PEM keys now produce a clear `JWT_PUBLIC_KEY` configuration error
  instead of a raw OpenSSL decoder stack. A regression test covers malformed
  content inside otherwise correct BEGIN/END markers.
- Prisma generation and compilation do not need database credentials. Migrations
  still require an explicit database URL, and the running server still requires
  its database and verification key. There is no fallback database or bypass.
- `npm run test:e2e` generates its Prisma client automatically, including on a
  fresh checkout where generated files have not been created yet.
- The local Compose health check uses TCP, avoiding a healthy result from
  PostgreSQL's temporary Unix-socket-only initialization server. Optional
  `CHAT_DB_PORT` changes the published local port (default 5433).
- `.env.example` contains placeholders again. Actual local `.env` is untouched.

Verification: lint, 20 unit cases, 16 HTTP cases, and all PostgreSQL integration
checks passed. The actual Compose initialization was separately checked in an
isolated temporary project and cleaned up. Schema validation and build were also
checked with database/JWT configuration removed; migrations correctly failed
without database configuration. No real user data was modified.
