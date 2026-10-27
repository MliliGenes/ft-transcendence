# Arena lifecycle harness

## Overview

`arena-harness` supplies in-memory Game lifecycle and Judge fixtures for
proofs. Scripted evaluation makes selected scenarios reproducible without
starting production Game services or executing submitted programs.

Source reference: Aimane `67fc6b0`, checked 2026-10-27.

## Subdirectories & Boundaries

[src](./src/README.md) defines lifecycle/Judge fixtures; it does not supply production authority.

## Interface

- The [source contract](./src/README.md) covers `JudgePort`, `FakeJudge`,
  `MockGame`, and fixture helpers.
- [judge-port.ts](./src/judge-port.ts) defines visible/hidden evaluation
  operations; [fake-judge.ts](./src/fake-judge.ts) supplies scripted results.
- [mock-game.ts](./src/mock-game.ts) exposes lifecycle operations;
  [fixtures.ts](./src/fixtures.ts) supplies fixture identities and problems.
- [package.json](./package.json) defines test/typecheck scripts and the
  dependency on `arena-model`. The package has no root source aggregator;
  consumers use its direct source files under the repository boundary rules.

## Invariants

- This harness does not provide production authentication, authoritative
  Match admission, or a real Judge sandbox.
- `FakeJudge` interprets source markers; it does not execute source or enforce
  execution resource limits.
- This is a 1v1 harness with a scripted opponent. Submit resolves after
  successful evaluation; failures reject. Only current-Round `side="you"`
  attempts replace the counted contribution. Opponent submissions enter history
  but opponent competitive results come from the configured script.
- Harness proofs must not be presented as real execution or deployment proof.

`publishReveal()` requires Coding and a counted result for you. `reveal()`
requires Score Reveal; `finalResult()` requires Match Complete.

## Side Effects

Lifecycle calls mutate memory/history/events, generate UUIDs, and use an
injected clock. Judge calls are asynchronous; fixture bank loading reads JSON
from disk. The scripted Judge does not launch a source execution sandbox.

## Verification

With Node 22, from the repository root:

```sh
npm ci
npm run build:packages
npm test --workspace arena-harness
npm run typecheck --workspace arena-harness
```

No tests or services were run to author this contract. The source scout read
`mock-game.ts` only through line 300, leaving `finalResult` completion and later
code outside its sample; the public operation name is not a claim about that
unread implementation.
