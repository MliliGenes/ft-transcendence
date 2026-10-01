# Nook / Code Arena

Code Arena is Nook's first-game implementation baseline for the 42
`ft_transcendence` project. It supports invitation-based 1v1 and 2v2 coding
matches, visible example runs, sealed hidden judging, score reveals,
reconnection, shared 2v2 editing, readiness, and match-scoped team chat.

This branch is intentionally game-only. The teammate user service and
standalone chat experiments remain on their own branches until their contracts
and ownership are reviewed together.

## Repository map

| Path | Responsibility |
| --- | --- |
| `frontend/` | React/Vite arena, lobby, editor, reconnect, collaboration, and chat UI |
| `packages/arena-model/` | Shared match types, phases, events, and scoring vocabulary |
| `packages/arena-game/` | Authoritative game engine, persistence, lobby, judge adapters, and collaboration |
| `packages/arena-harness/` | Lightweight lifecycle proof harness |
| `packages/problem-bank/` | Validated problem definitions and hidden suites |
| `services/game/` | NestJS HTTP and Socket.IO adapter over the game engine |
| `services/judge-worker/` | Private worker that executes untrusted code through isolated containers |
| `infra/` | Nginx TLS/WSS ingress and game-database bootstrap |
| `docs/` | Runbook, architecture, contracts, ADRs, references, and compliance evidence |

The game rules and domain language live in [CONTEXT.md](CONTEXT.md). The wider
Nook product direction remains in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Prerequisites

- Node.js 22 and npm
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
DATABASE_URL=postgres://postgres:postgres@localhost:5433/arena_test \
  npm test
```

See [docs/game-local-run.md](docs/game-local-run.md) for host-mode, Compose,
judge-worker, and browser-test instructions.

## Local play

For a quick development game using the explicit test identity seam:

```sh
npm run play
```

Use `npm run play -- lan` to expose the local preview on your LAN.

For the HTTPS/WSS stack:

```sh
cp .env.example .env
# Replace every placeholder, especially JUDGE_WORKER_TOKEN.
npm run certs
npm run up
```

Only Nginx exposes host ports. The judge worker is private and is the only
application container with the Docker socket. The React frontend is currently
built/previewed separately; joining it to the public Compose entry point is
still integration work.

## Team integration seams

- `origin/user-service` owns account, profile, JWT/OAuth, and verified-principal
  work. Game consumes only the principal contract documented in
  [docs/auth-game-contract.md](docs/auth-game-contract.md).
- `origin/amal` contains a standalone chat UI and mock WebSocket server. Code
  Arena already owns its match-scoped `/chat` namespace, so platform-chat and
  match-chat ownership must be reconciled before those branches are combined.
- Package versions differ across the branches. A future unified workspace must
  explicitly reconcile NestJS, React, Vite, TypeScript, and test-tool versions.

No teammate branch was merged or rewritten by this import.

## Known limitations

- Production authentication is not connected; `DEV_PRINCIPAL` is strictly a
  local/test seam.
- Match-chat history and realtime fan-out are process-local.
- Horizontal Game scaling still needs shared fan-out and broader command
  coordination.
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
