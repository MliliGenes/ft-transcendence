# Match deadline, Lobby reconciliation, and event convergence

Accepted 2026-09-27 during the Code Arena implementation follow-up.

## Context

The shared Match clock, Lobby socket messages, and Match live events cross
process and client boundaries. Their behavior must remain server-owned when a
player submits at the deadline, receives Lobby messages out of order, or
misses an event while disconnected. The first-release specification excludes
automatic matchmaking, while the existing backend queue remains useful for a
future release.

## Decision

- At the exact Match deadline, reject new Run and Submit commands. A Submission
  accepted before the deadline may count if its judge result commits no later
  than the configured reveal-grace boundary. Use the acceptance timestamp for
  the scoring-time tie-break.
- After reveal grace, complete an expired Match durably without player action.
  Persist the current Round's Reveal, then save the terminal Match state and
  final result through the normal Match persistence boundary. If that Match
  write fails, a later sweep resumes from the persisted Reveal. If expiration
  occurs in Match Found or Round Intro, save a zero-score Reveal. Rounds that
  were never played contribute zero. Show the terminal Reveal before the
  final result in the UI.
- Keep `ArenaEngine` as the owner of gameplay events and
  `MatchAuthority` as the owner of Match locks, persistence, and revisions.
  Buffer events until the command's durable write succeeds, stamp them with
  the revision read after commit, and isolate listener failures. Events remain
  transient; reconnect and refresh recover from the latest authoritative
  snapshot. Do not add a durable outbox in this release.
- Let the Lobby active-state endpoint own the rendered Lobby snapshot. Socket
  updates and room-state mutations trigger an authoritative fetch; discard a
  response when a newer request has already started. Rejoin the active room
  channel after reconnect and hand off to a Match at most once. The Start Match
  response may route using its server-committed Match ID.
- Keep public queue service and API code, but hide queue entry from the
  first-release Lobby. Cancel a recovered legacy waiting entry so it cannot
  continue automatic matchmaking in the invite-only flow. Preserve recovery
  of a player whose queue entry was already matched.
- Preserve the current Match JSONB schema and 42 subject-module matrix. These
  changes do not add a claimed module.

## Consequences

- Submission acceptance time and judge-completion time serve different rules:
  the former determines tie-break speed, while the latter decides whether a
  deadline result falls within reveal grace.
- A failed Match commit publishes no event. A missed or failed live delivery
  can leave clients temporarily stale until the next authoritative refresh;
  durable replay of every individual event is out of scope.
- Reveal and terminal Match persistence are separate writes. If the terminal
  Match save fails after the Reveal is persisted, the idempotent deadline sweep
  uses that saved Reveal to finish the Match without publishing early events.
- The Lobby reconciler is testable through an injected client port and owns
  request ordering, room-channel membership, and Match handoff. The React page
  renders its snapshot and keeps only form presentation state.
- Direct backend access to the public queue remains possible for existing
  integrations and tests; the first-release frontend does not expose it.

## Evidence

- `packages/arena-game/src/engine.ts`
- `packages/arena-game/src/evaluation-orchestration.ts`
- `packages/arena-game/src/match-authority.ts`
- `packages/arena-game/src/round-lifecycle.ts`
- `packages/arena-game/test/deadline-closure.test.ts`
- `packages/arena-game/test/post-commit-events.test.ts`
- `frontend/src/arena/lobby-session.ts`
- `frontend/src/arena/lobby-session.test.ts`
- `frontend/src/components/LobbyPage.tsx`
- `frontend/e2e/live-lobby.spec.ts`

## Confirmed command completion, 2026-10-12

Ordinary Match writes and claim-session Evaluation commits keep a separate copy
of the acknowledged Match state and revision inside the command context. A
successful final revision read remains preferred. If that read fails after the
command callback succeeds, its confirmed state supplies the result, event
revision, and resource retirement. A failed initial read, callback, or durable
write still fails the command. No revision is inferred from a proposed write.

Command exit does not perform an automatic Match save. Ordinary commands save
explicitly through Match authority; Evaluation commits keep their claim-session
ownership through the structural command host.

A browser command receipt remains successful when its following snapshot refresh
fails. The client reports the refresh failure, pauses commands, and rejoins for a
fresh authorized baseline. It does not replay the confirmed command. Confirmed
Submission identities are released before refresh; uncertain receipts retain
only their existing manual retry identity.


## Interrupted normal Reveals, 2026-10-12

Normal Reveal publication saves the evaluation cutoff before writing its immutable
Reveal row. A later Match phase write can fail without letting late evaluations
change the saved scores. A retry reuses the saved Reveal and its publication time.
Live events follow the successful Match write.

The Game service keeps failed automatic publications pending. Its existing
one-second timer retries them until publication succeeds or the current phase
shows that the work is complete. Each attempt can clear only its own pending
record. Submission receipts remain successful after durable evaluation acceptance.
Game event listeners are isolated so one listener failure cannot stop later delivery.

Lobby browser actions and socket callbacks belong to one session lifetime.
Replies from a stopped lifetime cannot change a restarted session or route it to
an old Match. A replaced Arena transport supplies a fresh snapshot during render,
and the subscription reads again after listener registration.
