# User service guide

This NestJS/TypeScript service manages users, authentication, public profiles, profile images, friendships, and superadmin operations. PostgreSQL persists application data through Prisma. The default HTTP address is `http://localhost:3000`.

## Documentation map

| Document | Purpose |
| --- | --- |
| [API.md](API.md) | Authentication, accounts, OAuth, superadmin examples, and additional routes below |
| [openapi.json](openapi.json) | Importable HTTP specification covering all 44 controller operations |
| [SETUP.md](SETUP.md) | Database and local backend setup |
| [DISCORD_AUTH.md](DISCORD_AUTH.md) | Discord strategy implementation walkthrough |
| [test/README.md](test/README.md) | PostgreSQL test isolation and requirements |
| [postgres/README.md](postgres/README.md) | Disposable Docker database workflow |
| [auth-profile-web/README.md](auth-profile-web/README.md) | Companion testing frontend |
| [rabbitmq-consumer/README.md](rabbitmq-consumer/README.md) | Separate consumer project; not imported by the Nest application |

The HTTP specification preserves existing API.md descriptions and adds routes discovered in source. It is not generated automatically at startup. Error payloads unspecified in API.md remain unconstrained. No `/docs` or `/openapi.json` serving route is configured; use the local file.

## Local setup

Use Node.js 24 (the Dockerfile uses Node 24), npm, and a reachable PostgreSQL database. The database Make workflow additionally needs Docker Compose, GNU Make, and a POSIX shell; use WSL on Windows or follow the manual database option in SETUP.md.

1. Copy `.env.example` to `.env` only if `.env` does not already exist.
2. Configure the database variables and the required SMTP/frontend variables below.
3. Start PostgreSQL (`make -C postgres` for the disposable test container) or create the configured database on your own server.
4. Run `npm ci`, `npx prisma generate`, then `npx prisma migrate deploy`.
5. Run `node scripts/generate-jwt-keys.mjs` if you do not have JWT keys. Put the PEM contents in the environment settings below.
6. Run `npm run start:dev`.

The service needs matching RSA keys of at least 2048 bits. Literal `\n` sequences in configured PEM values are converted to newlines. A fresh database has no users; register one through the API.

### Configuration

Configuration is read from the root `.env` through ConfigModule. Prisma tooling and scripts also use the database settings. Do not copy real credentials into documentation.

| Setting | Meaning |
| --- | --- |
| `PORT` | Listening port; defaults to 3000 |
| `NODE_ENV` | Runtime environment; OAuth configuration checks include production behavior |
| `POSTGRES_HOST` | Required PostgreSQL host |
| `POSTGRES_PORT` | Required PostgreSQL port |
| `POSTGRES_USER` | Required database username |
| `POSTGRES_PASSWORD` | Required database password setting |
| `POSTGRES_DB` | Required database name |
| `JWT_PRIVATE_KEY` | Required RSA signing PEM contents |
| `JWT_PUBLIC_KEY` | Required matching verification PEM contents |
| `SMTP_HOST` | Required mail server host |
| `SMTP_PORT` | Required integer port, 1–65535; port 465 enables secure SMTP |
| `SMTP_USERNAME` | Required mail authentication user; also used as sender |
| `SMTP_PASSWORD` | Required mail authentication password |
| `AUTH_FRONTEND_URL` | Required by MailService for verification/reset links; use `http://localhost:5173` locally |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Required when using Discord OAuth |
| `DISCORD_REDIRECT_URI` | Discord login callback URL |
| `DISCORD_LINK_REDIRECT_URI` | Linking callback; defaults to `/auth/discord/link/callback` on login callback origin |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Required when using GitHub OAuth |
| `GITHUB_REDIRECT_URI` | GitHub login callback URL |
| `GITHUB_LINK_REDIRECT_URI` | Linking callback; defaults to `/auth/github/link/callback` on login callback origin |

The current `.env.example` does not list SMTP or GitHub variables. Add them to your local `.env` as needed. MailService requires its SMTP values and AUTH_FRONTEND_URL during startup even if you only plan to test password login.

