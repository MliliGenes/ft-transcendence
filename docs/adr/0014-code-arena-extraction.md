# Extract Code Arena as the game-only root workspace

Status: Accepted on 2026-10-01.

## Context

The Code Arena source repository mixed the production game with a guided
course, scratch issue trackers, agent configuration, generated reports,
screenshots, historical prototypes, test output, and placeholder services.
The destination `ft-transcendence` repository had no application workspace on
`main`; teammate chat and user-service work remained on independent branches.

Copying the source tree wholesale would make generated and private working
material look like product source. Nesting the game under another repository
root would preserve that repository-within-a-repository shape and complicate
the existing workspace and Compose paths.

## Decision

- Import source commit `243e3e7c468ee946f9d7f52a598f15aa4c3ca70e`
  as a clean snapshot at the destination repository root.
- Keep only the frontend, arena model/engine/harness/problem bank, Game service,
  judge worker, tests, game infrastructure, and authoritative documentation.
- Make root workspace membership explicit instead of using broad globs.
- Keep Game-owned match chat because it is part of the arena runtime.
- Omit placeholder Core and standalone Chat services. The teammate user service
  remains the future verified-principal provider through
  `docs/auth-game-contract.md`; platform chat remains a later ownership and
  transport decision.
- Do not merge or rewrite any teammate branch during extraction.

## Consequences

The root now builds and describes the actual game rather than the source
repository's learning environment. The Compose stack owns only Game's database,
Redis readiness, the private judge worker, Game, and Nginx.

ADR-0001 remains useful as historical service-boundary context, but its
three-service-in-one-tree deployment decision is partially superseded for this
snapshot. Omitting placeholder services does not reject separate platform
services and does not itself establish the 42 microservices module.

Future integration must reconcile the teammate branches' dependency versions,
connect verified identity without moving authentication logic into Game, and
decide how platform chat relates to Game's match-scoped `/chat` namespace.

Validation after extraction made two narrow runtime-maintenance repairs on top
of the pinned snapshot: database-backed Vitest files run serially against their
shared disposable schema, and CodeMirror initializes from the live Y.Text at
effect setup so a collaboration sync racing a reload cannot leave the editor
bound to an earlier empty render snapshot. Neither repair changes a public
Game, Socket.IO, collaboration, lobby, judging, or match-chat interface.
