# Auth → Game integration contract

Owner: auth contributor. Game is a consumer only — game code implements nothing below.
Authoritative wiring: Tasks 1–7 of `connect-saads-login-to-game`
(deferred minors live in `.superpowers/sdd/2026-10-13-connect-saads-login-to-game/progress.md`).

## Verified-identity endpoint (user-service, private)

- `GET /auth/principal` on `http://user-service:3000` (never public; only the
  gateway proxies it). Guarded by `AccessTokenGuard`; returns
  `{ userId: <uuid>, expiresAt: <unix ms> }` with `Cache-Control: no-store`.
- `expiresAt` is `exp * 1000` from the JWT; the row is re-read from the DB, so
  forged / expired / revoked / deleted accounts all yield **401**.
- Access tokens live ≤15 min (`ACCESS_TOKEN_TTL_SECONDS = 900`). Refresh
  travels only in the `auth-refresh` cookie: `httpOnly`, `secure` (prod/https),
  `sameSite: lax`, `path: /auth/` (gateway rewrites to `/api/auth/`).

## Game verifier (`AuthPrincipalClient`)

`services/game/src/auth/auth-principal-client.ts`. Constructor takes the base
URL from `USER_SERVICE_BASE_URL`, default `http://user-service:3000`.

- `verify(accessToken): Promise<VerifiedPrincipal>` where
  `VerifiedPrincipal = { userId: string; expiresAt: number }`.
- Exactly one in-flight fetch per token (dedup map, no result cache).
- `AbortSignal.timeout(2000)` covers headers **and** body read.
- `401` → `UnauthorizedError`; anything else (network, 5xx, non-JSON,
  null/array/non-object body, non-UUID `userId`, non-integer/past `expiresAt`) → `VerificationUnavailableError`.
- **Provider registration lives in `GameModule` only** (factory provider, Task 4);
  gateways inject it, never re-register. Tests use the single
  `createTestAppWithVerifier` helper (Task 3); PG-backed suites need
  `TEST_PG_URL`, otherwise use the fake-Game branch.

## HTTP edge (game)

`PrincipalMiddleware` (`services/game/src/game/principal.ts`):

- `Authorization: Bearer <token>` parsed with `/^Bearer +(\S+)$/i`; verified
  principal lands on `req.principal = { userId, expiresAt }`.
- Missing/malformed/`UnauthorizedError` → **401**; `VerificationUnavailableError`
  → **503**. Game logic reads `userId` only and never trusts
  `userId`/`playerId`/`teamId`/`side` from query, body, or headers.
- Scoped to `matches`, `matches/{*path}`, `lobby`, `lobby/{*path}`.
  `GET /health` + `/ready` are exempt (and outside the scope).

## Socket edge (game, all four namespaces)

`services/game/src/game/socket-auth.ts` + game/lobby/team-chat/collab gateways:

- Handshake carries `auth: { accessToken, matchId? }` (match id required on
  match-scoped namespaces). No token store in the principal: the token lives in
  a private socket field, the principal keeps `{ userId, expiresAt, matchId? }`.
- Every message re-verifies the stored token (`userId` equality + expiry
  refresh). Failure → `disconnect(true)` + throw; already-dead/late-expiry
  outputs are suppressed (ack `undefined`), never emitted to expired sockets.
- All emits are per-recipient gated (`connected && expiresAt > now &&
  runtimeReady`). Broadcasts and relays require `fetchSockets()` inspection.
  A lookup failure sends nothing. Readiness is checked after lookup and before
  each emission; relays also recheck the sender and exclude it.
- A verified-expiry timer closes idle sockets in all four namespaces. Disconnect
  clears the timer and runs normal Presence cleanup. Accepted evaluations continue.
- **Renewal = reconnect with the new token** (no token-swap on a live socket).
  A missing ack means renew + reconnect — never a blind retry of the submit.
  Accepted evaluations are untouched by auth failures and complete after expiry.

## Browser session (`packages/browser-auth` + game transports)

- `createBrowserAuthClient` **requires** Web Locks + BroadcastChannel (throws
  otherwise). Memory-only tokens; one origin-wide lock (`browser-auth:session`).