CORS currently allows `http://localhost:5173` and `http://127.0.0.1:5173`, with credentials enabled. Changing AUTH_FRONTEND_URL alone does not change this allowlist. Use the same hostname throughout browser OAuth flows so temporary cookies are returned to callbacks.

## Architecture and source map

The request flow is: HTTP controller → access/role guard where configured → validated DTO → domain service → Prisma → PostgreSQL. Global ValidationPipe transforms DTO input and rejects fields outside the DTO allowlist. Routes with raw query values validate those values in their service instead.

| Source | Responsibility |
| --- | --- |
| `src/main.ts` | Bootstrap, CORS, validation, listening port |
| `src/app/` | Module composition and static root response |
| `src/auth/` | Registration/login, token rotation/logout, verification/reset, Discord/GitHub flows |
| `src/auth/guards/access-token.guard.ts` | Bearer JWT validation and authenticated `sub` |
| `src/accounts/` | Public/private profiles, search, password changes, image processing |
| `src/social/` | Friendship requests, responses, listing, deletion |
| `src/superadmin/` | Database-role guard, statistics, user management |
| `src/mail/` | Nodemailer transport and verification/reset templates |
| `src/prisma/` | Shared Prisma client and database connect/disconnect lifecycle |
| `prisma/schema.prisma` | Models and enums |
| `prisma/migrations/` | Versioned database schema changes |
| `scripts/` | JWT key generation and superadmin bootstrap |
| `test/` | HTTP/service checks and PostgreSQL concurrency checks |

BlocksService is an empty class and is not registered in SocialModule. It provides no blocking API. Two-factor and recovery-code models exist, but no corresponding HTTP controllers are exposed.

## Authentication and authorization

Registration/login and successful OAuth login issue `user`, `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, and `refreshExpiresIn`. Access tokens use RS256, issuer `user-service`, audience `ft-transcendence-api`, and a 15-minute lifetime. Protected requests send `Authorization: Bearer <accessToken>`.

Refresh tokens have a seven-day lifetime and rotate on every refresh. Replace both stored tokens after success. Reuse of an unexpired revoked token revokes remaining refresh tokens in that login session. Logout revokes a session's refresh tokens; access tokens remain cryptographically valid until expiry. Password reset revokes all active refresh tokens for the user. The authenticated password set/change endpoints currently do not revoke refresh sessions.

The access guard validates signature, expiry, issuer/audience, and UUID subject; it does not universally check account existence. Individual handlers perform their own database checks. Superadmin endpoints additionally check the user's current database role; changing the role affects subsequent admin requests without needing a new JWT.

OAuth starts in a browser and binds callbacks to temporary cookies and single-use state. Login issues local tokens; linking requires an existing local access token at start and issues no new tokens. Callback behavior depends on Accept: JSON clients get JSON/status errors; browser clients accepting text/html redirect to the frontend with fragment values. GitHub and Discord routes use separate provider strategies.

Private account responses include role, profile/verification timestamps, and `hasPassword`, `hasDiscord`, `hasGithub`. Password hashes and provider secrets are excluded. Public profiles omit email, first/last names, role, verification fields, and authentication flags.

## Data model

| Model | Stored information |
| --- | --- |
| `User` | Unique username/email, optional names/images/password hash, role, verification, timestamps |
| `AuthProvider` | Provider identity linked to a user; unique provider identity and one identity per provider per user |
| `RefreshToken` | Hashed refresh secret, user, login session, expiry and revocation timestamps |
| `OAuthState` | Hashed browser/state challenge, LOGIN/LINK purpose, optional linking owner, expiry |
| `AuthToken` | Hashed single-use EMAIL_VERIFICATION/PASSWORD_RESET tokens and expiry/use timestamps |
| `UserImage` | Binary image content and metadata; one AVATAR and one BANNER per user |
| `Friendship` | Requester, addressee, PENDING/ACCEPTED/DECLINED status, timestamps |
| `TwoFactorAuth`, `RecoveryCode` | Schema support for future two-factor functionality |

User roles are USER/SUPERADMIN. Presence is deferred to the chat service. Friendship creation locks both participant rows in deterministic order to prevent duplicate requests in opposite directions. Only the addressee can accept/reject a pending request; either participant can delete it. Declined rows remain until deleted and prevent a new request between that pair.

Deletion handlers explicitly clean up provider/refresh records where needed; schema cascades remove images, OAuth ownership rows, friendship records, auth tokens, and two-factor/recovery records. Superadmin deletion/demotion protects the final superadmin using transactional locking.

## Using Postman

Import the root `openapi.json` as a collection. The specification's server is `http://localhost:3000`; change the generated base URL variable if your service runs elsewhere. Log in, then paste accessToken into Bearer authorization for protected requests. Use actual account UUIDs and friendship record UUIDs in their respective path parameters.

