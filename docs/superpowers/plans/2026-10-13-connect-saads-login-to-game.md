# Connect Saad's Login to Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players use Saad's existing login screens and a Play link opens the Game Lobby under the same HTTPS address, with Game verifying identity via user-service.

**Architecture:** user-service owns accounts/tokens/sessions and adds `GET /auth/principal`; Game consumes it through an injectable `AuthPrincipalClient.verify()` provider (2s deadline, in-flight dedup only, no success cache) used by HTTP middleware and all four socket namespaces with per-action re-verification and pre-emission gating; browsers share dependency-free `packages/browser-auth` (memory-only tokens, generation-guarded, cross-tab session control).

**Tech Stack:** NestJS (game + user-service), Socket.IO (`/`, `/lobby`, `/chat`, `/collab`), dependency-free ESM `packages/browser-auth`, React+Vite static SPAs (Arena base `/play/`, auth base `/`), Nginx HTTPS gateway, Postgres x2, Redis. Arena Node 22; `user-service/` + `auth-profile-web/` standalone Node 24.

**Spec:** User message "Connect Saad's login to Game" (2026-10-13) plus read-only review corrections (2026-10-13, 4 corrections + minimum tests + 10 recommended defaults). This plan argues from both; executors read all three.

## Current status — 2026-10-14

Tasks 1–7 are implemented. Repair Tasks 1–4 passed independent review. Task 8
now has 5/5 real HTTPS proof groups: password login → Account Play → Lobby →
playable 1v1/four-player 2v2, normal 900-second idle App expiry and automatic
recovery, passive Lobby updates, renewal, outage, identity replacement, cookie
migration and logout. Frontend 125/125 and root 764 passed; all checks/builds pass.
The scoped review found a remaining slow-browser-clock recovery fault. Its fix
passes 125 frontend tests; real slow-clock proof passed 5/5. Bounded clock-fix re-review remains before delivery. The original boxes preserve the implementation sequence; current
verification is in [auth repair evidence](../../auth-integration-repair-evidence.md).

## Global Constraints

