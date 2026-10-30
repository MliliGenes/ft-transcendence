# Arena Game implementation

## Overview

This directory implements the authoritative Match engine and its adapters.
It is private to `arena-game-engine`; TypeScript exports here do not make a
file a supported cross-package entry point. The public boundary is documented
in the [parent contract](../README.md).

Source reference: Aimane `67fc6b0`, checked 2026-10-27.

## Interface

- [engine.ts](./engine.ts) implements `ArenaEngine`; the bounded sample covers
  its constructor and Match creation.
- [judge-types.ts](./judge-types.ts) and
  [persistence-types.ts](./persistence-types.ts) define internal integration
  contracts exposed selectively through the parent entry points.
- [collab.ts](./collab.ts), [compiled-snippet.ts](./compiled-snippet.ts),
  [container-judge.ts](./container-judge.ts), and
  [guarded-sql.ts](./guarded-sql.ts) contain sampled collaboration, snippet,
  execution, and transaction helpers.
- Other engine, Lobby, persistence, chat, and Evaluation implementations live
  here; consumers must use files directly in `src/`.

- [file-bank.ts](./file-bank.ts) implements `FileBank.loadProblem`: each call
  synchronously reads/parses a problem JSON record, defaulting to the sibling
  `problem-bank` directory, and maps execution metadata plus visible/sealed tests.
  Missing or malformed records can throw.

## Invariants

- Match creation requires a known mode and a nonempty problem sequence:
  1v1 has two participants on two sides; 2v2 has four distinct users, two per side.
- Game owns Match membership, state, counted contributions, and Reveal.
  Judge executes code and supplies verdicts.
- Compiled snippets use validated bank identifiers and `int64-array` metadata,
  with at most 100,000 signed 64-bit inputs.
- Case verdicts compare against trusted expected output; sealed results omit
  outputs. Yjs source identity is Match:Round:side and `seedOnce` preserves
  existing documents.
- `GuardedSql` checks ownership/activity around transaction operations.
  The bounded scan does not establish all adapter or fencing behavior.

### Match lifecycle

- `startRound` enters Round intro; `beginCoding` enters Coding. Run and Submit
  require Coding and an eligible side. Source and language are validated before
  execution; only C, C++ and Python are supported by the current Judge contract.
- The default Match clock is 30 minutes from Match creation. Starting a Round
  does not restart that Match-wide deadline. Deadline closure settles the Match.
- Run defaults to 10 requests per 60 seconds per Match-side; Run never counts a
  score. The default 1v1 reconnect grace is 90 seconds. The current 2v2 path has
  no grace-expiry forfeit; deliberate Leave causes an immediate forfeit.
- Run resolves the bank problem and execution metadata before persisting the
  side as `running`. A failure while persisting acceptance, judging, or settling
  re-enters the lock once, restores `coding` only while the same Run attempt
  still owns the side's `running` activity, records the failure, and leaves prior `runTests` verdicts intact;
  the original Run error remains the caller-visible outcome.
- Recovery retains the accepted evaluation identities and configured Judge.
  Use the existing attempt IDs instead of creating a new attempt on a retry.
- Snapshot reads apply reconnect grace under the Match lock and use the
  idempotent revision retry. The snapshot persists only when grace changed the
  Match; an unchanged snapshot neither writes nor advances the revision.

### Evaluation and retry identity

- The Match facade authorizes the caller and resolves the original Round and
  competitive window. Evaluation orchestration owns persisted retry lookup,
  immutable request validation, attachment, and receipt completion.
- Evaluation identity binds Match, Round, side, Submission, problem, language,
  source hash and document revision. A matching retry joins existing work;
  changing the bound identity is rejected.
- Receipt recovery for a completed or superseded submission after Reveal, round
  advance, or Match completion returns the original acceptance receipt. A receipt
  for superseded work does not imply a counted verdict or require a Judge result;
  recovery may supersede stale pending work without judging it.
- The receipt-return branch performs no new acceptance, Judge invocation,
  readiness update, attempt increment, or scoring contribution. Before that branch,
  Submit retains its expiry preflight: it may wait for accepted evaluations,
  publish Reveal, lock activities, and complete/persist an expired Match.
- Outside the competitive window, retrying an orphan pending submission without an
  in-flight owner returns a retryable `IllegalStateError` without invoking the Judge,
  leaving boot/background recovery in charge. A pending retry may join a genuine
  in-flight evaluation outside the Match lock.
- Explicit empty identifiers (`""`) are rejected consistently with `DuplicateError`.
  Legitimate single-ID retries with omitted partner IDs remain supported.
