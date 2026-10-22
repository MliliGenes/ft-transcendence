# Nook / Code Arena

Code Arena is Nook's first-game implementation baseline for the 42
`ft_transcendence` project. It supports invitation-based 1v1 and 2v2 coding
matches, visible example runs, sealed hidden judging, score reveals,
reconnection, shared 2v2 editing, readiness, and match-scoped team chat.

This branch includes the Account frontend and User Service integrated with Code
Arena under one HTTPS origin. Real password login, Account Play, Lobby and
playable 1v1/four-player 2v2 have local service-backed proof with
`DEV_PRINCIPAL=false`. Platform chat and final team-wide acceptance remain
separate integration work.

## Repository map

| Path | Responsibility |
| --- | --- |
| `auth-profile-web/` | Account frontend: login, profile and Play entry to Arena |
| `user-service/` | Account, JWT/OAuth, verified-principal API and separate account database schema |
| `frontend/` | React/Vite arena, lobby, editor, reconnect, collaboration, and chat UI |
| `packages/browser-auth/` | Shared browser session lifecycle, token renewal and cross-tab coordination |
| `packages/arena-model/` | Shared match types, phases, events, and scoring vocabulary |
| `packages/arena-game/` | Authoritative game engine, persistence, lobby, judge adapters, and collaboration |
| `packages/arena-harness/` | Lightweight lifecycle proof harness |
| `packages/problem-bank/` | Validated problem definitions and hidden suites |
| `services/game/` | NestJS HTTP and Socket.IO adapter over the game engine |
| `services/judge-worker/` | Private worker that executes untrusted code through isolated containers |
| `infra/` | Nginx TLS/WSS ingress, both static frontends and separate database bootstrap |
| `docs/` | Runbook, architecture, contracts, ADRs, references, and compliance evidence |

The game rules and domain language live in [CONTEXT.md](CONTEXT.md). The wider
Nook product direction remains in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).
Start at the [docs index](docs/README.md) for current guides, dated evidence and
historical references. The [visual repository map](.agent-native/visual-docs/repo-overview/plan.mdx)
shows source files and the remaining work; see the [viewer instructions](.agent-native/README.md).

## Prerequisites

- Node.js 22 and npm for the root workspace; Node.js 24 for standalone Account/User Service builds
- Docker Engine or Docker Desktop with Compose
- OpenSSL for local development certificates
- Modern Chrome for Playwright journeys

## Install and verify

```sh
npm ci
npm run check:repository
npm run lint
npm run typecheck
npm run build
```