- Base integration checkout on `Aimane`; user-service version `ac325b3`; `user-service-test` branch is older test reference only.
- Injectable boundary: `AuthPrincipalClient.verify(accessToken: string): Promise<VerifiedPrincipal>` with `VerifiedPrincipal = { userId: string; expiresAt: number }` (Unix ms). Validate UUID `userId`, finite safe-integer `expiresAt`, `expiresAt > Date.now()`. Upstream `401` → `UnauthorizedError`; timeout, malformed body, other upstream failures → `VerificationUnavailableError` (`503` at Game edge).
- Test helper + provider replacement must be defined before use: `createTestAppWithVerifier(fake)` and `overrideProvider(AuthPrincipalClient)`; direct gateway-construction tests use explicit verifier fixtures.
- Game verification deadline 2s including response-body reading (body stalls count as timeout).
- Do not cache successful checks; share only checks already in progress (concurrent dedup, sequential calls re-verify).
- HTTP uses `Authorization: Bearer <accessToken>`; sockets handshake `auth: { accessToken, matchId? }`.
- Protect HTTP actions and all four namespaces: Match (`/`), Lobby (`/lobby`), Team chat (`/chat`), Team collaboration (`/collab`).
- Separate credentials from socket identity: store handshake token privately once; expose `{ userId, expiresAt, matchId? }` to gateways. Each message re-verifies stored token and checks returned `userId` against attached identity. Payload `accessToken`/`userId` and auth events cannot replace it.
- Gate outputs outside interceptors per recipient immediately before emission (Game events, lobby hints, chat/pings, collab updates/cursors/peer-left, admission snapshot/sync/history) using attached expiry + connection state + runtime readiness. Timers alone insufficient.
- Late-result checks: after auth, membership, presence, join, baseline awaits, recheck expiry + connection lifetime + runtime before proceeding. Suppress expired/disconnected success and error acknowledgements. Preserve presence cleanup registered during admission.
- Client-supplied identity never replaces verified player; verify each incoming action.
- `pendingSubmit` lives in stable `SocketArenaTransport`; never recreate transport on rotation. Renew fresh sockets within stable same-user/match clients, retain retry identities, never auto-replay actions. Sidecar keys omit credentials → `/chat` + `/collab` need explicit renewal signal.
- Shared browser module: `packages/browser-auth` with public `src/client.js` + adjacent `client.d.ts`, impl under `src/lib/`; dependency-free ESM, no React/Nest imports, no generated build. Exports `createBrowserAuthClient(...)` returning `getSnapshot, subscribe, restore, login, logout, getAccessToken, fetch, dispose`. Tokens private memory-only; snapshots expose account, status, session generation, token revision, error. JSON/error formatting in thin Saad API adapter.
- Only shared package in Arena root workspaces. Standalone `user-service/` + `auth-profile-web/` each with own lockfile + Node 24 install. Auth frontend depends on `file:../packages/browser-auth`; Docker build uses repo-root context, copies package before its own `npm ci`. Arena stays Node 22. Extend boundary check beyond `packages services frontend scripts` to new standalone dirs.
- Static SPAs only: Arena Vite base `/play/`, auth SPA base `/`. Multi-stage gateway image copies Node 22 Arena output to `/usr/share/nginx/html/play/` and Node 24 auth output to `/usr/share/nginx/html/`. Never run Vite dev server in production. Play control is ordinary `<a href="/play/">` (Saad `navigate()` whitelist cannot cross SPAs).
- Routing: auth HTTP `/api`, Game HTTP `/api/game`, all sockets HTTPS origin path `/socket.io` with namespaces `/`, `/lobby`, `/collab`, `/chat`. Clients need distinct endpoint fields (not reused `baseUrl`). `/play` → `/play/` redirect + separate SPA fallbacks. Keep `/api/*` + `/socket.io/*` out of SPA fallbacks. Production `/play/` starts live automatically; `user`/`live`/mock controls only in explicit dev fixtures. Display/account ID from `/accounts/me`.
- Retry contract: shared `fetch` defaults to no replay, with separately requested single retry for safe reads. Game mutations renew auth, reconnect, refresh authorized state, report rejected action without resending. Keep Submit IDs, explicit chat retry IDs, Yjs recovery on stable client instances.
- Cross-tab: one origin-wide lock name for login/register/restore/refresh/logout. Broadcast session-control events only, never tokens. Every async op captures session generation, rejects late results after logout/replacement. Fix `restoreSession()` unconditional `store.replace()` revival bug. Require Web Locks + BroadcastChannel in production browser contract (unlocked fallback unsafe).
- Outages vs expiry: definitive refresh `401` → anonymous (sign-in required). Network/timeout/5xx → unavailable: pause actions, retain drafts + uncertain command identities. Fix `renew()` converting these to `SESSION_EXPIRED`. Never auto-replay uncertain refresh. Logout invalidates local work + all sockets immediately, then serializes server logout. Failed logout sets shared non-credential `logout pending` marker blocking cookie bootstrap after reload until confirmed or new login.
- Cookies/CSRF: backend `Path=/auth/` rewritten by Nginx to `/api/auth/`, HttpOnly, Secure, SameSite=Lax, no Domain. Same rewrite covers OAuth cookies `/auth/github`, `/auth/discord`. Replace Saad Vite `cookiePathRewrite: '/'` with canonical public path. Expire legacy root-path `auth-refresh`. Cookie-changing endpoints require custom `X-Requested-With` header + exact configured Origin with validated Referer fallback; reject lacking both. Fix helper accepting missing Origin/Referer and missing header enforcement. OAuth callback state validation stays its protection.
- Rate limits: keep credential/reset limits keyed to exact public `/api/auth/...` paths; do NOT apply blanket `api_all:67r/m` to `/api/game/` or `/socket.io/`. Keep query-free gateway access-log format (omit OAuth codes/state).
- Internal `/health` + `/ready` are exempt (no credentials); Compose calls `/ready` without auth.
- Real `GameService` cannot init with `DEV_PRINCIPAL=false` + empty `DATABASE_URL`; production-auth tests need `TEST_PG_URL` or defined fake Game provider.
- Correct stale `TOKEN_KEY`/persisted-token/OAuth-fragment/refresh-JSON assertions before claiming auth tests pass. Shared-package tests use public entry with injected fetch/locks/channel/clock.
- Logout blocks renewal; existing access token may remain valid up to 15 minutes.
- Fresh disposable databases/volumes for proof; preserve existing data; cleanup limited to newly owned resources.
- Password login first proof; keep OAuth behavior. Remove prod dependence on `?user=` + dev headers (`x-dev-user-id`, `DEV_PRINCIPAL` prod path; old fixtures stay in separate explicit dev suite).
- Preserve Saad `/api/` routes + refresh-cookie path rewrite; preserve Game HTTP + socket routes. Separate DB credentials/storage.
- Failed verification blocks request; service failures `503`. Local HTTPS integration only.
- Canonical Compose adds standalone user db/service + static frontend arrangement without importing Saad root `compose.yaml`. Required startup config: JWT keys, superadmin bootstrap fields, `AUTH_FRONTEND_URL`, all four SMTP settings.

