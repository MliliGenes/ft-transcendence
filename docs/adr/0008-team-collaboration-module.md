# Extract 2v2 collaboration as a deep Game module

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

`ArenaEngine` had already delegated durable Match state, membership, and
Round rules, but it still directly managed the complete 2v2 collaboration
workflow: lazy Yjs loading, application revision changes, readiness
invalidation, language starter replacement, atomic persistence rollback,
authoritative submission snapshots, and masked team views. Those rules change
together and form one domain seam, while Match locking and transport events
belong to the facade.

## Decision

- Introduce `TeamCollaboration` as the Game-owned 2v2 collaboration module.
- Keep Yjs memory state inside the module and use the existing
  `MatchPersistence.commitMatchAndTeamDocuments` seam for durable state.
- Keep trusted-principal membership checks, short per-Match locking, ordinary
  Match persistence, and event emission in `ArenaEngine`.
- Keep the existing public `ArenaEngine` methods and `MatchRecord` JSONB schema.
- Keep opponent masking, current-round rejection, revision-gated readiness,
  and authoritative frozen submission source behavior unchanged.
- Treat this as a domain-module extraction, not a new 42 subject module
  claim.

## Consequences

- Collaboration behavior is testable through a focused interface without
  constructing `ArenaEngine`, Socket.IO, or a judge.
- Changes to Yjs loading, revision invalidation, language reset, and rollback
  stay local to one implementation.
- `ArenaEngine` coordinates authorization, locking, persistence of ordinary
  Match state, and post-commit events through a smaller facade surface.
- Cross-process Match locking and realtime scale-out remain open follow-ups.

## Evidence

- `packages/arena-game/src/team-collaboration.ts`
- `packages/arena-game/test/team-collaboration.test.ts`
- `packages/arena-game/src/engine.ts`
- `CONTEXT.md` glossary

## Browser edit confirmation and recovery, 2026-10-12

The browser Team collaboration module tracks each edit until its acknowledgement
arrives. Ready, Run, and Submit require no pending edits and agreement between the
accepted document revision and the authoritative Match snapshot.

A rejected or unconfirmed edit preserves a recovery copy scoped to the endpoint,
player, Match, Round, and language. The client rejoins for a fresh authorized
baseline and replaces the local Y.Doc instead of merging rejected operations
back into it. The editor rebinds to the replacement document. Recovery text stays
separate from the live document and can be copied or dismissed by the player;
it is never reapplied automatically. Browser storage preserves the copy across
reload when available, with an in-memory copy when storage is blocked.

The shared workspace requests a fresh collaboration baseline when the accepted
Match document revision or language differs from the client document. This
includes language resets that have no incremental collaboration frame. Editing
stays paused while a recovery copy awaits explicit dismissal, so a later failed
edit cannot overwrite an undismissed copy.

Recovery copies remain in memory by their full scope until explicitly dismissed.
A language change hides the other language’s copy but does not delete it,
including when browser storage is blocked.

## Saved document cache checks, 2026-10-12

Each cached Y.Doc now records its accepted application revision and language.
Before using it, TeamCollaboration checks that metadata against the fresh Match.
A difference requires a reload of the saved full document. A successful atomic
commit updates the cache metadata. Rollback and Round destruction clear it.

If an advanced document revision has no saved state, the operation fails rather
than replacing accepted text with a starter. Replacing a Y.Doc releases the old
document after the new state decodes. Same-revision cache reads preserve pending
frames that arrived before their dependencies.

Public ArenaEngine tests cover two engines with memory storage and separate
PostgreSQL pools. They check saved edits, Submit source, language reset history,
missing state, out-of-order updates, and rejected concurrent writes. The existing
optimistic Match revision check still rejects a write that loses a race.

This repairs the stale cache fault. Complete multi-server operation still needs
shared Match ownership, initial document ownership, realtime events, and Presence.

For a reload in the same language from a known saved baseline, the module keeps
one merged Yjs snapshot of prior cached and deferred state. Baseline reads expose
only the saved source. The next client write replays retained state, then applies
the new frame. Any resulting source change receives a new revision and clears
Ready through the existing atomic commit. Rollback, language reset, and Round
destruction discard deferred state. A valid row load records its metadata before
Match reconciliation so a read conflict can retry without losing pending frames.
