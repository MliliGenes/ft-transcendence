# Game process and adapter composition

## Overview

This directory boots the Nest Game process, reports process/runtime status and
coordinates application shutdown. Its child modules provide Game's verified
principal client and HTTP/socket adapters over the Arena engine.

## Interface

- [main.ts](./main.ts) starts [AppModule](./app.module.ts), which includes
  GameModule. The default listener is `0.0.0.0:3002` with CORS `origin: true`.
- [health.controller.ts](./health.controller.ts) exposes `GET /health` for
  process/model liveness and `GET /ready` for runtime availability plus
  PostgreSQL/Redis TCP probes.
- [runtime-close.ts](./runtime-close.ts) supplies the shared, reentrant closer
  used for process signals and runtime ownership loss.
- [auth](./auth/README.md) verifies principals through an external service.
- [game](./game/README.md) wires Match, Lobby, collaboration and Team chat
  adapters to GameService and the engine.
- See the [service contract](../README.md) for workspace and deployment context.

## Invariants

- `/health` is not `/ready`: a live process may reject Game work because its
  runtime is unavailable or it has lost database ownership.
- TCP probe success demonstrates reachability; it does not authenticate a
  PostgreSQL/Redis session or exercise gameplay.
- One active Game process owns each Game database. Ownership must be acquired
  before schema setup, recovery and admission.
- Runtime loss and process signals use the same closer. Closing is reentrant;
  repeated triggers must not establish a second independent shutdown flow.
- Shutdown stops admissions and disconnects all four socket namespaces. Its
  five-second forced-exit deadline is a bound, not a guarantee of full draining.
- Domain rules remain in the engine; this process composes transports and
  lifecycle around that authority.

## Side Effects

- Opens HTTP/socket listeners and readiness TCP connections.
- Child adapters make principal requests, recover/persist Game state, schedule
  timers and request judging.
- Installs signal handlers and a shutdown deadline, closes the application and
  can force process exit if closure does not finish within the bound.

## Verification

From the repository root with Node 22:

```sh
npm run typecheck --workspace arena-game
npm test --workspace arena-game
```

Build package dependencies first. Follow the
[manual guide](../../../docs/manual-game-testing.md) for disposable PostgreSQL
and Docker fixtures; do not use an application database for executable tests.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. Direct process source was
fully sampled; the child adapter contract records its narrower source coverage.
No tests or services were started for this documentation pass.