## Review Focus

- Body stall past 2s deadline: verification must fail as `503`, not hang or return stale success.
- Expired RPC result arriving after disconnect/expiry: both success and error acks suppressed, no further output to that socket.
- Token/identity replacement via payload `accessToken`/`userId` or auth event: rejected, attached identity unchanged.
- Renewal during uncertain Submit + pending sidecar admission: stable client keeps Submit IDs, sidecars renew explicitly, no mutation replayed.
- Logout during bootstrap/renewal + reload with failed logout: `logout pending` marker prevents cookie-bootstrap resurrection, all sockets closed cross-tab.

---

### Task 1: Prepare authentication baseline import

**Files:**
- Create: `user-service/` (from `ac325b3` — full tree incl. `src/auth/*`, `src/accounts/*`, `Dockerfile`, `package.json`, `package-lock.json`, own Node 24 install)
- Create: `auth-profile-web/` (from `ac325b3`, own lockfile + Node 24, dep `file:../packages/browser-auth` added later in Task 6)
- Create: `packages/browser-auth/src/client.js`, `packages/browser-auth/src/client.d.ts`, `packages/browser-auth/src/lib/*`, `packages/browser-auth/package.json`
- Modify: `package.json` workspaces (add only `packages/browser-auth`), boundary-check command (extend beyond `packages services frontend scripts` to `user-service auth-profile-web`)
- Modify: `user-service/test/*.test.mjs` stale assertions (`TOKEN_KEY`, persisted tokens, OAuth fragments, refresh-JSON)
- Test: `user-service/test/*.test.mjs`, `packages/browser-auth` entry tests (injected fetch/locks/channel/clock)

**Interfaces:**
- Consumes: `origin/user-service` at `ac325b3`, `origin/user-service-test` as older reference.
- Produces: standalone trees + shared package skeleton; corrected auth assertions.

- [ ] **Step 1: Write failing check — baseline + stale assertions present**

Run: `test -d user-service/src/auth -a -d auth-profile-web/src/auth && echo BASELINE_PRESENT || echo BASELINE_MISSING; grep -rn "TOKEN_KEY\|localStorage.*token\|accessToken.*hash" user-service/test auth-profile-web/test | head`
Expected: `BASELINE_MISSING` plus stale-assertion hits.

- [ ] **Step 2: Create integration worktree from Aimane**

Run: `git worktree list; git status -sb`
Expected: clean `Aimane`; create `integration/auth-game` worktree via `using-git-worktrees` if isolated.

- [ ] **Step 3: Import `user-service/` + `auth-profile-web/` at `ac325b3`, scaffold `packages/browser-auth`**

