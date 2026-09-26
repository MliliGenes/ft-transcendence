# Authentication checklist

Start here next session. Work through one milestone at a time; OAuth and 2FA can wait until local authentication works.

**First milestone:** register with a username, email, and password; save the user and a hashed refresh token; issue an access/refresh token pair without exposing private fields.

## Already done

- [x] Prisma schema and generated client for all five models.
- [x] Initial migration applied to the local PostgreSQL database.
- [x] Global `ConfigModule` loads `.env`.
- [x] Global `PrismaModule` exports `PrismaService` and is registered in `AppModule`.
- [x] `AuthService` injects `PrismaService`; `AuthController` injects `AuthService`.
- [x] Build, existing starter test, and a real database query through NestJS passed during review.

The existing test covers the starter controller, not authentication. The 2FA tables exist, but 2FA behavior is not implemented.

## 1. Understand the pieces and prepare

| Piece             | Responsibility in this project                                                          |
| ----------------- | --------------------------------------------------------------------------------------- |
| DTO               | Describes allowed request fields and their validation rules.                            |
| Validation pipe   | Checks incoming values at runtime; TypeScript types alone do not validate requests.     |
| Controller        | Defines HTTP routes, accepts DTOs, delegates work, and handles response cookies.        |
| Auth service      | Implements registration, login, and session rules.                                      |
| Prisma service    | Provides database access and connection lifecycle handling.                             |
| Guard             | Decides whether a request may reach a route, using authentication context.              |
| Middleware        | Performs general request processing; it is not required just to implement registration. |
| Passport strategy | Implements an authentication mechanism and returns the authenticated identity.          |

