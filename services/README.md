# Game services

## Overview

The two Game processes adapt the shared engine to network requests and isolated
code execution. Source inspected on 2026-10-27 at `67fc6b0`; this is a bounded
contract bootstrap, not a fresh runtime or security test.

## Subdirectories & Boundaries

[game](./game/README.md) owns Game HTTP/socket admission; [judge-worker](./judge-worker/README.md) owns private execution.

## Interface

- [Game service](./game/README.md): Nest HTTP and four Socket.IO namespaces,
  principal verification, runtime ownership and Match/Lobby adapters.
- [Judge worker](./judge-worker/README.md): private authenticated execution
  endpoints, bounded queue, Docker readiness and runner-image preparation.
- The engine's supported API is documented in the
  [package guide](../packages/README.md). The integrated User Service is an
  external identity dependency; its implementation was outside this scope.

## Invariants

- Game owns Match rules and persistence; Judge owns code execution and verdicts.
- Operations need verified identity and a serving Game runtime. Process liveness
  alone does not establish readiness.
- Production PostgreSQL operation needs one active Game owner per database.
- Judge execution is private and explicitly configured; infrastructure failure
  must not silently select another Judge.
- A request timeout does not itself cancel a running Judge job. Game has a
  five-second forced-close deadline. The worker exits from `server.close`'s
  callback and has no equivalent forced-exit timer; neither promises that
  every active job drains.

## Side Effects

Game opens HTTP/socket connections, verifies principals, acquires database
ownership and schedules Match work. Worker startup can pull Docker images;
execution starts isolated code containers. Both processes have timers and
shutdown effects. Child contracts state inspected paths and limits.

## Verification

From the repository root after `npm ci` and `npm run build:packages`:

```sh
npm test --workspace arena-game
npm test --workspace arena-judge-worker
```

Use [disposable PostgreSQL and Docker fixtures](../docs/manual-game-testing.md#disposable-postgresql-fixtures)
for the complete required suites; never point destructive fixtures at an
application database. These commands were not executed for this docs-only task.
