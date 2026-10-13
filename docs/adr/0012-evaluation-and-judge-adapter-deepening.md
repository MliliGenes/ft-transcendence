# Deepen evaluation orchestration and execution boundaries

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

Evaluation work crosses several boundaries: a submission is accepted under a
short Match lock, untrusted code runs outside that lock, and the result must be
committed only by the live owner of the durable evaluation claim. Ordinary
Match mutations also need protection when more than one Game process reads the
same snapshot. The execution provider may be the local container adapter, the
single-host internal worker used by Compose, or an explicitly selected
self-hosted Judge0 deployment without changing Game's domain contracts.

## Decision

- Keep `ArenaEngine` as the compatibility facade, and move evaluation claim,
  judge, recovery, failure, and verdict-commit coordination into
  `EvaluationOrchestrator`.
- Keep one immutable Game `evaluationId` as the retry identity. A recovery
  attempt may create another provider-side Judge job, but only the live
  durable claim owner may publish the Evaluation outcome to Match state.
- Keep claim-owned Submission + Match commits on the claim-session seam. Do
  not mix those commits with ordinary snapshot revision checks.
- Add an optional expected revision to ordinary Match persistence writes.
  `MatchAuthority` supplies the observed revision and stamps the next
  committed revision; stale writes fail with `MatchRevisionConflictError`
  (`409`) instead of overwriting a newer Match. The frontend refreshes its
  authoritative snapshot and surfaces the conflict without replaying a
  non-idempotent command.
- Allow only idempotent boot-recovery normalization and grace-triggered
  snapshot reads to retry a revision conflict by reloading the Match. Regular
  gameplay commands do not use this retry path.
- Keep `GameJudge` as the application-owned execution contract. Local Game
  processes default to `ContainerJudge`; Compose selects the internal
  `WorkerJudgeAdapter`, which runs that same container judge behind an
  authenticated worker API. A process may explicitly opt into the optional
  `Judge0Adapter`. Backend selection is static and there is no automatic
  fallback between providers.
- Keep Judge0 self-hosted on a dedicated internal execution host. The adapter
  sends explicit resource limits and `enable_network: false`; provider tokens,
  raw responses, hidden inputs, and expected outputs remain inside the adapter.
- Record provider, queue, execution, outcome, and infrastructure-error
  measurements through an internal telemetry seam. Telemetry does not mutate
  Match state. The Compose worker implements a bounded FIFO queue; weighted
  per-match scheduling and horizontal capacity planning remain deferred until
  load evidence demonstrates a fairness or capacity need.
- Preserve `MatchRecord`, `SubmissionRecord`, public receipts, the existing
  PostgreSQL JSONB schema, and the 42 subject-module matrix. This is an
  architecture and execution-boundary improvement, not a new subject-module
  claim.

## Consequences

- Submit and restart recovery share one workflow, while the judge remains
  parallel across sides and outside the short Match lock.
- A stale ordinary Match command now fails explicitly and must be reconciled
  from a fresh authoritative snapshot. This prevents silent data loss but does
  not provide a merge policy for arbitrary concurrent commands.
- A lost Game process may leave an already-started provider job running until
  the provider limit expires; recovery correctness comes from the durable
  claim and stale-owner rejection, not from pretending the orphaned job
  completed.
- Judge0 can be benchmarked and rolled out without making provider-specific
  status or credential details part of the Game or browser API. The local
  default remains the direct container path for development. Compose uses the
  same runner through the worker boundary; Judge0 remains optional and is not
  the selected Compose route.
- Horizontal realtime scale-out still requires sticky sessions or shared
  pub/sub for process-local sockets, collaboration, chat, and rate limits, plus
  a broader command-coordination policy beyond conflict detection.

## Evidence

- `packages/arena-game/src/evaluation-orchestration.ts`
- `packages/arena-game/src/match-authority.ts`
- `packages/arena-game/src/persistence.ts`
- `packages/arena-game/src/postgres-store.ts`
- `packages/arena-game/src/judge0.ts`
- `packages/arena-game/src/worker-judge.ts`
- `services/judge-worker/src/http-server.ts`
- `services/judge-worker/src/job-queue.ts`
- `services/judge-worker/src/readiness.ts`
- `services/game/src/game/judge-factory.ts`
- `services/judge-worker/test/compose-topology.test.ts`
- `services/judge-worker/test/http-server.test.ts`
- `packages/arena-game/src/evaluation-telemetry.ts`
- `packages/arena-game/test/evaluation-orchestration.test.ts`
- `packages/arena-game/test/match-revision.test.ts`
- `packages/arena-game/test/judge0.test.ts`
- `packages/arena-game/test/evaluation-telemetry.test.ts`
- `frontend/src/arena/socket.ts`
- `frontend/src/arena/socket.test.ts`
- `packages/arena-game/test/concurrency.test.ts`
- `docs/judge0-local.md`
- `docs/adr/0003-sandboxed-code-judging.md`
- `docs/adr/0004-game-match-persistence-module.md`
- `docs/adr/0011-evaluation-idempotency-lock-boundary.md`

The focused in-memory and adapter suites, workspace typechecks, arena build,
frontend tests, and frontend lint pass. Postgres- and Docker-backed suites
remain environment-gated when those services are unavailable; this record does
not present them as passing evidence.

## Ownership clarification, 2026-10-08

`EvaluationOrchestrator.submit` now owns immutable retry validation, attachment,
and completion from pending acceptance through the final Match command. The
facade supplies authorization and pending acceptance inside the short command
lock; the orchestrator settles callers when acceptance or command exit fails,
then invokes the judge and waits for duplicates outside that lock. Its structural
host supplies revision access without requiring a concrete `MatchAuthority`.
Registry entries, resolvers, and execution inputs are private. Public receipts,
claim-owned commits, recovery, persistence schema, and gameplay behavior remain
as specified above.


## Judge failure boundaries, 2026-10-12

Telemetry callbacks are best effort. Their errors cannot replace a valid judge
verdict or its original infrastructure error. A stopped host Docker client is an
infrastructure failure. The execution adapter gives each container a unique name,
stops the client at the host deadline, and awaits a bounded removal attempt.
Judge0 results are checked against the exact UTF8 byte output cap in trusted code;
the provider's rounded KiB quota alone does not enforce that boundary.

## Runtime loss and worker waits, 2026-10-13

The current release enforces one active Game process per Game database. Required
runtime ownership covers ordinary writes and claim-session verdict commits. On
ownership loss, Game stops local WorkerJudge requests, including a response body
read after headers arrive. A late verdict cannot save a score or failure. Remote
Judge jobs retain their existing limits; no worker cancellation endpoint was
added. The application has an independent 5-second stop deadline after detected
loss. See the
[one-server decision](0004-game-match-persistence-module.md#amendment-2026-10-13-one-active-game-runtime).
