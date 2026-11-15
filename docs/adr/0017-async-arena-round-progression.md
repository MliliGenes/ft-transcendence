# 0017. Independent Code Arena side progression

Date: 2026-11-15
Status: Implemented and repaired on `fix/arena-async-rounds-review`; unit, client, container, and full project gate verification complete. EGM status not fully resolved until reviewed; external gate remains open.

## Context

The previous match advanced both sides through a problem together. A side that scored waited for the opponent or the shared round deadline, and each round reveal disclosed both sides' scores.

## Decision

1. Each player in 1v1, or team in 2v2, advances independently through the match's problems as soon as its submission receives a counted score. A side that completes every problem waits for the other side or the match deadline.
2. Each side has a problem deadline equal to the existing 10-minute round cap, starting when that side enters the problem and clamped to the 30-minute match deadline. A timeout with no counted score records zero and advances that side. Accepted evaluations retain the existing bounded grace.
3. Opponents see only each other's problem number and finished state before the match ends. Scores and hidden-group results remain private until the final reveal. Each side may see its own latest score in its advance notice.
4. The final reveal includes every problem and cumulative totals. The existing winner order remains total score, lower total counted-submission time, fewer submissions, then draw. Forfeit still ends the match immediately.
5. The match phase remains `CODING` during independent races; each side's current problem, stage, and deadline are persisted separately. Legacy records are normalized on load.

## Consequences

- Match snapshots and team readiness/document state resolve against the viewer side's current problem.
- Deadline sweeps advance only expired sides; the match ends when both sides finish or the overall deadline expires.
- The previous shared-round reveal rule is superseded. This change does not alter scoring, judging, matchmaking, or the one-Game-instance deployment decision in ADR-0016.

## Verification

Verified on `fix/arena-async-rounds-review` (pinned `cc0fff3a492a1186f1d13cb0d64d3b75f1ab19b7`):
- All 32 non-container engine test suites passed (259 passed, 31 skipped, 0 failed) covering independent side progression, pre-dispatch stale pending guards, canonical ID binding, submission retry idempotency, readiness resetting, activity privacy, disconnect grace, and 2v2 document collaboration.
- All 5 container test suites passed (45 passed, 0 failed) on Kiri Docker runtime covering container judge, isolation security matrix, judge payload transport, compiled bank execution, and problem version recovery.
- All 120 client tests passed (120 passed, 0 failed) including draft scoping per match/round/problem/language, accessible decoupled polite score notice, match scope reset, and theme token validation.
- All workspace packages and client typecheck and build cleanly with zero errors.
- Full gate `npm run check` completed 100% cleanly (exit code 0): secret scanning, topology checks, tool tests (30/30), Prisma generation, oxlint/eslint, workspace builds/typechecks, arena tests, client tests, chat tests, user tests, Turbopack client production build (25/25 pages), and PostgreSQL integration tests (`game-postgres-reconnect`, `chat-postgres`, `user-postgres`).