- [ ] Read about [DTO validation and pipes](https://docs.nestjs.com/techniques/validation), then skim [guards](https://docs.nestjs.com/guards) and [middleware](https://docs.nestjs.com/middleware) to understand the difference.
- [ ] Add `app.enableShutdownHooks()` in `src/main.ts` for supported shutdown signals. See [Nest lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events).
- [ ] Remove the unused `NotFoundException`, `Get`, and `Param` imports when editing the auth files.
- [ ] Add dependencies as needed: `class-validator`, `class-transformer`, a maintained Argon2 library, and `@nestjs/jwt`. Check compatibility with NestJS 12 before installing.
- [ ] Configure token signing secrets and expiry settings through `ConfigService`; validate required settings at startup. Put placeholder names only in `.env.example`.

## 2. Registration: input to database

- [ ] Create `src/auth/dto/register.dto.ts` with `username`, `email`, and `password`.
- [ ] Choose username character/length rules and a password length policy. Allow passphrases; never silently trim, lowercase, or truncate passwords.
- [ ] Define a consistent email/username normalization policy for both registration and login. The current unique columns do not automatically enforce case-insensitive uniqueness.
- [ ] Register a global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`. Decorate every permitted DTO property.
- [ ] Add `POST /auth/register` in `auth.controller.ts`; pass the validated DTO to `authService.register()`.
- [ ] Hash the password with Argon2id before saving it. Read [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and your chosen library's hash/verify API.
- [ ] Create the user using explicit fields, including `passwordHash`. Do not spread arbitrary request data into Prisma input.
- [ ] Keep `emailVerifiedAt` as `null`; successful registration does not prove ownership of the address.
- [ ] Catch Prisma's unique-constraint error (`P2002`) and return an intentional duplicate-account response, such as `409 Conflict`. An optional lookup beforehand cannot prevent concurrent duplicate registrations.
- [ ] Select a safe response shape, for example `id`, `username`, and `email`. Never return `passwordHash`, token hashes, or authenticator secrets.

**Checkpoint:** valid input creates one user; invalid input creates none; duplicate identifiers are handled deliberately.

## 3. Generate the token pair

Suggested starting design: a short-lived JWT access token and a longer-lived opaque random refresh token. A token pair does not require both tokens to be JWTs.

- [ ] Read [NestJS authentication and JWTs](https://docs.nestjs.com/security/authentication). Understand signing versus encryption: JWT payloads are readable, so keep secrets out of them.
- [ ] Configure `JwtModule` from environment settings. Choose expiry values explicitly; 15 minutes for access and 7 days for refresh are example starting values, not requirements.
- [ ] Sign an access token with `sub` set to the user ID and an expiry. Decide issuer/audience values and use the same expectations when verifying tokens.
- [ ] Generate a refresh secret with a cryptographically secure source, such as 32 random bytes. Learn [Node crypto randomBytes](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback) and [createHash](https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options).
- [ ] Use a token format such as `<refresh-row-id>.<random-secret>`: the ID locates the row; the secret proves possession. An ID alone must never authenticate anyone.
- [ ] Store a SHA-256 digest of the high-entropy refresh secret in `RefreshToken.tokenHash`, with `userId`, `expiresAt`, and `revokedAt: null`. Compare digests safely. Passwords still require a password-hashing algorithm.
- [ ] Extract token-pair creation into a reusable service method so registration, login, and future OAuth callbacks follow the same session rules.
- [ ] Make user creation and its initial refresh-token record atomic, using a Prisma transaction or nested write. Compute expensive password hashes before opening the transaction.
- [ ] Decide delivery for your browser client: keep the access token in memory and deliver the refresh token through an `HttpOnly` cookie. Configure `Secure` for HTTPS, an appropriate `SameSite` policy, path, expiry, and trusted origins.
- [ ] Implement CSRF protection for cookie-authenticated operations; do not assume `HttpOnly` prevents CSRF. Read [NestJS CSRF protection](https://docs.nestjs.com/security/csrf). Keep credentials out of logs and redirect URLs.

**First milestone complete:** registration issues a usable pair, the database holds only a refresh-token hash, and the response contains only intended public fields.

## 4. Login and the first protected route

- [ ] Create `login.dto.ts` and `POST /auth/login`; start with email/password login.
- [ ] Look up the user and verify the submitted password against the stored hash. Handle `passwordHash: null` for OAuth-only accounts without crashing.
- [ ] Return a generic `401 Unauthorized` for invalid credentials, then issue a token pair on success.
- [ ] Implement an access-token guard, directly with `JwtService` or with a Passport JWT strategy. Verify signature, allowed algorithm, expiry, issuer, and audience; decoding alone is insufficient.
- [ ] Add `GET /auth/me`, protected by that guard. Use the verified `sub` to fetch a safe user profile.
- [ ] Add rate limits to registration and login. Learn [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting).

## 5. Refresh and logout

- [ ] Add `POST /auth/refresh`: locate the refresh row, verify the secret hash, and require a future `expiresAt` and `revokedAt: null`.
- [ ] Rotate tokens: atomically revoke the old refresh token and create its replacement, then issue the new pair. A conditional update must ensure concurrent requests cannot both consume the old token.
- [ ] Define replay handling. With the current schema, one simple policy is to revoke all active refresh tokens for that user after confirmed reuse of a revoked token; verify its secret first. Later, a session/family identifier can narrow revocation to the affected session.
- [ ] Add `POST /auth/logout`: revoke the presented, verified refresh token and clear its cookie using matching cookie settings.
- [ ] Document that an already-issued access token remains usable until expiry unless you add server-side revocation checks.
- [ ] Read the refresh-token section of [OAuth security best practices, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14) to understand rotation and replay detection.

## 6. Verify before adding providers

Use a separate test database for integration tests. Unit tests can mock `PrismaService`.

- [ ] Registration succeeds; saved passwords and refresh credentials are hashed; private fields never appear in responses.
- [ ] Invalid email, missing fields, unexpected fields, and duplicate usernames/emails are rejected.
- [ ] Login succeeds with the correct password and fails for incorrect credentials or an OAuth-only account.
- [ ] Missing, tampered, expired, and incorrectly issued access tokens fail on `/auth/me`.
- [ ] Refresh works once; expired/revoked tokens fail; concurrent rotation allows only one success; confirmed replay triggers the chosen revocation policy.
- [ ] Logout clears the cookie and makes the refresh token unusable.
- [ ] Run the existing checks and your new auth tests:

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

## 7. Later: Passport and OAuth, one provider at a time

Read [NestJS Passport integration](https://docs.nestjs.com/recipes/passport): strategy `validate()`, `AuthGuard`, and how an authenticated user reaches the controller. Passport does not replace your Prisma persistence or application token issuance.

- [ ] Add `@nestjs/passport`, `passport`, and suitable strategy dependencies after checking their maintenance, NestJS compatibility, and provider support.
- [ ] Implement GitHub first, then Discord, then 42; keep strategies in `src/auth/strategies/`.
- [ ] Register provider applications and exact callback URLs. Keep provider secrets in environment settings and request only required scopes.
- [ ] Implement authorization-code flow with short-lived, single-use `state` bound to the initiating browser flow and PKCE where supported. Read [OWASP OAuth guidance](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html).
- [ ] Resolve identities by `(provider, providerUserId)`. Repeated sign-ins must reuse the same `User`.
- [ ] Handle missing/private email addresses and username collisions with an onboarding step; your schema requires unique email and username values.
- [ ] Keep login and account linking separate. Linking requires proof of ownership of the current account and the provider identity; matching emails alone must not merge accounts.
- [ ] Issue your application's token pair after authentication. Provider access/refresh tokens belong to the provider API and are distinct from your `RefreshToken` records.
- [ ] Test callback denial, invalid/replayed state, repeat sign-in, and attempts to link an identity already owned by another user.

| Provider   | Official resource                                                                                               | Focus                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub     | [Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) | Redirect, callback, code exchange, identity, and email access.                                                                                |
| Discord    | [OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2)                                       | Authorization code flow; `identify` and `email` scopes.                                                                                       |
| 42 Network | [Web application flow](https://api.intra.42.fr/apidoc/guides/web_application_flow)                              | Sign in to the 42 documentation and confirm current application setup, endpoints, and scopes. This link redirected to 42 login during review. |

## Park for later

- [ ] Email verification: separate expiring, single-use verification tokens; set `emailVerifiedAt` only after confirmation.
- [ ] Password reset and account recovery.
- [ ] Authenticator-app 2FA: pending enrollment, encrypted TOTP secret, activation after a valid code, replay prevention, and hashed recovery codes.
- [ ] Before enabling 2FA, ensure both password and OAuth login defer full token issuance until the second factor succeeds.

## Database reminder

Keep Prisma on the configured **7.10.0** workflow. `prisma generate` updates TypeScript client code; migrations update database tables. The initial migration is already applied.

Your local database role cannot create a shadow database, so plain `prisma migrate dev` currently fails. Before the next schema change, configure a dedicated shadow database or generate and review a migration using the existing workflow; apply it with `migrate deploy`. Do not reset the database to solve that permission issue. No new migration is required just to implement registration against the current fields.
