# User service

NestJS and TypeScript service that owns accounts, authentication, public profiles, profile images, friendships, blocks and superadmin operations. PostgreSQL stores its data through Prisma. Inside Compose it listens on `user-service:3000`, and browsers reach it at `https://localhost/api/`.

Related documents: [user-chat integration](../integrations/user-chat.md) for how accounts reach chat, [client-backend integration](../integrations/client-backend.md) for sessions in the browser, and the [OpenAPI spec](../api/user-service.openapi.json). The spec is a checked-in file, not generated at startup.

## Architecture

Requests flow through: controller, access or role guard, validated DTO, domain service, Prisma, PostgreSQL. A global `ValidationPipe` transforms input and rejects fields outside the DTO.

| Source                                  | Responsibility                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/main.ts`                           | Bootstrap, CORS, validation, listening port                                                           |
| `src/app/`                              | Module composition and static root response                                                           |
| `src/auth/`                             | Register, login, token rotation, logout, email verification, password reset, Discord and GitHub flows |
| `src/auth/guards/access-token.guard.ts` | Bearer JWT validation and authenticated `sub`                                                         |
| `src/accounts/`                         | Public and private profiles, search, password changes, image processing                               |
| `src/social/`                           | Friend requests and blocks                                                                            |
| `src/superadmin/`                       | Role guard, statistics, user management                                                               |
| `src/events/`                           | RabbitMQ publisher for `user.created`, `user.updated`, `user.deleted`                                 |
| `src/mail/`                             | Nodemailer transport and email templates                                                              |
| `src/prisma/`                           | Shared Prisma client                                                                                  |
| `prisma/`                               | Schema and migrations                                                                                 |
| `scripts/`                              | JWT key generation and superadmin bootstrap                                                           |
| `test/`                                 | HTTP, service and PostgreSQL concurrency checks                                                       |

## Authentication

Register, login and OAuth login return `user`, `accessToken`, `tokenType` and `expiresIn`.

| Token         | Details                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Access token  | RS256 JWT, 15 minutes, issuer `user-service`, audience `ft-transcendence-api`. Sent as `Authorization: Bearer <token>`. |
| Refresh token | 7 days, HttpOnly cookie only, rotated on every refresh.                                                                 |

- Reusing an unexpired revoked refresh token revokes the rest of that login session.
- Logout revokes the session's refresh tokens. Access tokens stay valid until they expire.
- Password reset revokes all of a user's refresh tokens. The authenticated password change endpoints do not.
- The access guard checks signature, expiry, issuer, audience and a UUID subject. It does not check that the account still exists; handlers do that themselves.
- Superadmin routes also read the user's current role from the database, so a role change applies without a new JWT.

### Email verification and password reset

Both use hashed single-use `AuthToken` rows that expire after 2 hours. Registration sends a link to `${AUTH_FRONTEND_URL}/verify-email?token=...`, and the client's `/verify-email` page calls `GET /auth/verify-email/:token`. Changing your email clears `emailVerifiedAt`.

Accounts can log in before verifying, because login does not check `emailVerifiedAt`. `POST /auth/email-verification/request` accepts an email and returns a generic `{ requested: true }` response; for eligible unverified accounts it sends a replacement link, with a 10-minute per-account cooldown. Each replacement invalidates prior unused verification links.

### OAuth

Discord and GitHub flows start in a browser and bind the callback to temporary cookies and single-use state. Login issues local tokens. Linking needs an existing access token at the start and issues no new tokens. JSON clients get JSON responses, and browser clients are redirected to the frontend.

## Social

- **Friendships:** creating one locks both user rows in a fixed order, which prevents duplicate requests in opposite directions. Only the addressee can accept or reject, and either side can delete. A declined row stays until deleted and blocks a new request between that pair.
- **Blocks:** `BlocksService` stores `Block` rows and removes any friendship between the two users. A block in either direction stops new friend requests. Chat calls `GET /social/blocks/check/:userId` before DM activity.

## Profile images

Images are stored in PostgreSQL (`UserImage`), not in MinIO. Uploads are limited to 20 million input pixels and re-encoded to WebP at a fixed size.

| Kind   | Max upload | Output     |
| ------ | ---------- | ---------- |
| Avatar | 1 MiB      | 256 x 256  |
| Banner | 5 MiB      | 1500 x 500 |

Accepted input is JPEG, PNG or WebP. Images are public and served with `no-store`.

## Events

After a successful database write, the service publishes to the `user.events` exchange. Callers are in `AuthService`, `AccountsService` and `SuperadminService`. See [user-chat integration](../integrations/user-chat.md).

## Data model

| Model                           | Stores                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `User`                          | Unique username and email, names, images, password hash, role, verification, bio, status text and icon, timestamps |
| `AuthProvider`                  | Discord or GitHub identity linked to a user                                                                        |
| `RefreshToken`                  | Hashed refresh secret, session, expiry, revocation                                                                 |
| `OAuthState`                    | Hashed state challenge, LOGIN or LINK purpose, expiry                                                              |
| `AuthToken`                     | Hashed EMAIL_VERIFICATION and PASSWORD_RESET tokens                                                                |
| `UserImage`                     | Binary image and metadata, one AVATAR and one BANNER per user                                                      |
| `Friendship`                    | Requester, addressee, PENDING, ACCEPTED or DECLINED                                                                |
| `Block`                         | Blocker and blocked user                                                                                           |
| `TwoFactorAuth`, `RecoveryCode` | Schema only, no routes yet                                                                                         |

Roles are `USER` and `SUPERADMIN`. Deleting or demoting the last superadmin is prevented with transactional locking.

## HTTP routes

Paths are as the service sees them. Through the gateway, add the `/api` prefix.

| Area            | Routes                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root            | `GET /` (static message, not a readiness check)                                                                                                                                                            |
| Auth            | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password-reset/request`, `/auth/password-reset/confirm`, `/auth/email-verification/request`; `GET /auth/verify-email/:token` |
| Discord, GitHub | `GET /auth/{provider}`, `GET /auth/{provider}/callback`, `POST` and `DELETE /auth/{provider}/link`, `GET /auth/{provider}/link/callback`                                                                   |
| Own account     | `GET`, `PATCH`, `DELETE /accounts/me`; `POST`, `PATCH /accounts/me/password`; `PUT`, `DELETE /accounts/me/avatar` and `/accounts/me/banner`                                                                |
| Public accounts | `GET /accounts`, `/accounts/search`, `/accounts/:id`, `/accounts/:id/avatar`, `/accounts/:id/banner`                                                                                                       |
| Friendships     | `POST /social/friendships/:id`; `GET /social/friendships`, `/requests`, `/sent`; `PATCH /social/friendships/:friendshipId/accept` and `/reject`; `DELETE /social/friendships/:friendshipId`                |
| Blocks          | `POST`, `DELETE /social/blocks/:userId`; `GET /social/blocks`, `/social/blocks/check/:userId`                                                                                                              |
| Superadmin      | `GET /superadmin/stats`; `GET`, `POST /superadmin/users`; `GET`, `PATCH`, `DELETE /superadmin/users/:id`; `PATCH /superadmin/users/:id/role`                                                               |