- In 2v2 mode, late receipt recovery strictly requires an explicit `documentRevision`
  matching the accepted frozen revision. Raw `input.code` differences are ignored
  because the authoritative snapshot resides in the team Y.Doc.
- Only eligible competitive completions replace the counted contribution.
  Infrastructure failures do not count. Completions past the applicable Round
  cutoff/deadline remain recorded as superseded rather than changing the score.

### Team collaboration

- Team Submit uses server-owned document text and requires both teammates to
  approve the current revision and agree on its language. Changing language
  replaces text with the selected starter and invalidates both approvals.
- Match/document updates use the configured persistence composition; PostgreSQL
  commits them transactionally. Rejected commits restore the local document.
  Custom sequential fallback composition must not be assumed transactional.
- Opponents receive masked readiness/revision views, not the other team's code
  or approvals. Shared document identity remains Match:Round:side.

### Persistence composition

- Expected-revision writes reject conflicts with code 409. Submission identity
  is immutable; evaluation work is claimed exclusively, and commits must match
  the active claim session. Reveals are inserted once.
- Active match maintenance sweeps query active candidates via `listActiveMatchIds`
  and `listActiveIds`, backed by PostgreSQL partial index `idx_matches_active`
  and extended statistics `stat_matches_round_phase`. `PostgresStores.ensureSchema`
  automatically populates uninitialized expression statistics during upgrade on
  pre-existing databases without requiring manual `ANALYZE`.
- PostgreSQL provides transactional composition. Omitting optional adapter
  hooks uses process-local claims and sequential writes; those fallbacks do
  not provide the same cross-process or atomic-write guarantees.

### Lobby admission and Match formation

- Queue membership, an open private room and an active Match are mutually
  exclusive admission states. Queue formation is FIFO; public queue UI remains
  outside the current invitation-only release.
- Only the host starts a full room whose sides are ready. Side changes reset
  relevant readiness; host departure closes the waiting room.
- Private rooms default to a 20-minute expiry. The server selects the
  three-problem sequence. PostgreSQL commits Match formation and Lobby linkage
  together so callers do not create arbitrary participants or problems.

### Team chat

- The authorized caller supplies room/side/user context. Text is trimmed;
  empty messages or messages longer than 500 characters are rejected.
- Defaults retain 25 entries per room, allow five text messages per two seconds
  and three pings per three seconds per connection, and reject new activity
  after Match completion.
- Message retries use room/user/client-message identity and a bounded cache.
  Reuse an uncertain message's client ID rather than sending it as a new item.

### Judge adapters

- The current `SPIKE_LIMITS` defaults are compile wall time 150,000 ms, run wall
  time 8,000 ms, 256 MiB memory, 65,536 output bytes, one CPU and 64 PIDs.
  Engine options may supply different limits; these defaults are not a capacity
  guarantee.
- Container execution uses an isolated container per case. The framed
  source/current-input/driver payload cap is 8 MiB; expected answers remain on
  the trusted side. The worker's separate aggregate HTTP cap is 2 MiB.
- Client timeout initiates bounded cleanup; a stopped wait alone does not prove
  the remote job has stopped. The worker adapter validates response shapes.
  Judge0 uses HTTP submission and bounded polling: defaults are 120 polls with
  a 250 ms interval; exhaustion is an infrastructure failure.

## Side Effects

- Operations mutate Match/Yjs state and invoke command event listeners.
- Execution can allocate UUIDs, use randomness and clocks, transact SQL, and
  call Judge implementations. Effects depend on the selected adapters.

ContainerJudge starts Docker subprocesses and containers, with bounded cleanup.
WorkerJudgeAdapter and Judge0Adapter perform outbound HTTP; Judge0 also polls
and sleeps. These effects are separate from Match counting and Reveal authority.

`FileBank.loadProblem` performs synchronous filesystem reads and JSON parsing on
each call. Keep the problem-bank records available in the deployed Game image.

## Verification

From the repository root with Node 22, prepare with `npm ci` and
`npm run build:packages`, then run `npm test --workspace arena-game-engine`
and `npm run typecheck --workspace arena-game-engine`.

Full PostgreSQL/Docker coverage requires disposable resources described in
the [manual test guide](../../../../docs/manual-game-testing.md); never use the application
database. No tests or services were run for this documentation.

The initial bootstrap sampled nine files (49,928 bytes, at most 300 lines each).
The runtime contracts above were expanded after static review of the linked
implementation modules. This remains documentation evidence, not a new runtime
or complete security audit.