For image uploads choose Body → form-data and add a single `file` key of type File. Let Postman generate the multipart Content-Type boundary. OAuth must begin and finish in the same browser; manually replaying a callback in Postman without its browser cookie will fail.

## Development and checks

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Run with watch mode |
| `npm run build` | Compile backend |
| `npm run lint` | Lint src and test |
| `npm run prisma:validate` | Validate schema |
| `npm run prisma:generate` | Regenerate client after schema changes |
| `npx prisma migrate deploy` | Apply checked-in migrations |
| `npx prisma migrate dev --name <change>` | Create a development migration |
| `npm run test:auth` | Auth HTTP/service checks |
| `npm run test:accounts` | Account and image checks |
| `npm run test:superadmin` | Admin behavior and HTTP checks |
| `npm run test:discord` | Mocked Discord/database flow checks |
| `npm run test:auth:postgres` | Refresh/logout concurrency on a separate `_test` database |
| `npm run test:discord:postgres` | Linking concurrency in an isolated temporary database schema |
| `npm run bootstrap:superadmin -- user@example.com` | Promote an existing user; no account/password/token creation |

Read test/README.md before running PostgreSQL suites. The default `npm test` uses Vitest and does not invoke the named node:test suites. package.json currently has no dedicated social or GitHub test command.

## Running outside development

Generate Prisma client and apply migrations before running the compiled backend. Run `npm run build`, then `node dist/main.js`. Supply runtime database, SMTP, frontend, and JWT settings. Register provider callback URLs that match your deployed API.

The checked-in Dockerfile has dependencies/build/production stages, but its build stage copies only src and TypeScript/Nest configuration. It does not generate the Prisma client or copy Prisma schema/configuration. A clean Docker build is therefore not a verified deployment path; address client generation and migration execution before relying on it. This documentation change does not modify deployment code.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Startup fails with missing config | All required database, JWT, SMTP, and AUTH_FRONTEND_URL values exist |
| JWT key error | Matching RSA PEM pair, at least 2048 bits, valid newline representation |
| Prisma cannot connect | Host/port, database existence, credentials, running database container |
| Tables missing | Apply checked-in migrations to the configured database |
| Generated Prisma import missing | Run prisma generate before build |
| 401 protected request | Correct Bearer header, unexpired access token; never use a refresh token as Bearer |
| 403 superadmin request | Current database role must be SUPERADMIN |
| OAuth callback rejected | Same browser/hostname, newest flow, correct callback URL, unexpired unused state |
| Password request conflicts | POST is for accounts without a password; PATCH is for existing passwords |
| Friendship request conflicts | An existing row in either direction, including declined requests, blocks creation |
| Image rejected | Exactly one supported nonanimated file within size/pixel limits |

## Current limitations

Local registration activates accounts before email ownership is verified. Verification and password recovery routes exist, but pending registration, verification resend, and email-change verification/password confirmation are deferred. Ban/unban, API keys, live presence, two-factor routes, blocking, and FORTYTWO OAuth are not implemented. Rate limiting is planned rather than configured in the Nest bootstrap. The separate RabbitMQ consumer is not wired into AppModule.

Root GET returns a static development message; it is not a readiness check. Images are public and use no-store. There is no individual image deletion route. Access JWTs remain valid until expiry after logout/deletion; other services need their own account-deletion enforcement.

## Keeping documentation current

When changing routes, update API.md and openapi.json together. Check method/path, guards, DTO constraints, selected response fields, status decorators, and service exceptions. Route coverage alone does not prove every schema or error is accurate; keep examples consistent with source and verify affected behavior with its existing tests.
