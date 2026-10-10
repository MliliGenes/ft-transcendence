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