Run: `git checkout origin/user-service -- user-service auth-profile-web` (or per-file `git show ac325b3:<path>`); keep `services/game/`, `frontend/`, `packages/` untouched; separate lockfiles, no dep merging. Scaffold `packages/browser-auth/package.json` (dependency-free ESM, no build) + empty `src/client.js`, `src/client.d.ts`, `src/lib/`.
Expected: `user-service/src/auth/guards/access-token.guard.ts`, `auth-profile-web/src/lib/api-client.js` present; `services/game/package.json` unchanged.

- [ ] **Step 4: Correct stale auth assertions to refresh-cookie + memory-only model**

In `user-service/test/*.test.mjs` assert `auth-refresh`, `Path=/auth/`, HttpOnly, `publicSession()` `{ user, accessToken, tokenType:'Bearer', expiresIn }` (no `refreshToken` in body); fix `TOKEN_KEY`/persisted-token/OAuth-fragment/refresh-JSON assertions; `auth-profile-web` asserts memory-only + `clearLegacySession`.
Expected: `grep -rn "LEGACY_TOKEN_KEY" auth-profile-web/src` only in `clearLegacySession`; no test expects readable refresh token.

- [ ] **Step 5: Run baseline suites on fresh disposable DB; define `TEST_PG_URL`/fake-Game rule**

Run: `cd user-service && npm ci && npm test` with `POSTGRES_DB=user_test_*`; document: production-auth Game tests require `TEST_PG_URL` or defined fake Game provider (real `GameService` cannot init with `DEV_PRINCIPAL=false` + empty `DATABASE_URL`).
Expected: PASS; existing data untouched.

- [ ] **Step 6: Commit**

```bash
git add user-service auth-profile-web packages/browser-auth package.json
git commit -m "chore(auth): import user-service ac325b3 baseline and scaffold browser-auth"
```

### Task 2: Add verified-identity interface `GET /auth/principal`

**Files:**
- Create: `user-service/src/auth/principal.controller.ts`
- Modify: `user-service/src/auth/auth.module.ts`
- Test: `user-service/test/principal.test.mjs`

**Interfaces:**
- Consumes: `AccessTokenGuard` (`sub` UUID, `exp` number).
- Produces: `GET /auth/principal -> { userId: string, expiresAt: number }` (ms, `exp*1000`); `401` invalid token or deleted account; `Cache-Control: no-store`.

- [ ] **Step 1: Write failing test**

```js
test('GET /auth/principal returns userId+expiresAt ms; 401 on forged/deleted', async () => {
  const ok = await request(app).get('/auth/principal').set('Authorization', `Bearer ${validToken}`).expect(200);
  assert.equal(ok.body.userId, user.id); assert.ok(Number.isSafeInteger(ok.body.expiresAt) && ok.body.expiresAt > Date.now());
  await request(app).get('/auth/principal').set('Authorization', 'Bearer forged').expect(401);
  await deleteUser(user.id);
  await request(app).get('/auth/principal').set('Authorization', `Bearer ${validToken}`).expect(401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test user-service/test/principal.test.mjs`
Expected: FAIL 404 / controller missing.

- [ ] **Step 3: Implement `PrincipalController` in `user-service/src/auth/principal.controller.ts`**

`@Controller('auth') @Get('principal') @UseGuards(AccessTokenGuard) @Header('Cache-Control','no-store')` → `req.user.sub`, JWT `exp`, `prisma.user.findUnique` exists else `UnauthorizedException`, return `{ userId: sub, expiresAt: exp*1000 }`. Register in `AuthModule`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test user-service/test/principal.test.mjs; cd user-service && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add user-service/src/auth/principal.controller.ts user-service/src/auth/auth.module.ts user-service/test/principal.test.mjs
git commit -m "feat(auth): add GET /auth/principal verified-identity endpoint"
```

### Task 3: Game verification provider `AuthPrincipalClient`

**Files:**
- Create: `services/game/src/auth/auth-principal-client.ts`
- Create: `services/game/src/auth/auth-principal-client.test.ts`
- Create: `services/game/src/auth/test-helpers.ts` (`createTestAppWithVerifier`, fake verifier fixture)
- Modify: `services/game/package.json` (no new auth deps)

**Interfaces:**
- Consumes: `GET http://user-service:3000/auth/principal` Bearer.
- Produces: `class AuthPrincipalClient { verify(accessToken: string): Promise<VerifiedPrincipal> }`, `type VerifiedPrincipal = { userId: string; expiresAt: number }`, `class UnauthorizedError`, `class VerificationUnavailableError`; 2000ms incl. body read; in-flight `Map<string,Promise>` dedup only; validates UUID, finite safe-int ms, `expiresAt > Date.now()` else `VerificationUnavailableError` (malformed). Test helper `createTestAppWithVerifier(fakeVerify)` + `overrideProvider(AuthPrincipalClient)` defined here, used by Tasks 4–5.

