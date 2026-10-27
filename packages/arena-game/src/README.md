# Arena Game public entry points

## Overview

Files directly in this directory are the supported source entry points for
`arena-game-engine`. They expose focused interfaces over the
[private implementation](./lib/README.md), whose exported names alone do not
make an implementation file public.

Source reference: Aimane `67fc6b0`, checked 2026-10-27.

## Interface

| Entry point | Supported boundary |
| --- | --- |
| [index.ts](./index.ts) | `ArenaEngine`, `EngineOptions`, problem/record/principal types, `MATCH_DURATION_MS`, and gameplay errors |
| [judge.ts](./judge.ts) | `GameJudge`, `ContainerJudge`, `WorkerJudgeAdapter`, `Judge0Adapter`, `FileBank`, and adapter options |
| [persistence.ts](./persistence.ts) | Persistence contracts/composition, `PostgresStores`, `GAME_SCHEMA`, collaboration persistence, and ownership errors |
| [lobby.ts](./lobby.ts) | Lobby operations and supported storage composition |
| [round-lifecycle.ts](./round-lifecycle.ts) | Focused Round lifecycle operations |
| [team-collaboration.ts](./team-collaboration.ts) | Focused Team collaboration operations |
| [team-chat.ts](./team-chat.ts) | Team chat operations and result types |
| [evaluation-orchestration.ts](./evaluation-orchestration.ts) | Evaluation orchestration and telemetry interfaces |

- [Private runtime contracts](./lib/README.md) cover Match lifecycle, evaluation,
  persistence, Lobby, Team collaboration/chat, bank loading and Judge effects.
  This is a child documentation link, not a supported private import path.

## Invariants

- Cross-package imports use these direct entry points, following the
  [package interface rules](../../README.md); `lib/` remains private.
- Game owns Match membership, phases, counting, and Reveal. Judge owns verdict
  execution; exposing an adapter does not transfer Match authority to it.
- The sampled Match creation path validates mode, problem sequence, and team
  membership. Forwarding declarations do not prove every implementation rule.
- PostgreSQL runtime ownership remains part of the persistence boundary; its
  required/fixture modes are documented in the package interface rules.

## Side Effects

These files forward implementations rather than defining operational bodies.
Invoked operations can mutate Match/Yjs memory, notify event listeners,
allocate UUIDs, read clocks/randomness, transact SQL, and call Judge execution.
The selected engine options and adapters determine the actual effects.

## Verification

From the repository root with Node 22: run `npm ci` and
`npm run build:packages`, then `npm test --workspace arena-game-engine`
and `npm run typecheck --workspace arena-game-engine`.

Use the [manual test guide](../../../docs/manual-game-testing.md) for disposable
PostgreSQL/Docker fixtures; never target the application database.
No fresh tests or runtime checks were performed for these contracts.

The fresh scout fully read all eight forwarding files (2,615 bytes).
The child implementation scan covered 49,928 bytes in nine files, at most
300 lines per file, with 18 files omitted; forwarded interfaces do not remove
that limit on implementation claims.
