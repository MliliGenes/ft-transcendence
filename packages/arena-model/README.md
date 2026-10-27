# Arena domain model

## Overview

`arena-model` is the shared, pure vocabulary for Code Arena Match state,
transitions, scoring, events, and Team chat. It gives Game and fixtures a
common set of rules while leaving execution and persistence to their callers.

Source reference: Aimane `67fc6b0`, checked 2026-10-27.

## Subdirectories & Boundaries

[src](./src/README.md) contains pure state, transition, scoring, event and Team chat vocabulary.

## Interface

- The [source contract](./src/README.md) documents direct source entry points.
- [index.ts](./src/index.ts) exposes the package interface;
  [model.ts](./src/model.ts) defines Match and side state/readiness vocabulary.
- [transitions.ts](./src/transitions.ts) provides action gates and Reveal
  publication; [scoring.ts](./src/scoring.ts) supplies score/side comparison.
- [events.ts](./src/events.ts) and [chat.ts](./src/chat.ts) define event/chat
  contracts and Team pings.
- [package.json](./package.json) defines the source/built main entry point and
  build, test, and typecheck scripts.

## Invariants

- Round phase, side activity, and Presence are distinct state dimensions.
- Run/Submit/edit require Coding; 2v2 Submit also requires both teammates
  ready. Reveal is published through the guarded `publishRoundReveal` path.
- Round scores are finite values from 0 through 100. Match totals sum Rounds
  and may exceed 100. Pass-count scoring requires
  nonnegative integer group weights totaling 100. Final comparison orders
  score, time, attempt count, then draw.
- Domain gates do not replace Game authority, authentication, or persistence.
  Consumers must honor the [package interface rules](../README.md).

## Side Effects

The model performs pure computations and no external I/O. Invalid scores or
Reveal requests can throw; callers decide how to store or publish outcomes.

## Verification

With Node 22, from the repository root:

```sh
npm ci
npm run build:packages
npm test --workspace arena-model
npm run typecheck --workspace arena-model
```

The fresh scout fully sampled the six source files. No tests, builds, or
runtime checks were executed for this documentation; these commands describe
how to verify the package rather than report fresh runtime success.