- [ ] **Step 1: Write failing tests (incl. minimum-additional subset)**

```ts
test('verify: concurrent dedup then fresh sequential; body stall >2s is 503; malformed UUID/expiry is 503; 401 vs 503 split', async () => {
  const [a, b] = await Promise.all([client.verify(tok), client.verify(tok)]);
  assert.equal(httpHits, 1); await client.verify(tok); assert.equal(httpHits, 2);
  await assert.rejects(() => client.verify('forged'), UnauthorizedError);
  await assert.rejects(() => slowBodyVerify(), VerificationUnavailableError); // first byte fast, body stalls >2s
  await assert.rejects(() => malformedUuidVerify(), VerificationUnavailableError);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/game && npm test -- auth-principal-client`
Expected: FAIL module missing.

- [ ] **Step 3: Implement `AuthPrincipalClient.verify()` in `services/game/src/auth/auth-principal-client.ts`**

`fetch` with `AbortSignal.timeout(2000)`, read + parse JSON inside deadline; in-flight map with `finally` delete; `401` → `UnauthorizedError`; timeout/network/non-200/malformed → `VerificationUnavailableError`; validate UUID regex + `Number.isSafeInteger(expiresAt)` + `> Date.now()`. Export test helper from `test-helpers.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/game && npm test -- auth-principal-client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/game/src/auth/auth-principal-client.ts services/game/src/auth/auth-principal-client.test.ts services/game/src/auth/test-helpers.ts
git commit -m "feat(game): add AuthPrincipalClient verification provider"
```

### Task 4: Connect Game HTTP authentication

**Files:**
- Modify: `services/game/src/game/principal.ts` (Bearer via `AuthPrincipalClient`; `RequestPrincipal { userId, expiresAt }`; `/health`, `/ready` exempt)
- Modify: `services/game/src/game/game.module.ts` (provide + inject `AuthPrincipalClient`; same `matches*`, `lobby*` routes)
- Modify: `services/game/src/game/game.controller.ts`, `lobby.controller.ts` (drop client identity inputs; `POST /matches` still 404 unless dev fixture)
- Test: `services/game/src/game/http-auth.test.ts` (uses Task 3 helper + `TEST_PG_URL`/fake Game provider)

**Interfaces:**
- Consumes: `AuthPrincipalClient.verify`, `createTestAppWithVerifier`.
- Produces: `req.principal = { userId, expiresAt }`; missing/malformed → `401`; `UnauthorizedError` → `401`; `VerificationUnavailableError` → `503`.

- [ ] **Step 1: Write failing test**

```ts
test('HTTP: missing/forged/expired/deleted 401; outage 503; body userId ignored; fixture header/query fails with DEV disabled', async () => {
  await request(app).get('/matches/x/snapshot').expect(401);
  await request(app).get('/matches/x/snapshot').set('Authorization','Bearer forged').expect(401);
  await request(app).post('/matches/x/submit').set('Authorization',`Bearer ${tok}`).send({ userId: victim, code:'1', language:'python' }).expect((r) => assert.actsAsVerifiedNotVictim(r));
  await request(app).get('/matches/x/snapshot').set('x-dev-user-id', victim).expect(401);
  await request(app).get('/health').expect(200); await request(app).get('/ready').expect(200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/game && npm test -- http-auth`