`POST /accounts/me/password` is for accounts with no password yet, such as OAuth accounts. `PATCH` changes an existing one.

## Configuration

Under Compose, settings come from the split files in `envs/`. See [infrastructure](infrastructure.md).

| Setting                                                                               | Meaning                                                                           |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `PORT`                                                                                | Listening port, default 3000                                                      |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database                                                                          |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`                                                   | Matching RSA PEM pair, at least 2048 bits. Literal `\n` is converted to newlines. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`                            | Required at startup. Port 465 enables secure SMTP.                                |
| `AUTH_FRONTEND_URL`                                                                   | Origin used in email links and CORS                                               |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`    | Broker                                                                            |
| `DISCORD_*`, `GITHUB_*`                                                               | Client ID, secret and redirect URIs. Leave empty if unused.                       |
| `SUPERADMIN_USERNAME`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`                      | Initial superadmin, created only when none exists                                 |

## Running it alone

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Start PostgreSQL: `make -C postgres` for the disposable container, or use your own server.
3. Run `npm ci`, `npx prisma generate`, then `npx prisma migrate deploy`.
4. Run `node scripts/generate-jwt-keys.mjs` and paste the PEM contents into `.env`.
5. Make sure SMTP and RabbitMQ are reachable, then run `npm run start:dev`.

## Commands

| Command                                                                 | Purpose                      |
| ----------------------------------------------------------------------- | ---------------------------- |
| `npm run start:dev`                                                     | Run in watch mode            |
| `npm run build`, `npm run lint`                                         | Compile, lint                |
| `npx prisma migrate dev --name <change>`                                | Create a migration           |
| `npm run test:auth`, `test:accounts`, `test:superadmin`, `test:discord` | Named test suites            |
| `npm run test:auth:postgres`, `test:discord:postgres`                   | PostgreSQL concurrency tests |
| `npm run bootstrap:superadmin -- user@example.com`                      | Promote an existing user     |

## Troubleshooting

| Symptom                  | Check                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| Startup fails on config  | All database, JWT, SMTP and `AUTH_FRONTEND_URL` values exist        |
| JWT key error            | Matching RSA pair, valid newlines                                   |
| 401 on a protected route | Correct Bearer header and unexpired access token                    |
| 403 on superadmin        | The current database role must be `SUPERADMIN`                      |
| OAuth callback rejected  | Same browser and hostname, correct callback URL, unexpired state    |
| Friend request conflict  | An existing row in either direction, including declined, or a block |
| Image rejected           | One supported file within size and pixel limits                     |

## Current limitations

- Accounts are usable before email verification; users can request a replacement verification link after the resend cooldown.
- Two-factor models exist with no routes.
- Rate limiting is applied by Nginx, not by the service.
- There is no transactional outbox, so a crash between the database write and the publish loses that event.
- Access tokens stay valid until expiry after logout or account deletion.