The complete root test suite needs Docker, localhost access and a disposable
PostgreSQL database. First create the
[disposable test fixture](docs/manual-game-testing.md#disposable-postgresql-fixtures)
and export its `TEST_PG_URL` in the test terminal. Tests clear fixture tables;
never use the application database or copy its `.env` into the test terminal.
With Node 22 selected, run:

```sh
TEST_PG_URL="${TEST_PG_URL:?Set TEST_PG_URL to the disposable test database}" \
  DATABASE_URL="$TEST_PG_URL" ARENA_DIAGNOSIS_DOCKER=1 npm test
```

Latest recorded verification, 2026-10-22 at `97e7492`: **811 root tests passed,
zero skipped**; `npm run check` and `npm run build` passed. The forfeit screen
also passed a real two-browser check before any Round Reveal, including live
delivery and reload. Those temporary Chromium contexts used a local TLS
exception; server certificate and hostname validation passed separately. See
the [frontend repair evidence](docs/frontend-repair-evidence.md) for the test
boundary and open manual checks.

The earlier rebuilt-stack proof on 2026-10-20 passed
12/12 1v1 checks, 16/16 four-player 2v2 checks and 6/6 maximum-input worker checks.
The 1v1 and 2v2 proofs used real password login, private Lobbies and three sealed
Rounds. They used HTTPS/WSS network clients, not four browser windows or separate
computers. See the [starter and maximum-input repair evidence](docs/starter-execution-repair-evidence.md).
These are dated results, not tests run when this README is opened. The root
suite does not include the standalone Account/User Service or browser suites;
see the [manual testing guide](docs/manual-game-testing.md#6-automated-commands-you-can-run-yourself).

Auth integration was verified on 2026-10-14: 764 root tests passed; all 19
optional cases also passed in an earlier unchanged 47-case fixture run, for 783
distinct root cases. The real HTTPS suite passed five groups with a normal
browser clock and five with a clock 60 seconds slow, including automatic
recovery after the normal 900-second token lifetime. Root checks/builds and the
independent repair reviews passed. These are recorded results, not a new test
run or public-deployment proof.

See the [auth integration evidence](docs/auth-integration-repair-evidence.md)
and [independent sign-off](docs/superpowers/reviews/2026-10-14-auth-integration-signoff.md)
for commands, checkpoints, review boundaries and remaining limits.

See [docs/game-local-run.md](docs/game-local-run.md) for host-mode, Compose,
judge-worker, and browser-test instructions.

## Manual testing and test commands

Run the repeatable 20-stage human test wizard:

```sh
bash scripts/manual-game-test.sh
# Inspect stages without opening a browser:
bash scripts/manual-game-test.sh --list
```

The [manual testing guide](docs/manual-game-testing.md) includes setup, expected
results, code samples, API probes, automated suites, browser debugging, isolated
failure tests and known fixture limits. Results stay in ignored local reports;
the wizard does not run service mutations or capture credentials.

## Local play

For development-identity gameplay in an isolated VM, use the two-terminal DEV Vite procedure in
[the manual testing guide](docs/manual-game-testing.md#b-development-only-game-identity-and-mock-ui).
The current `npm run play` wrapper serves a production preview, which correctly
rejects query identities; it is not the supported dev-identity path. Use the
normal HTTPS login flow below for Account/Game integration tests.

For the HTTPS/WSS stack, use the base commands below on a new setup. If your
local stack already uses a Compose override, such as the optional local mail
fixture, keep the same `-f docker-compose.yml -f <override-file>` arguments for
every Compose command. Omitting the override can change service settings.

```sh
# Create settings only if missing. Keep existing settings and secrets.
test -f .env || cp .env.example .env
# On first setup, use .env.example as a reference and fill the values in .env.
# Set DEV_PRINCIPAL=false and AUTH_FRONTEND_URL=https://localhost.
# Check the existing local certificate before replacing it:
openssl x509 -in infra/nginx/certs/localhost.crt -noout -dates
# If the certificate/key is missing or the certificate is expired:
# npm run certs

docker compose --project-name ft-transcendence config --quiet
docker compose --project-name ft-transcendence up -d --build
docker compose --project-name ft-transcendence ps
```

Starting this Compose project reuses its existing volumes. Keep application
data separate from disposable test databases. Open `https://localhost/login`,
sign in, then select **Play**. In the Lobby, create a private 1v1 or 2v2 room,
share its invitation code, and wait for all players to join and select **Ready
Up**. The host can then select **Start Match**. Public queue entry is hidden in
the first-release UI; its backend remains for a future release.

Only Nginx exposes host ports. The judge worker is private and is the only
application container with the Docker socket. The gateway image builds the
account App at `/` and the Game App at `/play/`. Both use the public `/api` base.
Production requires real sign-in with `DEV_PRINCIPAL=false`.

Set `AUTH_FRONTEND_URL` to the public HTTPS origin. Optional GitHub and Discord
credentials belong only to User Service. Register each provider's login and link
callbacks under `/api/auth/`; `.env.example` lists the settings. See the
[auth contract](docs/auth-game-contract.md) for cookie and session rules.

Game supports one active process per Game database. A duplicate exits before
recovery. Stop all older unguarded Game processes for the first installation.
See the [one-server run instructions](docs/game-local-run.md#one-active-game-server)
for updates, ownership loss and deliberate restart.

## Team integration seams

- Account and User Service were integrated from Saad's `origin/user-service`
  reference at `ac325b3`; `user-service-test` was an older test reference. The
  imported code is present in this branch. Compare later teammate changes before
  final integration; this document does not claim a fresh remote-branch review.
  Game consumes the [verified-principal contract](docs/auth-game-contract.md).
- Teammate branch snapshot, fetched 2026-10-22: `origin/amal` at `b490a59`
  includes Account admin integration and a Messages UI with test data.
  `origin/chat-foundation` at `6f1e530` adds authenticated, stored Direct Messages
  and history. Its real User Service integration remains pending. These changes
  are not merged into this branch, and their tests were not rerun here.
  Keep Direct Messages separate from Game-owned Team chat inside a 2v2 Match.
  See the [Messages UI limits](https://github.com/MliliGenes/ft-transcendence/blob/b490a59/gamechat/src/messages/README.md)
  and [Chat integration checkpoint](https://github.com/MliliGenes/ft-transcendence/blob/6f1e530/chat-service/CHAT02.md).
- The same fetch found `origin/nook-client` at `a6b495b`; its home page remains
  a placeholder. A separate `origin/game-service-revised` branch is at
  `0e669f5`. Neither branch was merged, installed or tested by this delivery.
  Compare their contracts and changes before team integration.
- Account/User Service keep their own lockfiles and Node 24 builds; the root
  Game workspace uses Node 22. Any later dependency unification must explicitly
  reconcile NestJS, React, Vite, TypeScript and test-tool versions.

The original game extraction and subsequent auth integration used selected source
imports; no complete teammate branch merge or rewrite is claimed.

## Known limitations

- Password authentication is connected and proved locally with
  `DEV_PRINCIPAL=false`. Live GitHub/Discord OAuth and external SMTP delivery
  remain unproved; local callback/cookie/configuration tests do not replace
  those provider checks. `DEV_PRINCIPAL=true` is strictly a local/test seam.
- Match-chat history and realtime fan-out are process-local.
- Multiple active Game servers require shared Match authority, Presence and
  events. The current release enforces one active server per database.
- Production certificates, policy pages, final contribution records, and 42
  module demonstrations remain team deliverables.
- A passing implementation test is evidence for that behavior, not automatic
  proof of a complete 42 module.

## Provenance

The game was imported as a curated snapshot from
`https://github.com/aymanysr/code_arena_course.git` at commit
`243e3e7c468ee946f9d7f52a598f15aa4c3ca70e`. Course content, scratchpads,
agent configuration, generated graphs/builds, screenshots, result output,
historical puzzle-game artifacts, and placeholder Core/Chat services were not
imported. See [ADR-0014](docs/adr/0014-code-arena-extraction.md).