Expected: FAIL (reads `x-dev-user-id`).

- [ ] **Step 3: Implement Bearer middleware in `services/game/src/game/principal.ts`**

Parse `/^Bearer +(\S+)$/i`; inject `AuthPrincipalClient`; map errors to `401`/`503`; set `req.principal`; never read `x-dev-user-id`/`query.user`/body identity; exempt `GET /health`, `/ready`; `DEV_PRINCIPAL` only for explicit dev-suite fixture injection.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/game && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/game/src/game/principal.ts services/game/src/game/game.module.ts services/game/src/game/http-auth.test.ts
git commit -m "feat(game): verify HTTP via Bearer principal"
```

### Task 5: Connect Game socket authentication + output gating

**Files:**
- Modify: `services/game/src/game/socket-auth.ts` (private token store; `attachSocketPrincipal` keeps `{ userId, expiresAt, matchId? }`; token never exposed)
- Modify: `services/game/src/game/game.gateway.ts`, `lobby.gateway.ts`, `team-chat.gateway.ts`, `collab.gateway.ts` (per-message re-verify + pre-emission gating + late-result checks)
- Test: `services/game/src/game/socket-auth.test.ts`, `socket-expiry.test.ts`, extend delayed-admission + runtime-ingress tests

**Interfaces:**
- Consumes: `AuthPrincipalClient.verify`, explicit verifier fixtures for direct gateway construction.
- Produces: handshake `auth:{accessToken, matchId?}` verified at connect; per-message stored-token re-verify + `userId` equality; `disconnect(true)` on expiry/mismatch; per-recipient pre-emission gate; suppressed expired/disconnected acks (success + error); presence cleanup preserved.

- [ ] **Step 1: Write failing tests (minimum-additional subset)**

```ts
test('namespaces reject missing/forged/expired; per-message re-verify; deleted-between-messages 401', ...);
test('expired RPC result suppressed (no success/error ack); expiry before every output category stops emission', ...);
test('token replacement via payload/auth event rejected; fixture auth.userId/query fails DEV-disabled', ...);
test('delayed verify after close/runtime loss cleans presence; accepted submit still completes, never failed evaluation', ...);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/game && npm test -- socket-auth socket-expiry`
Expected: FAIL.

- [ ] **Step 3: Implement `socket-auth.ts` + gateway changes**

Store `client.data.accessToken` privately at handshake; attach `{ userId, expiresAt, matchId }` only. Every `@SubscribeMessage` re-calls `verify(storedToken)`, checks `userId` equality + `expiresAt > Date.now()`, else `disconnect(true)` + `{ ok:false }` suppressed if already expired/disconnected. Wrap every emit (game events, lobby hints, chat/pings, collab updates/cursors/peer-left, snapshot/sync/history) with per-recipient `connected && expiresAt > now && runtimeReady` gate. After each await (auth, membership, presence, join, baseline) recheck expiry + `client.connected` + `runtimeReady`; on fail, run presence cleanup, suppress acks. Never read payload identity. Auth failure throws before engine (accepted Evaluations untouched).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/game && npm test`
Expected: PASS (incl. extended delayed-admission + runtime-ingress).

- [ ] **Step 5: Commit**

```bash
git add services/game/src/game/socket-auth.ts services/game/src/game/*.gateway.ts services/game/src/game/socket-*.test.ts
git commit -m "feat(game): verify sockets per action with gated outputs"
```

### Task 6: Shared browser module + Game wiring (no transport recreation)