- `fetch` never replays mutations; at most one retry for safe reads with
  `retrySafeRead`. `401` → single renew → retry once → confirmed expiry clears
  to anonymous (`SESSION_EXPIRED`); network/5xx/timeout → `UNAVAILABLE`, token
  retained. Late results after logout/login are rejected (`SESSION_CHANGED`).
  Failed server logout persists a credential-free intent and sets `logoutPending`,
  which blocks bootstrap `restore()` across reload and entry to another App
  (`LOGOUT_PENDING`). Cross-tab `signed-out`/`signed-in`/`token-renewed` stay
  loop-free (renewed tokens re-verify via profile GET, restore only on 401).
- Game transports send Bearer HTTP + `auth: { accessToken, matchId }`; player
  id is resolved once from `GET /accounts/me`. HTTP 401 on GET → renew → retry
  once; on POST → renew → fresh socket in the same transport → snapshot refetch
  → `AuthExpiredError` (no resend; `pendingSubmit` ids survive for deliberate
  resubmits). Non-GET `/auth/*` sends `X-Requested-With` (Origin/Referer stay
  browser-managed).

## Gateway routing (canonical)

With `VITE_API_URL=/api` the Arena uses one `apiBase` for `/accounts/me`
(user) and `/lobby/*` (game), so the gateway splits under `/api`:

| Public prefix | Upstream | Notes |
|---|---|---|
| `/api/lobby/`, `/api/matches/` | **game** (strip `/api`) | **Canonical**: without these, `/play/` Lobby 404s via user-service |
| `/api/game/` | game (strip `/api/game/`) | No rate limit |
| `/matches…`, `/lobby…` (root) | game (legacy compat) | No rate limit |
| `/api/auth/login`, `/register` | user-service | 10r/m + CSRF |
| `/api/auth/password-reset/` | user-service | 10r/m, no CSRF (mails carry links) |
| `/api/auth/refresh`, `/logout` | user-service | 60r/m + CSRF |
| `/api/` (rest: accounts, OAuth, principal) | user-service | No limits; OAuth GET exempt from CSRF |
| `/socket.io/` | game (all namespaces) | No rate limit |
| `/play/` → Arena SPA, `/` → auth SPA | static | `/play` → `/play/` 301 |
| `= /health`, `/ready`, `/healthz` | gateway `200 ok` | Exempt from limits/CSRF |

Credential route forms share the same limits, including case and trailing slash.
The gateway requires `X-Requested-With: XMLHttpRequest` and an HTTPS Origin or
Referer. User Service also requires the exact custom header and a source from its
trusted origin set. OAuth GET callbacks and internal principal checks are exempt.
The access log uses `$request_method $uri` and omits full Referer, `$request` and
`$args`, so query codes/state are not written to the access log. (Path-segment tokens such as `verify-email/:token` still
appear in `$uri` by design.)

## DEV seams (explicit dev suite only; prod `DEV_PRINCIPAL=false`)

| Seam | Scope |
|---|---|
| `x-dev-user-id` header → fixture principal | HTTP, DEV on only; off → 401 |
| `auth.userId` / query / `?user=` handshake fallback | Sockets, DEV on only; off → fail-closed |
| `POST /matches` direct-match fixture | DEV on only; off → 404 |
| `/?live=1&user=` arena entry | Spawned-server E2E only; `/play/` prod path has no query identity |

Separate databases always: game (`game_db`/`game_user`) vs accounts
(`user_db`/`user_user`) on separate volumes; `TEST_PG_URL` enables PG-backed
game suites. Required env: `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` (RSA ≥2048,
single-line `\n`), `SUPERADMIN_USERNAME`/`_EMAIL`/`_PASSWORD`,
`AUTH_FRONTEND_URL`, `SMTP_HOST`/`_PORT`/`_USERNAME`/`_PASSWORD`.

## Expected cross-boundary tests (auth owner + game owner together)

- Authenticated HTTP request reaches game with the correct `userId`.
- Forged/expired/revoked token never yields a game principal (rejected before game logic).
- Authenticated socket carries the principal; game authorizes room/match from it.
- Two different users receive different `userId`s; one user cannot act as another
  (game-side membership tests cover the rest).
- Renewal in every namespace: reconnect-with-new-token keeps the match alive;
  missing-ack resubmits reuse immutable Submit ids (no double counting).
