# Arena domain model source

## Overview

This directory defines shared Match vocabulary and pure rules used by Game,
the harness, and other consumers. It describes domain state and decisions;
callers own storage, authentication, transport, and execution.

Source reference: Aimane `67fc6b0`, checked 2026-10-27.

## Interface

- [index.ts](./index.ts) is the package entry point; direct files below are
  also repository source entry points under the package boundary rules.
- [model.ts](./model.ts) defines `MatchMode`, `RoundPhase`, `PlayerStatus`,
  `Presence`, `Readiness`, `resetReadiness`, and `bothReady`.
- [transitions.ts](./transitions.ts) supplies action gates and the guarded
  `publishRoundReveal` transition.
- [scoring.ts](./scoring.ts) supplies scoring validation, aggregation, and
  side comparison rules.
- [events.ts](./events.ts) and [chat.ts](./chat.ts) define shared event names,
  event/chat contracts, and Team pings.

## Invariants

- Round phase, side activity, and connection Presence are separate states.
- Run, Submit, and editing require Coding; 2v2 Submit additionally requires
  both teammates to be ready.
- Reveal publication uses `publishRoundReveal`, not an arbitrary generic
  transition out of Coding.
- Round scores are finite values from 0 through 100. Match totals sum Rounds
  and may exceed 100. Pass-count scoring requires
  nonnegative integer group weights totaling 100.
- Final side comparison orders score, elapsed time, then attempt count;
  equality through those comparisons produces a draw.
- Type definitions and pure gates do not themselves authenticate a caller
  or persist an accepted action.

Pass-count scoring requires non-negative integer weights totaling 100, positive
integer test totals and passed counts from zero through each test total. It
floors earned basis points per group, sums those basis points, and rounds once
to a whole percentage with halves rounded up. Do not round each group to a whole
percentage before summing.

## Side Effects

Functions compute domain results without external I/O. Invalid scores or
invalid Reveal requests can throw. Consumers are responsible for effects
performed after applying these rules.

## Verification

From the repository root with Node 22: run `npm ci` and
`npm run build:packages`, then `npm test --workspace arena-model`.
The workspace also provides `npm run typecheck --workspace arena-model`.

The fresh scout fully sampled all six source files. No test, build, or
runtime suite was executed for this documentation; the commands above are
verification instructions rather than new execution evidence.