**Files:**
- Create: `packages/browser-auth/src/client.js`, `src/client.d.ts`, `src/lib/session.js`, `src/lib/api.js`, `src/lib/coordination.js`; tests `packages/browser-auth/test/*.test.mjs` (injected fetch/locks/channel/clock)
- Modify: `auth-profile-web/src/lib/api-client.js`, `src/lib/session.js`, `src/auth/AuthProvider.jsx` (thin adapters over shared core; keep screens; add `<a href="/play/">Play</a>`; move BroadcastChannel to shared; fix `restoreSession` revival; fix `renew` outage mapping; add `logout pending` marker)
- Modify: `auth-profile-web/vite.config.js` (`cookiePathRewrite` canonical), `auth-profile-web/Dockerfile` (repo-root context, copy `packages/browser-auth` before `npm ci`)
- Modify: `frontend/src/App.tsx`, `frontend/src/arena/socket.ts`, `lobby.ts`, `collab.ts`, `chat.ts` (distinct apiBase/socketBase, `/accounts/me` player ID, stable transports, explicit sidecar renewal, no-replay)
- Test: `frontend/e2e/auth-flow.spec.ts`

**Interfaces:**
- Consumes: `POST /api/auth/refresh`, `GET /api/accounts/me`, `BroadcastChannel` session-control, Web Locks (required).
- Produces: `createBrowserAuthClient({ apiBase, fetchImpl, locks, channel, clock }) -> { getSnapshot, subscribe, restore, login, logout, getAccessToken, fetch, dispose }`; Game stable `SocketArenaTransport({ apiBase, socketBase, getAccessToken, onAuthExpired })` per user/match.

- [ ] **Step 1: Write failing tests**

```js
test('no replay default; single retry only for safe reads; renewal keeps pendingSubmit, renews chat/collab explicitly', ...);
test('restore after logout does not revive; outage retains drafts; logout-pending blocks bootstrap; late results rejected by generation', ...);
test('logout closes all sockets cross-tab; no mutation resent; fresh baselines before resume', ...);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/browser-auth && npm test; cd ../../frontend && npm test -- auth`
Expected: FAIL.

- [ ] **Step 3: Implement shared client + adapters + Game wiring**

Shared: private memory-only token + `sessionGeneration` + `tokenRevision`; one origin-wide lock for login/register/restore/refresh/logout; `fetch` default no-retry + `retrySafeRead` opt-in; `401` → anonymous; network/5xx/timeout → unavailable (pause, retain); `restore` captures generation, no unconditional `replace`; `logout` clears locally + disconnects all registered sockets immediately, broadcasts control, then serializes server logout, sets `logout pending` on failure; require Locks + BroadcastChannel. Adapters: Saad api/session/AuthProvider delegate to shared; `X-Requested-With` + Origin/Referer on cookie endpoints; expire legacy root cookie. Game: `/play/` auto-live (no `?user=`/`live`/mock prod), player ID from `/accounts/me`, `Authorization: Bearer` + `auth:{accessToken, matchId}`, 401 → renew → fresh-socket-in-same-transport + refetch snapshot/sync/history (no command resend; keep `pendingSubmit`, chat retry IDs, Yjs copy); sidecars subscribe to shared renewal signal.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/browser-auth && npm test; cd auth-profile-web && npm test; cd ../frontend && npm test && npx playwright test e2e/auth-flow.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/browser-auth auth-profile-web frontend
git commit -m "feat(web): share browser-auth, stable transports, Play link"
```

### Task 7: HTTPS integration (Compose + gateway + cookies + limits)

**Files:**
- Modify: `docker-compose.yml` (add `user-db`, `user-service`, gateway static build; no import of Saad root `compose.yaml`; separate volumes `pgdata`/`userpgdata`)
- Create: `infra/gateway/Dockerfile` (multi-stage: Node 22 Arena → `/usr/share/nginx/html/play/`, Node 24 auth → `/usr/share/nginx/html/`)
- Modify: `infra/nginx/nginx.conf` (routing, rewrites, fallbacks, limits, logs)
- Modify: `.env.example` (separate `GAME_DB_*`/`USER_DB_*`, JWT keys, superadmin bootstrap, `AUTH_FRONTEND_URL`, 4 SMTP settings, `DEV_PRINCIPAL=false`)
- Modify: `infra/postgres/init-db.sh`
- Test: `scripts/https-smoke.sh`

**Interfaces:**
- Consumes: Tasks 2–6 routes.
- Produces: `https://<host>/` auth SPA, `/play/` game SPA, `/api/*` user-service (`proxy_cookie_path /auth/ /api/auth/` incl. OAuth cookies), `/api/game/` + `matches|lobby` + `/socket.io/` game, `/play→/play/` redirect, SPA fallbacks excluding `/api/*`, `/socket.io/*`.

