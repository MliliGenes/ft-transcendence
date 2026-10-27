# Package interfaces

Copy `example/` when starting a package, or delete that starter when it is no longer useful. This repo preserves its existing workspace layout:

```text
packages/<name>/
  src/
    index.ts        # public entry point
    client.ts       # another optional public entry point
    lib/impl.ts     # private implementation
  test/
    example.test.ts # imports ../src/index.js
    fixtures/      # private test fixtures
```

**Entry-point interface.** Import a package only through its entry points: files directly inside its `src/` folder (or the matching built `dist/` entry points). Anything in a deeper source subfolder is private, regardless of the folder name. Source metadata in workspace manifests lets the checker resolve package names to source entry points. Discourage barrel files: expose several small entry points instead of re-exporting an entire subtree through one giant index.

**Intra-package freedom.** Implementation files may import other files within their own package freely. Imports of another package must use that package's entry points. Packages are immediate children of `packages/`; do not nest one package inside another. Optional layering rules belong in the commented configuration stub.

**Tests through entry points.** Files under a package's `test/` or `tests/` folder may import any package's entry points and fixtures from their own test folder. They may not import private implementation, including their own package's implementation. Application code and other packages cannot import those fixtures.

**No cycles.** Dependency cycles are errors, including cycles involving type-only imports. Run `npm run lint:boundaries` to check package imports across packages, the game processes, the frontend, and scripts. `npm run check` combines this with repository checks, typechecks, and lint. Run the starter's public-interface tests with `npm run test:example`.

## Supported Entry Points

### `arena-game-engine` (`packages/arena-game`)

| Entry point | Supported interface |
| --- | --- |
| `index.ts` | ArenaEngine, trusted-principal construction, public command/record types, and gameplay errors |
| `persistence.ts` | Match persistence contract, supported adapter composition, memory/PostgreSQL construction and lifecycle |
| `lobby.ts` | Lobby operations and supported Lobby storage composition |
| `team-chat.ts` | Team chat operations and their result types |
| `judge.ts` | Judge contract, supported execution adapters, and problem-bank construction |
| `round-lifecycle.ts` | Focused Round lifecycle interface retained by ADR-0007 |
| `team-collaboration.ts` | Focused Team collaboration interface retained by ADR-0008 |
| `evaluation-orchestration.ts` | Focused Evaluation orchestration and telemetry interfaces retained by ADR-0012 |


### PostgreSQL runtime ownership

`PostgresStores(connectionString)` requires Game runtime ownership by default.
Acquire it with `acquireRuntime({ onLost })` before `ensureSchema()` and engine
recovery. The loss callback is synchronous and terminal; the service closes
admission and starts bounded application shutdown. `assertRuntimeActive()` and
`runtimeActive` expose local availability. `close()` invalidates claims
synchronously, drains pools, and releases normal startup ownership last. Close
is idempotent. `RuntimeAlreadyOwnedError` and `RuntimeOwnershipLostError` are
exported from `persistence.ts`, with code 503.

Independent package test fixtures must explicitly use
`new PostgresStores(connectionString, { runtimeOwnership: "fixture" })`.
The `raw` pool getter is restricted to that mode. `DEV_PRINCIPAL` and `NODE_ENV`
do not disable PostgreSQL ownership. The production Game service uses required
mode, including real-process integration tests.

<!-- BEGIN EGM GAME CONTRACTS -->
## Game directory contracts

### Overview

Source inspected on 2026-10-27 at `67fc6b0`. This index covers the Game
packages selected for this bootstrap. The package rules above remain binding.

### Subdirectories & Boundaries

[arena-game](./arena-game/README.md) owns Match behavior;
[arena-model](./arena-model/README.md) owns pure domain vocabulary;
[arena-harness](./arena-harness/README.md) supplies lifecycle fixtures.
Other packages remain outside this scoped bootstrap.

### Interface

- [arena-game](./arena-game/README.md): authoritative Match engine, public
  domain entry points, persistence and Judge adapter construction.
- [arena-model](./arena-model/README.md): shared types, transitions, scoring,
  events and Team chat vocabulary.
- [arena-harness](./arena-harness/README.md): in-memory lifecycle and Judge
  fixtures; this is not production authentication or code execution.
- `problem-bank/` contains problem data rather than a retained code directory;
  consume it through the supported bank adapter. `browser-auth/` and `example/`
  were outside this Game-contract bootstrap.

### Invariants

- Consumers import only direct `src/` entry points or their matching build
  outputs. A deeper file remains private even when it exports a symbol.
- Game owns Match membership, phase, counted Submission and Reveal decisions.
  Judge implementations execute code and return verdicts.
- A fixture Judge or development principal is not production verification.
- Child contracts record their bounded source samples; an exported name alone
  does not prove every implementation path.

### Side Effects

The model is pure. Invoking engine adapters can affect Match state, Yjs
state, events, database transactions or Judge execution. Harness fixtures use
memory, injected clocks and fixture-bank reads. Import rules do not make an
adapter free of effects; use the relevant child contract.

### Verification

From the repository root, after `npm ci`, use `npm run build:packages` and
`npm run lint:boundaries`. Each child lists its workspace test target. Full
Game tests need the [disposable fixtures](../docs/manual-game-testing.md#disposable-postgresql-fixtures).
These are commands to run, not new passing results from this documentation task.
<!-- END EGM GAME CONTRACTS -->
