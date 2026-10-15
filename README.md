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

The complete test suite includes Docker-, localhost-, and PostgreSQL-dependent
checks. Run it on a development host where those capabilities are available:

```sh
TEST_PG_URL=postgres://postgres:postgres@localhost:5433/arena_test \
  npm test
```

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

For the HTTPS/WSS stack:

```sh
cp .env.example .env
# Replace every placeholder, especially JUDGE_WORKER_TOKEN.
npm run certs
npm run up
```

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
- `origin/amal` contains a standalone chat UI and mock WebSocket server. Code
  Arena already owns its match-scoped `/chat` namespace, so platform-chat and
  match-chat ownership must be reconciled before those branches are combined.
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
