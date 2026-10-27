# Arena Game engine

## Overview

`arena-game-engine` owns authoritative Match behavior: membership, Round
progression, Run/Submit coordination, counted contributions, and Reveal.
Judge adapters supply execution verdicts through a separate seam; transport
and trusted identity construction are composed by callers.

Source reference: Aimane `67fc6b0`, checked 2026-10-27.

## Subdirectories & Boundaries

[src](./src/README.md) defines supported entry points and links the private engine implementation.

## Interface

- The [source contract](./src/README.md) documents all eight supported direct
  entry points. [index.ts](./src/index.ts) exposes `ArenaEngine`, its options,
  public types, trusted-principal construction, and gameplay errors.
- [judge.ts](./src/judge.ts) exposes Judge contracts and adapters;
  [persistence.ts](./src/persistence.ts) exposes persistence composition.
- Other direct source entry points cover Lobby, Round lifecycle, Team
  collaboration, Team chat, and Evaluation orchestration.
- [package.json](./package.json) maps supported package exports to source
  and built entry points. Files below `src/lib/` are private implementation.

## Invariants

- Follow the [package interface rules](../README.md): cross-package
  imports use direct `src/` entry points or matching built exports.
- Game owns Match state/counting/Reveal; Judge execution does not decide
  membership or publish Match outcomes on its own.
- Creation validates mode, nonempty problem sequence, and team membership.
  Forwarding exports do not certify all private implementation guarantees.
- `PostgresStores` requires runtime ownership by default. Acquire it before
  schema setup/recovery; independent fixtures explicitly select fixture mode,
  as described in the package interface rules.

## Side Effects

Invoked engine/adapters can mutate Match and Yjs state, emit events, allocate
UUIDs, read clocks/randomness, transact SQL, and call Judge implementations.
These effects depend on the chosen options and adapters.

`FileBank` reads problem JSON on each load and can fail on missing/malformed
records. The deployed Game image must retain `packages/problem-bank` data;
see the [bank contract](./src/lib/README.md#interface).

## Verification

With Node 22, from the repository root:

```sh
npm ci
npm run build:packages
npm test --workspace arena-game-engine
npm run typecheck --workspace arena-game-engine
```

For full database/Docker coverage, use disposable fixtures from the
[manual test guide](../../docs/manual-game-testing.md), never the application
database. No tests or services were run for this documentation.

All eight public forwarding files were fully read. The implementation scout
was limited to nine files/49,928 bytes, at most 300 lines per file, with
18 files omitted; this package contract preserves that evidence limit.

Shared fixtures: [setup.ts](./test/setup.ts) creates an in-memory 1v1 Match with
an injectable clock (`advance`) and [ScriptedJudge](./test/scripted-judge.ts)
provides deterministic or deferred verdicts. These exercise public entry points;
they do not execute submitted source or prove real identity. Settle deferred
work and release any stores/timers acquired by a test's options during cleanup.
