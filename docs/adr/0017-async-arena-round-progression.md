# 0017. Independent Code Arena side progression

Date: 2026-11-15
Status: Implemented on `feature/arena-async-rounds`; verification pending

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

Pending `npm run check` and focused asynchronous progression, privacy, recovery, and timeout regressions.
