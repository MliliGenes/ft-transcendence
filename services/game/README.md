# Game service

## Overview

The `arena-game` workspace runs the Nest HTTP and Socket.IO adapter over the
Arena engine. Game owns runtime composition and transport admission; engine
entry points own Match rules. Identity verification and private judging are
external dependencies.

## Subdirectories & Boundaries

[src](./src/README.md) owns the Game process, principal client and gameplay transport adapters.

## Interface

- [src](./src/README.md) documents startup, `/health`, `/ready`, shutdown,
  principal verification and Match/Lobby/collaboration/Team chat adapters.
- [package.json](./package.json) defines `build`, `start`, `test` and `typecheck`.
  The production start command runs `dist/main.js`; the default Game port is 3002.
- [Dockerfile](./Dockerfile) packages the process for the
  [Compose stack](../../docker-compose.yml).
- [Judge worker](../judge-worker/README.md) supplies private execution.
- The engine is consumed through supported
  [package entry points](../../packages/README.md), never private nested files.
- The [runbook](../../docs/game-local-run.md) and
  [manual guide](../../docs/manual-game-testing.md) define environment setup.

## Invariants

- One active Game process owns each Game database. Production persistence
  obtains ownership before schema setup and recovery; loss closes admission
  and starts terminal shutdown. There is no automatic standby takeover.
- Memory startup without a database and direct Match creation require the
  explicit `DEV_PRINCIPAL=true` fixture. PostgreSQL ownership still applies
  whenever a database is configured.
- Normal Game identity comes from the verified-principal client. The external
  identity service implementation is outside this workspace contract.
- `/health` is liveness, not readiness. `/ready` also requires an available
  runtime; TCP probes alone do not prove authenticated storage or gameplay.
- The engine owns membership, phase and score authority. The configured Judge
  backend is explicit; infrastructure failure does not activate a fallback.
- Disconnect is Presence loss, distinct from deliberate Leave. Runtime loss
  disconnects four namespaces and uses a five-second forced-exit deadline;
  this does not guarantee complete draining or remote-job cancellation.

## Side Effects

- Opens listeners and socket rooms, emits events and makes principal requests.
- Acquires database ownership, initializes and recovers stores, persists engine work
  and schedules Match/Lobby/Presence timers.
- Requests judging and performs bounded lifecycle cleanup on signals or loss.

## Verification

From the repository root with Node 22:

```sh
npm run typecheck --workspace arena-game
npm test --workspace arena-game
```

Build package dependencies first; the
[manual guide](../../docs/manual-game-testing.md) specifies disposable PostgreSQL
and Docker fixtures. Tests can clear fixture data or create temporary databases,
so application databases are unsuitable.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. Direct process source was
sampled; the adapter README records its bounded GameService/helper coverage.
No new tests, builds or services were run for this documentation pass.
