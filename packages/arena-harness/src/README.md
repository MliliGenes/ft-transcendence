# Arena lifecycle harness source

## Overview

This directory supplies in-memory lifecycle proofs and scripted Judge fixtures.
It helps exercise Game-facing behavior without acting as production Match
authority, authentication, or a real execution sandbox.

Source reference: Aimane `67fc6b0`, checked 2026-10-27.

## Interface

- [judge-port.ts](./judge-port.ts) defines `JudgePort` with `runVisible` and
  `evaluateHidden` operations.
- [fake-judge.ts](./fake-judge.ts) implements `FakeJudge`, using source markers
  to produce fixture outcomes rather than executing submitted source.
- [mock-game.ts](./mock-game.ts) provides `MockGame` operations for Run,
  Submit, Reveal, NextRound, and `finalResult`.
- [fixtures.ts](./fixtures.ts) provides sessions, micro-problems, scripted
  opponent scores, and JSON problem-bank loading.

These direct source files are the repository entry points; there is no
`src/index.ts` aggregator in this package.

## Invariants

- Harness sessions are fixture identities, not production authentication.
- `FakeJudge` neither executes source nor enforces sandbox resource limits.
- This 1v1 harness counts only completed current-Round `side="you"` attempts.
  Opponent submissions enter history but do not replace competitive results;
  those come from the scripted opponent plan. Failed/late attempts do not
  replace a published result.
- Fixture outcomes establish harness behavior only; real Judge execution and
  production Game authority require their own integration evidence.

`publishReveal()` requires Coding and a counted result for you. `reveal()`
requires Score Reveal; `finalResult()` requires Match Complete.

## Side Effects

- `MockGame` mutates in-memory Match state, history, and events, allocates
  UUIDs, and reads its injected clock.
- Judge operations are asynchronous. Fixture problem-bank loading reads JSON
  files from disk; scripted evaluation itself does not execute user programs.

## Verification

From the repository root with Node 22, run `npm ci` and
`npm run build:packages`, then `npm test --workspace arena-harness`.
The workspace also provides `npm run typecheck --workspace arena-harness`.

No tests or services were run while authoring this contract. The fresh scout
sampled `mock-game.ts` through line 300; the completion of `finalResult` and
later implementation were outside that sample. Other listed source files
were included in the scout report.
