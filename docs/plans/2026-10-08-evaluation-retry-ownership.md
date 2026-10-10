# Evaluation retry ownership execution plan

Spec: `docs/refactor/0001-refactor-evaluation-retry-ownership-2026-10-08.md`; CONTEXT.md and ADR-0004/0007/0008/0011/0012 constrain behavior.
Base: 832aa8dcac774af774bea6dc4101fcdd330df044. Execute inline on Aimane, as selected by the user.

## Global Constraints

Preserve ArenaEngine.submit inputs and receipts, admission gates, membership, Readiness, frozen Team collaboration source, pending acceptance, post-commit events, Match revisions, hidden-suite sealing, deadline grace, and claim-session ownership. Keep judge work and duplicate waits outside short Match locks. Keep memory and PostgreSQL persistence contracts unchanged. Use Node 22. Do not push, merge, publish, or touch unrelated untracked material. No HTML.

The user selected execution instead of the proposal interview. Resolve the smallest implementation choices through tests and record rulings. The proposal's phase 1 is baseline characterization; combine it with phase 2 in Task 1. Tasks 2 and 3 correspond to phases 3 and 4.

## Review Focus

Review early acceptance failures and host failures after the callback returns; same-identity retries that attach before pending persistence completes; identity mismatches across every immutable field; final Match command errors that must settle attached callers; successful/failed/recovered receipt behavior; no await under the Match lock for duplicate completion or judge calls; recovery claiming and stale-owner commits; retained public declaration compatibility; events only after successful durable state.

## Task 1: Enable focused Evaluation construction

Files: packages/arena-game/src/lib/evaluation-orchestration.ts, packages/arena-game/src/lib/engine.ts, packages/arena-game/test/evaluation-orchestration.test.ts.
Interfaces: expose revisionFor on the existing structural EvaluationOrchestrationHost; remove the concrete MatchAuthority constructor option. ArenaEngine delegates that revision operation to its authority. Keep current tracked-run input temporarily for this safe intermediate state.

1. Run existing Submit, concurrency, reconnect, deadline, event, revision and Evaluation tests as the baseline. Expected: green with PostgreSQL pointed at an isolated test database.
2. Add a focused successful Evaluation test constructed through supported entry points with memory persistence, public RoundLifecycle, a judge adapter and structural host, with no private MatchAuthority. Run it before changing implementation. Expected: assertion rejects instead of receipt because the current implementation dereferences the absent concrete authority.
3. Move revision access to the host seam. Run the focused test. Expected: original receipt and one counted attempt persist.
4. Run package typechecks and focused/regression tests. Expected: green.
5. Commit the construction seam and test as refactor(evaluation): use facade command context.

Completion command: npm test --workspace arena-game-engine -- test/evaluation-orchestration.test.ts test/submit-path.test.ts test/concurrency.test.ts test/reconnect.test.ts test/deadline-closure.test.ts test/post-commit-events.test.ts test/match-revision.test.ts

## Task 2: Concentrate Evaluation retry ownership

Files: packages/arena-game/src/lib/evaluation-orchestration.ts, packages/arena-game/src/lib/engine.ts, packages/arena-game/test/evaluation-orchestration.test.ts.
Interfaces: EvaluationOrchestrator.submit(matchId, prepare) runs prepare inside host.withMatchLock. Prepare supplies immutable Evaluation request data and acceptPending(existing), the facade-owned pending acceptance operation. The workflow owns local registry identity/settlement and completion outside the lock. Existing forRound observable waits and recoverPending remain available.

1. Add observable workflow tests before implementation. Name the break each detects: duplicate judge invocation, accepting changed identity, losing original error/receipt, waiting with a lock held, or hanging attached callers after early/late persistence failure. Use only supported entry points and memory persistence. Expected: failing assertions because the workflow operation is absent.
2. Add the submit workflow. Keep private tracked state, compare local and durable identities once, run acceptance under the host lock, catch host failure and settle ownership, then wait/run outside the lock. Preserve recovery semantics. Expected: focused workflow cases pass.
3. Make ArenaEngine's prepare callback retain admission and frozen-source gates; retain pending Submission acceptance and activity transitions in its callback. Delegate workflow sequencing. Expected: retained integration tests pass unchanged.
4. Replace registry-only tests with the equivalent observable workflow tests. Verify wrong identities in local and durable paths, successful/recovered receipts, failure replay, acceptance rollback, and lock exit failure. Expected: green.
5. Commit as refactor(evaluation): own immutable retry completion.

Completion command: npm test --workspace arena-game-engine -- test/evaluation-orchestration.test.ts test/submit-path.test.ts test/concurrency.test.ts test/reconnect.test.ts test/deadline-closure.test.ts test/post-commit-events.test.ts test/match-revision.test.ts test/postgres.test.ts

## Task 3: Close public bookkeeping and verify

Files: packages/arena-game/src/evaluation-orchestration.ts, packages/arena-game/src/lib/evaluation-orchestration.ts; update relevant domain docs only to record the final ownership shape.
Interfaces: export the orchestrator, structural construction/input/receipt/recovery contracts, observable completion type, and supported telemetry. Registry state, tracked resolvers and run helpers stay private.

1. After Task 2 behavior is green, curate the public exports and make get/track/settle/failureFor/run private or remove unused forwarding. Keep forRound and recovery semantics. Expected: public workflow tests and builds remain green.
2. Run package import rules, typechecks and relevant builds; run the complete root npm test command against the disposable PostgreSQL database. Expected: green. Record any environment limitation or baseline failure by name; never claim unexecuted checks.
3. Verify PostgreSQL claim/recovery, stale-owner rejection and ordinary revision tests actually run, rather than skip. Expected: green.
4. Record the ownership clarification in CONTEXT.md and ADR-0012; no superseding decision is needed.
5. Commit as refactor(evaluation): keep retry bookkeeping private.

Completion command: npm test

## Final review and finish

Create a review package for BASE..HEAD. Dispatch one independent whole-branch reviewer. Re-grade findings by effect. Fix important findings in one RED-to-GREEN pass, rerun the complete suite, and commit fixes. Record minor findings and every ruling. Leave verified commits on Aimane; do not push or merge. Preserve unrelated untracked files. Remove only this plan's scratch workspace after recording its rulings and final evidence in the final response.