- [ ] **Step 1: Write failing smoke check**

```bash
./scripts/https-smoke.sh  # /api/auth/refresh sets Path=/api/auth/ HttpOnly Secure SameSite=Lax; legacy root cookie expired; /api/game/ 401 no token; /socket.io/ reachable; /play/ game; / login; /play→/play/ redirect; X-Requested-With/Origin enforced; game/socket NOT under api_all 67r/m; gateway log omits query
```
Expected: FAIL.

- [ ] **Step 2: Extend Compose + gateway + Nginx + env**

Compose standalone user-service/user-db + static gateway (repo-root contexts for `packages/browser-auth` copy). Nginx: exact-path credential limits (`/api/auth/login|register|password-reset/*`), no blanket limit on `/api/game/`, `/socket.io/`; `proxy_cookie_path`; CSRF (custom header + Origin/Referer) on cookie endpoints; query-free access log. Env documents all required keys. `init-db.sh` creates both roles/DBs on separate storage.

- [ ] **Step 3: Run smoke + builds**

Run: `npm run certs; cp .env.example .env; npm run up; ./scripts/https-smoke.sh; nginx -t`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml infra/nginx/nginx.conf infra/gateway/Dockerfile .env.example infra/postgres/init-db.sh scripts/https-smoke.sh
git commit -m "feat(infra): HTTPS compose with standalone user stack and static SPAs"
```

### Task 8: Documentation + full verification

**Files:**
- Modify: `docs/auth-game-contract.md`, `docs/game-local-run.md`, `docs/adr/*auth*`, `docs/42-subject-compliance.md`
- Test: full suites + HTTPS `live-1v1`, `live-2v2` + renewal/outage/logout matrix + independent review

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: contract (`AuthPrincipalClient`, `VerifiedPrincipal`, Bearer/socket shapes, `401`/`503`, 2s incl. body, dedup, gating, late-result, no-replay, generation, `logout pending`), run (certs, disposable DBs/volumes, password-login → `/play/` → Lobby → Match, `DEV_PRINCIPAL=false`, separate dev suite), architecture (private `user-service:3000`, routing table, separate DBs, Node versions, static gateway), compliance (ownership, ≤15min token, no `?user=` prod, narrow cookies, CSRF, scoped limits, query-free logs).

- [ ] **Step 1: Update docs**

Contract + run + architecture + compliance per Interfaces; record `TEST_PG_URL`/fake-provider rule, `/health`+`/ready` exemption, Web Locks/BroadcastChannel requirement, required env (JWT, superadmin, `AUTH_FRONTEND_URL`, SMTP x4).

- [ ] **Step 2: Run full checks and builds**

Run: `cd services/game && npm test && npm run build && npm run typecheck; cd ../../user-service && npm test; cd ../packages/browser-auth && npm test; cd ../auth-profile-web && npm test && npm run build; cd ../frontend && npm test && npm run build; npm run check`
Expected: PASS with `DEV_PRINCIPAL=false`.

- [ ] **Step 3: HTTPS browser matrix + independent review**

Run: `npx playwright test frontend/e2e/live-1v1.spec.ts frontend/e2e/live-2v2.spec.ts` over HTTPS (real login → `/play/` → Lobby → playable Match; hard reload; concurrent tabs; logout during bootstrap/renewal; outages; renewal in every namespace; fresh baselines; no replay; accepted evaluations complete after expiry).
Expected: PASS + reviewer sign-off.

- [ ] **Step 4: Commit**

```bash
git add docs frontend/e2e scripts
git commit -m "docs(auth-game): update contract, run, architecture, compliance evidence"
```
