# Game service — local run, env, and known limitations

Scope: the Game service, its local fixtures and its Account-integrated Compose
stack. Game owns the Lobby, Match, Round, judging, shared editing and Team chat.
User Service owns login, JWT and OAuth; Game uses its verified-principal API.
See the [auth contract](auth-game-contract.md).

The [manual testing guide](manual-game-testing.md) is the current command and
fixture reference, including the repeatable 20-stage wizard. In particular,
development query identities need a DEV Vite server, not production preview.

## Local run (host services + real judging)

For normal manual play, use the real-auth Compose stack below. Use Node 22 for
root commands. First create the
[disposable PostgreSQL fixture](manual-game-testing.md#disposable-postgresql-fixtures)
and export its `TEST_PG_URL` in the test terminal. These tests clear fixture
tables and can create temporary databases. Never use an application database or
load the application's `.env` into this terminal.

```sh
# Create application settings only if missing; never commit real secrets.
test -f .env || cp .env.example .env
npm ci
npm run check
npm run build
TEST_PG_URL="${TEST_PG_URL:?Set TEST_PG_URL to the disposable test database}" \
  DATABASE_URL="$TEST_PG_URL" ARENA_DIAGNOSIS_DOCKER=1 npm test
```

Both database variables point to the same disposable Game test database.
`TEST_PG_URL` enables ownership and live-process tests; `DATABASE_URL` enables
the remaining PostgreSQL cases. `ARENA_DIAGNOSIS_DOCKER=1` includes the real
container timeout cleanup check. Run heavy root and browser suites in sequence.
Standalone Account/User Service tests use Node 24 and separate fixtures; see the
[manual testing guide](manual-game-testing.md#6-automated-commands-you-can-run-yourself).

The following host fixture uses development identities. It is separate from
real-auth Compose and does not prove password login or session recovery.

Live browser (game on :3220, web on :4173): Game binds `0.0.0.0`, even
when Vite binds loopback. Run this dev-identity fixture only inside the
[disconnected VM described in the manual guide](manual-game-testing.md#b-development-only-game-identity-and-mock-ui),
with dependencies/images cached first. Use real-auth Compose for normal play on
a connected workstation.

```sh
npm run build:packages
npm run build --workspace arena-game
# terminal 1 — explicitly selected disposable DB, or empty URL for in-memory dev
PORT=3220 DATABASE_URL= DEV_PRINCIPAL=true JUDGE_BACKEND=container \
  node services/game/dist/main.js
# terminal 2 — DEV Vite is required for ?live=1&user=... fixtures
VITE_GAME_URL=http://localhost:3220 npm run dev --workspace arena-frontend -- \
  --host 127.0.0.1 --port 4173 --strictPort
# terminal 3 — select dev journeys; do not mix all fixture types in one bare run
E2E_GAME_URL=http://localhost:3220 E2E_WEB_URL=http://localhost:4173 \
  npx playwright test e2e/live-lobby.spec.ts e2e/live-1v1.spec.ts e2e/live-2v2.spec.ts
# Run the browser command from frontend/. Select Node 22 in each terminal.
```

The E2E commands above use the **separate dev suite**: it runs with
`DEV_PRINCIPAL=true` and the `x-dev-user-id` / `?user=` seams, and never
touches the Compose auth stack. Auth-matrix proof (real login, renewal,
outage, logout) runs against Compose with `DEV_PRINCIPAL=false` instead.

## Production-like stack (Compose + Nginx + HTTPS/WSS)

The following commands use the base Compose file. For an existing local stack
with an override, keep its `-f docker-compose.yml -f <override-file>` arguments
on every command. For example, the optional local mail fixture adds an eighth
service; omitting its override can change User Service mail settings.

```sh
# Create settings only if missing. Use .env.example to fill values in .env:
# JWT key pair, SUPERADMIN_* trio, AUTH_FRONTEND_URL, SMTP settings,
# GAME_DB_*/USER_DB_* passwords and JUDGE_WORKER_TOKEN.
test -f .env || cp .env.example .env
# Use DEV_PRINCIPAL=false and AUTH_FRONTEND_URL=https://localhost.
# Keep existing certificates. Check their validity first:
openssl x509 -in infra/nginx/certs/localhost.crt -noout -dates
# If the certificate/key is missing or the certificate is expired:
# npm run certs

docker compose --project-name ft-transcendence config --quiet
docker compose --project-name ft-transcendence up -d --build
docker compose --project-name ft-transcendence ps
```

The first start creates Game and Account databases on separate named volumes
(`pgdata`, `userpgdata`). Later starts reuse them. Superadmin bootstrap runs only
when no SUPERADMIN exists. Preserve existing volumes, settings and accounts.
The generated certificate is local and self-signed; production needs a trusted
certificate. See the [manual guide's readiness probes](manual-game-testing.md#a-real-password-login-and-normal-manual-play-recommended)
to check Game and Judge separately. The legacy `scripts/https-smoke.sh` has
cookie/origin limits documented in that guide; it is not the full auth proof.

### Current real-auth proof

Full-stack auth proof (`DEV_PRINCIPAL=false`, the Compose default): password
login at `https://localhost/` → `{ user, accessToken, expiresIn: 900 }` (no
refresh in body) → follow the topbar **Play** link to `/play/` → Lobby
(`/api/lobby/active` 200 with Bearer, 401 without) → private invitation Lobby →
playable Match over WSS (Bearer HTTP + `auth: { accessToken, matchId }`
sockets). Game verifies every token against private `user-service:3000`
(`GET /auth/principal`); `/api/lobby/` + `/api/matches/` route to game as the
canonical split (see `auth-game-contract.md`), everything else under `/api/`
to user-service. Game and accounts persist on separate databases
(`game_db`/`game_user` vs `user_db`/`user_user`).

The [auth evidence](auth-integration-repair-evidence.md) records the completed
2026-10-14 real-browser login, session renewal, idle-expiry recovery, outage and
logout checks. The later [starter repair evidence](starter-execution-repair-evidence.md#applied-maximum-input-repair-locally--2026-10-20)
records 12/12 1v1 network checks, 16/16 four-player 2v2 network checks and 6/6
maximum-input worker checks on the rebuilt local stack. Both Match proofs used
normal password login, private Lobbies and three scored Rounds. These later
checks used network clients; they do not prove four browser windows, separate
computers, live OAuth, external email or a public deployment.

The [frontend repair evidence](frontend-repair-evidence.md) records the newer
2026-10-22 checkpoint at `97e7492`: **811 root tests passed, zero skipped**,
plus checks and build. The forfeit result passed an actual two-browser check
with no Round Reveal: the leaving player sees “You forfeited”, the other
player sees the win, and both reloads retain the result. Temporary Chromium
contexts used a local TLS exception; certificate and hostname validation
passed separately. Four-player manual layout/chat/full-Match acceptance and
the rest of the manual pass remain open. These are dated checkpoints, not a
claim that the suites run on every startup.

### Historical dev-identity HTTPS proof

The earlier single-host path was exercised from a fresh Compose container start:
worker and Game readiness, HTTPS Run, two concurrent Submits, hidden evaluation,
and score reveal over WSS, twice in the live 1v1 browser scenario. Both players
used the Nginx HTTPS origin; the browser checked that hidden-marker values were
absent after reveal. Nginx has no judge-worker upstream or route, and a public
GET to `/v1/run-visible` reaches the Account HTML fallback (HTTP 200), not a
Judge endpoint. Do not use a 404 expectation as the privacy test. This older proof used the dev identity
fixture and a local self-signed certificate; it is not external-auth or
production-certificate evidence. HTTPS health, HTTP→HTTPS redirect, and the
Game `/collab`, `/chat`, and `/lobby` WSS namespaces are also routed through
Nginx. Platform chat is outside this game-only snapshot; first-release match
chat remains inside Game.

### Database configuration

`DATABASE_URL` for game is wired in `docker-compose.yml` from the
`GAME_DB_*` vars (least-privilege role per ADR-0002). PostgreSQL ownership is
required whenever DATABASE_URL is set. Without DATABASE_URL, startup requires
DEV_PRINCIPAL=true to use memory for an explicit local fixture.

## One active Game server

Code Arena supports one active Game process per Game database. One process can
serve many Matches. Different databases can have independent Game processes.
A second process using the same database exits before recovery and listen.

For the first installation of this guard, stop every older Game process before
starting the new version. Do not overlap an older unguarded version with this
version. For later updates, stop the current Game process, then start the new
process. Keep the database running and retain the ownership table.

Ownership loss stops admission, event output, timers and local worker request
waits. All four socket namespaces disconnect. The application has a 5-second
stop deadline after it detects loss. Start a replacement explicitly; there is
no standby election or automatic takeover. Remote worker jobs can continue
until their existing limits.

`/health` reports process liveness. `/ready` also checks the Game runtime and
its ownership state. TCP reachability alone does not make Game ready. While
transport remains open, unavailable Game requests receive HTTP 503; a closed
transport can instead report a connection failure.

A command that committed before its reply was lost stays accepted. Refresh
saved state after restart. Keep the existing immutable Submit IDs for a retry.
Do not automatically replay other commands.

## Required env

- `DATABASE_URL` (host runs) — Postgres connection for matches,
  submissions, reveals, lobby, collab docs.
- `VITE_GAME_URL` (frontend build time) — game base URL. No silent
  localhost fallback: `?live=1` without it renders a visible error
  (pinned by `frontend/test/live-config.test.ts`).
- `DEV_PRINCIPAL=true` (dev/test only) — enables the `x-dev-user-id`
  test seam and the dev-only `POST /matches` fixture. It also permits memory
  startup when DATABASE_URL is absent; it never bypasses PostgreSQL ownership. Production (real
  auth middleware, seam off) returns 401 without a principal and 404
  for the fixture.
- `RECONNECT_GRACE_MS` (default 90000, spec window 60–90s).
- Judge quotas come from `SPIKE_LIMITS` (see `docs/decisions/judge-isolation.md`).
- `JUDGE_WORKER_TOKEN` (Compose required) — private Game↔worker bearer secret;
  generate a random value and keep it out of source control. Compose gives it
  only to Game and the worker; other services do not inherit the `.env` file.
- `JUDGE_DOCKER_SOCKET` — host Docker socket path mounted only into the worker
  (default `/var/run/docker.sock`; set the Docker Desktop socket path if needed).
- `JUDGE_PYTHON_IMAGE` and `JUDGE_GCC_IMAGE` — runner images the worker checks
  before readiness and pulls if absent.
- `JUDGE_WORKER_CONCURRENCY` (2), `JUDGE_WORKER_MAX_QUEUE` (8),
  `JUDGE_WORKER_QUEUE_TIMEOUT_MS` (30000), and
  `JUDGE_WORKER_JOB_TIMEOUT_MS` (900000) — bounded worker capacity and limits.
- `JUDGE_WORKER_TIMEOUT_MS` (930000) — Game's HTTP deadline, slightly longer
  than the worker execution deadline.
- Keep `DEV_PRINCIPAL=false` in the real-auth Compose stack. The development
  identity and direct-Match fixture described above must stay off there.

## Judge boundary and host requirements

Compose selects the authenticated `worker` backend explicitly. Game reaches it
over the private `judge-internal` network; it has no published port and Nginx
is not on that network. The worker alone mounts the host Docker socket. It has
no database credentials. The Docker daemon and runner images must be available
before the worker becomes ready; missing images are pulled during startup.
Compose reads `.env` for variable substitution but passes only declared values
to each container: Postgres gets its database bootstrap settings, Game gets
its Game database URL, and only Game and the worker get the judge token.

Each test case runs in a fresh player container. The trusted worker keeps the
expected answer and remaining hidden suite in memory. It sends source, current
input and runner code through byte-length-framed Docker stdin, then compares the
captured output itself. The case payload cap is 8 MiB; the worker's aggregate
HTTP request cap remains 2 MiB. Several large cases can exceed the HTTP cap even
if each case fits. See the [transport evidence](starter-execution-repair-evidence.md#maximum-input-transport-and-shared-metadata--2026-10-20).

Player containers receive no expected answer, other hidden input, worker token,
service credential, socket, host mount, or Compose network. The current test
input is observable to the program being executed. Containers use
`--network none`, a read-only root, `nobody`, dropped capabilities,
`no-new-privileges`, bounded tmpfs scratch, CPU/memory/pid limits, output
limits, and automatic removal.

The example worker runs two judge requests at once and queues at most eight;
queue saturation, execution timeout, Docker failure, or worker unavailability
is an infrastructure error. Game records the failure, does not count a
submission, and does not silently fall back to another judge. Existing recovery
retries use the same configured backend. Local development still defaults to
`JUDGE_BACKEND=container` and requires Docker plus the Python and GCC images;
Judge0 remains an explicit optional backend.

The host needs a running Docker Engine/Desktop daemon, socket access for the
worker, disk space for the application and runner images, and capacity for the
other Compose services. As an initial single-host allocation, use at least two
CPU cores and 4 GB RAM; two concurrent player containers can each use up to
256 MB and one CPU under the current limits. This is an operating baseline,
not a measured capacity guarantee. Horizontal judge scaling and a separate
judge host remain later work.

## Lobby flow

The first-release UI uses private invitation Lobbies:

1. Select 1v1 or 2v2 and create a room (`POST /lobby/rooms`).
2. Share the six-character invitation code. The room expires after 20 minutes.
3. Other Users join with that code and choose a side with space.
4. Every player selects **Ready Up**. Each side needs one player for 1v1 or two
   players for 2v2. Only the host can select **Start Match** once all are ready.

Reconnect fetches `/lobby/active`. Socket hints trigger a fresh state fetch;
they do not replace authoritative state. Public queue APIs remain available
for a future release, but queue entry is hidden in this UI. A recovered waiting
queue entry is canceled. See [ADR-0013](adr/0013-match-deadline-lobby-and-event-convergence.md).

## 1v1 / 2v2

1v1: private editor, independent Run/Submit, auto-reveal when both
sides counted. 2v2: one shared Yjs document per team (server is the
authority; client payload ignored at submit), both-teammates-ready
gating bound to the current document revision, team chat + pings on
the `/chat` namespace, no chat in 1v1.

## Known limitations (first release)

- One active Game process per database is enforced. Socket fan-out, live
  Presence, collab Y.Docs, chat history (25/room), and rate limits stay local.
  Multiple active Game servers would need shared Match authority, Presence
  and event delivery. A shared broadcast adapter alone is insufficient.
- Game HTTP CORS and all four socket namespaces still use `origin: true`.
  Real authentication is integrated, but exact-origin restriction remains open.
  Use the same-origin Nginx entry; do not treat the current setting as a
  production origin policy.
- A 1v1 disconnect beyond the configured grace can cause a forfeit; deliberate
  Leave forfeits immediately. The team must still confirm the disconnect-forfeit
  rule for final acceptance. This documentation change does not change that rule.
- `tests.updated` visible-test status broadcasts to the whole match
  room; the UI only renders the caller's filtered snapshot, so no
  hidden data, source, or score leaks — narrowing delivery is optional
  hardening, not a leak fix.
