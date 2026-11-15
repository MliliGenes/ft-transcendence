# Plan: Independent per-side progression in Code Arena ("async rounds")

Branch: `feature/arena-async-rounds` / repair branch `fix/arena-async-rounds-review`.
Status: Implemented and repaired. Core async rounds logic, pre-dispatch stale pending guards, canonical ID binding, retry receipt idempotency, 2v2 original document binding, document draft scoping, decoupled polite score status notice, and test suites adapted. 32/32 non-container engine suites (259 tests) pass; 5/5 container suites (45 tests) pass on Kiri Docker; 120/120 client tests pass; 4/4 coordinator editor tests pass; 5/5 coordinator diagnostic invariants pass. Full project gate `npm run check` completed 100% cleanly (exit code 0).

> Implementer: read this whole file first. Before each step, open the named files and
> confirm the code still matches what is described here. Line numbers are approximate.
> Where the plan says VERIFY, check the code instead of trusting the plan.
> Commits: author only as `MliliGenes`. Do NOT add any `Co-Authored-By` line.
> Run `npm run check` (see `docs/project/VERIFICATION.md`) at the end and after each major step
> where practical.

---

## 1. Goal and decided behavior

Today both sides share ONE round clock. After a player submits, their editor is done for that
round and they wait until the opponent also has a counted score (or the round deadline hits).
The reveal then happens for both, and both advance together.

New behavior (confirmed by the user):

1. **Independent races.** Each side (player in 1v1, team in 2v2) moves through problems
   1..`totalRounds` (3) on its own. When a side's submission gets a counted score for problem N,
   that side immediately advances to problem N+1. It never waits for the opponent.
2. **No per-problem reveal to the opponent.** A side's per-problem scores and hidden-group
   results stay hidden from the opponent until the whole match completes. The opponent may only
   see a progress indicator (e.g. "Opponent: problem 2 of 3", "Opponent finished").
   A side may see its OWN score for a problem right after it is scored (a short "scored" notice
   on advance), because this is its own data.
3. **Match ends** when both sides are FINISHED (all problems done) OR the 30-minute match
   deadline hits OR a forfeit happens. Then the final reveal for all rounds is published and the
   existing winner logic runs.
4. **Tiebreak unchanged:** total score, then lower total counted-submission time, then fewer
   submissions, then draw. `computeFinal` already works from per-round `counted`/`attempts`
   so it is reused.
5. **Per-problem deadline (ASSUMPTION, not re-confirmed by user):** each side gets a
   per-problem cap equal to the existing `roundDurationMs` (the ~10-minute window from
   TICKET-12), measured from when THAT side started that problem, and always clamped by the
   match deadline (`startedAt + durationMs`). When a side's per-problem cap expires with no
   counted score, that problem scores 0 (`noSubmission`) for that side and the side advances.
   If the user later wants "only the 30-minute budget", set the per-problem cap to the match
   deadline (one-line change in the helper described in step 3).

### Non-goals
- No change to scoring formulas, judge, problem bank, matchmaking, lobby, presence/grace/forfeit
  semantics (forfeit still ends the match immediately).
- No resubmission after a problem is counted (same as today).

---

## 2. Key insight that keeps the change small

`RoundState` (in `packages/arena-game/src/records.ts`) already stores `counted`, `attempts`,
`activities`, `runTests` **keyed by side**, and `teamDocs` keyed by side, `readiness` keyed by
userId. So two sides can already live on different `rounds[i]` entries without restructuring
those fields. What is NOT per-side today and must change:

| Today (shared)                                   | New                                                         |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `MatchRecord.currentRound` (one number)          | `MatchRecord.sideProgress[side].currentRound`               |
| `RoundState.codingDeadlineMs` (one per round)    | `sideProgress[side].problemDeadlineMs`                      |
| `RoundState.closing / cutoffPassed / superseded` | per-side maps (see 3.1)                                     |
| `RoundState.reveal` (per round, mid-match)       | filled for all rounds only at match completion              |
| Global `roundPhase` cycling per round            | global `roundPhase` is match-level; per-side stage in `sideProgress` |
| `autoRevealIfAllSidesCounted` gating             | removed                                                     |
| `canSubmit(phase, ...)` uses global phase        | also requires the side's stage to be `CODING`               |

Keep `match.currentRound` as a **derived/compat field** (see 3.1) so unmigrated code and the
client keep compiling while you migrate.

---

## 3. Step-by-step implementation

### Step 1 — Model types (`packages/arena-game/src/records.ts`, `packages/arena-model/src/*`)

3.1 Add to `records.ts`:

```ts
export type SideStage = "CODING" | "FINISHED";

export interface SideProgress {
  /** 1-based problem index this side is currently on. When FINISHED, equals totalRounds. */
  currentRound: number;
  stage: SideStage;
  /** Server-owned deadline for the CURRENT problem (ms epoch). null until coding starts. */
  problemDeadlineMs: number | null;
  /** Set when stage becomes FINISHED. */
  finishedAtMs?: number | null;
}
```

Add to `MatchRecord`:

```ts
sideProgress: Partial<Record<SideId, SideProgress>>;
```

Keep `currentRound` on `MatchRecord` but redefine its meaning as
`max(sideProgress[*].currentRound)` ONLY for backward-compat display; add a comment that it is
derived and must not drive logic. Do not write new logic against it.

Change these `RoundState` fields to per-side where they are per-side concepts:

```ts
closing: Partial<Record<SideId, boolean>>;
cutoffPassed: Partial<Record<SideId, boolean>>;
superseded: string[];            // evaluation ids; stays a flat list (ids are unique)
codingDeadlineMs?: ...           // REMOVE (moved into sideProgress)
reveal: RevealSnapshot | null;   // kept; only populated at match completion
```

VERIFY every usage with `Grep` for `\.closing`, `cutoffPassed`, `codingDeadlineMs`,
`\.reveal`, `currentRound` across `packages/`, `services/`, `client/`. List all hits first and
fix them all; the TypeScript compiler (`npm run typecheck` or the workspace equivalent from
`docs/project/VERIFICATION.md`) is the safety net.

3.2 `packages/arena-model/src/transitions.ts`:
- Keep `ROUND_LEGAL` and the global `RoundPhase`, but redefine usage: the global phase is the
  **match** phase. Match flow: `MATCH_FOUND -> ROUND_INTRO -> CODING` (stays `CODING` for the
  whole race) `-> SCORE_REVEAL` (final reveal, all rounds) `-> MATCH_COMPLETE`.
  `ROUND_LEGAL` already allows `SCORE_REVEAL -> MATCH_COMPLETE`; leave it.
- Keep `publishRoundReveal` and `RevealCause` unchanged (final reveal still goes through it,
  causes: `REVEAL_CONDITION_MET` = both sides finished, `MATCH_DEADLINE`).
  `ROUND_DEADLINE` cause becomes unused for match-level reveal; keep the type member to avoid
  breaking persisted events, mark with a comment.
- Add a per-side gate next to `canSideSubmit`:

```ts
export type SideStage = "CODING" | "FINISHED"; // or import from records if no cycle; prefer defining in arena-model and importing into records.ts

export function canSubmitAsync(
  phase: RoundPhase, stage: SideStage, mode: MatchMode, readiness: Readiness,
): boolean {
  return stage === "CODING" && canSubmit(phase, mode, readiness);
}
```

  (Place `SideStage` in arena-model to avoid a package cycle; import it in `records.ts`.)
  `canRun`, `isEditable` get the same treatment: add `stage`-aware variants or add an optional
  `stage` argument. Do NOT break existing signatures used by tests; add new functions.

### Step 2 — Lifecycle (`packages/arena-game/src/round-lifecycle.ts`)

Add side-scoped methods; keep old ones only if still referenced, then delete dead ones at the end.

- `private roundOf(match, side): RoundState` → `match.rounds[progress.currentRound - 1]`
  using `match.sideProgress[side]`. Throw `IllegalStateError` if missing.
- `beginCoding(match, startedAtMs, problemCapMs)`:
  - Global: if `roundPhase` is `ROUND_INTRO`, transition to `CODING` (idempotent if already).
  - For each side in `matchSides(match)`: create `sideProgress[side] = { currentRound: 1,
    stage: "CODING", problemDeadlineMs: min(startedAtMs + problemCapMs, matchDeadline),
    finishedAtMs: null }` if absent (idempotent: never reset an existing one) and set
    `rounds[0].activities[side] = "coding"`.
- `advanceSide(match, side, nowMs, problemCapMs): SideAdvance`:
  - Preconditions: global phase `CODING`; side stage `CODING`.
  - If `progress.currentRound >= match.totalRounds`: set `stage = "FINISHED"`,
    `finishedAtMs = nowMs`, `problemDeadlineMs = null`; set that round's `activities[side] =
    "locked"`; return `{ finished: true }`.
  - Else: lock the old round's activity for the side (`locked`), `currentRound += 1`, set the
    new round's `activities[side] = "coding"`, `attempts[side]` stays unset (0),
    `problemDeadlineMs = min(nowMs + problemCapMs, matchDeadline)`.
    For 2v2: reset `readiness` entries for that side's members on the NEW round
    (`rounds[n].readiness` is keyed by userId — only clear the advancing team's members, never
    the other team's) and init `teamDocs[side] = { revision: 1, language: previous language ??
    "Python" }`. VERIFY how `readiness` is keyed/seeded today in `engine.ts` before editing.
  - Recompute derived `match.currentRound = max(...)`.
  - Return `{ finished, previousRoundId, newRoundId, activityResets }`.
- `bothFinished(match): boolean` → every side in `matchSides` has `stage === "FINISHED"`.
- `expiredSides(match, nowMs): SideId[]` → sides with `stage === "CODING"` and
  `problemDeadlineMs != null && nowMs >= problemDeadlineMs`.
- `createFinalReveal(match, input)` / `commitFinalReveal(match, snapshots, cause)`:
  builds one `RevealSnapshot` per round (use existing `createReveal` logic but parameterized by
  round index instead of `match.currentRound`), stores each in `rounds[i].reveal`, then sets
  `roundPhase = publishRoundReveal("CODING", cause)` (= `SCORE_REVEAL`).
  Totals in each snapshot must be cumulative through that round (existing semantics: replicate
  what `publishRevealInternal` computes today; VERIFY).
- `totalScore(match, side)`: change to sum over ALL rounds up to the side's own
  `currentRound` (or all rounds; unscored rounds are 0 anyway) — use all rounds.
- `computeFinal` / `matchSides`: leave as-is. NOTE `matchSides` reads `rounds[0].activities`;
  that still has both keys because `beginCoding` seeds round 1 for both sides. Keep it so, or
  prefer `participants`/`sideProgress` keys first. Add a test.
- Delete (or stop using) `beginReveal`, `prepareReveal`, `prepareDeadlineReveal`, `createReveal`,
  `commitReveal`, `finishAtDeadline`, old `advance` only AFTER the engine no longer calls them.

### Step 3 — Engine (`packages/arena-game/src/engine.ts`)

Open the file and locate these methods (names stable, lines approximate):
`beginCoding` (~377), `submit` (~580-770), `publishReveal` / `autoRevealIfAllSidesCounted` /
`publishRevealInternal` (~772-900), `sweepGrace` / `sweepExpiredMatches` (~1120-1145),
`closeExpiredMatch` (~1147-1260), plus recovery/snapshot builders. Do the following.

3.a **Helper** `problemCapMs(match, startMs)`: `Math.min(startMs + this.roundDurationMs,
match.startedAt + match.durationMs) - startMs` or simply return the deadline via a
`problemDeadline(match, startMs)` helper = `Math.min(startMs + this.roundDurationMs,
match.startedAt + match.durationMs)`. This is the ONE place the cap rule lives (assumption in
section 1.5).

3.b **`beginCoding`**: delegate to the new `RoundLifecycle.beginCoding`, passing a start time.
Keep it idempotent. Emit the same event as today for CODING start.

3.c **`submit`**: replace the global-phase gate with the side-aware gate:
  - Resolve `side`'s `sideProgress`; reject (`IllegalStateError`) if stage != `CODING` or
    global phase != `CODING`.
  - Use `rounds[progress.currentRound - 1]` instead of `rounds[match.currentRound - 1]` for
    attempts, SubmissionRecord `roundId`, `problemVersionId`, `documentRevision`.
  - Reject if the side's per-problem deadline has passed (`closing[side]`/deadline) with the
    same error code the old round-closing gate used (VERIFY the code name).
  - `elapsedMatchMs` stays `now - match.startedAt` (used for tiebreak time). VERIFY that
    `scoringTimeMs` in `CountedResult` is derived from match elapsed, not round elapsed; keep it
    consistent so tiebreaks are unchanged.
  - Nothing here waits for the opponent.

3.d **Evaluation completion** (where a judge verdict becomes `counted[side]`; find via the
  `this.evaluation.run(...)` completion path): after writing `counted[side]` for that
  submission's round, call `advanceSide(match, side, now)` **only if** the submission's round ==
  the side's current round and the submission was a competitive verdict (the existing code
  already decides when a result is "counted"; advance exactly when a result becomes counted).
  Non-competitive verdicts (compile error etc. — `isCompetitiveVerdict` false) keep the side on
  the same problem as today (VERIFY today's behavior and mirror it).
  After advancing, if `bothFinished(match)` → call the final reveal (3.f).
  Emit new events (3.g). Bump `match.revision` once per committed change (follow existing
  pattern).

3.e **Replace reveal gating.** Delete `autoRevealIfAllSidesCounted` and the
  `sides.every(side => round.counted[side] !== undefined)` check. Remove the call to it in
  `services/game/src/game/game.service.ts` (`submit()` wrapper, ~338-345). If something else
  (controller/test) calls `publishReveal`, keep a thin method that now means "publish the FINAL
  reveal" and is only reachable via `bothFinished` or deadline.

3.f **Final reveal** `publishFinalReveal(matchId, cause)`:
  - Under `withMatchLock`. Idempotent: no-op if `roundPhase` already `SCORE_REVEAL` /
    `MATCH_COMPLETE`.
  - Cutoff: mark every still-`CODING` side's current round `cutoffPassed[side] = true`,
    supersede in-flight evaluations (reuse the existing in-flight-evaluation settle/grace logic
    from `publishRevealInternal`, `graceMs` behavior included — VERIFY and reuse, do not
    reinvent), set unfinished sides' stage `FINISHED`, and mark rounds with no counted score
    for a side as `noSubmission[side] = true` in that round's snapshot.
  - Build one snapshot per round, commit via `commitFinalReveal`, compute `computeFinal`, then
    continue into the existing match-completion path (persist, rating/progression hooks, events
    such as the one Chat consumes — VERIFY the contract in `docs/spec/code-arena-integration-spec.md`
    and do not change payload shapes consumed by other services).
  - Cause: `REVEAL_CONDITION_MET` when both finished; `MATCH_DEADLINE` for the 30-minute expiry.

3.g **Deadlines** — rework `sweepExpiredMatches` / `closeExpiredMatch`:
  - Per match each tick: (1) if now >= match deadline → `publishFinalReveal(MATCH_DEADLINE)`.
    (2) else for each `expiredSides(match, now)`: apply "problem timeout" for that side: if no
    counted score in its current round, record no-submission (score 0, no time), settle/supersede
    its in-flight evaluation (reuse grace logic), then `advanceSide`. If that finishes both sides →
    final reveal. Lock the match for each mutation (`withMatchLock`).
  - The old per-round `ROUND_DEADLINE` reveal path is deleted.
  - Edge: a side that times out while an evaluation is in flight: honor the existing grace
    (`graceMs`) so a just-submitted solution still gets counted; mirror `publishRevealInternal`.

3.h **Events / snapshots** (find the event emitter and snapshot builder in engine/GameService):
  - New/changed events (names are suggestions; match existing naming style): `side-advanced`
    `{ matchId, side, fromRound, toRound, ownScore? , revision }` (own score sent ONLY to that
    side's members), `side-finished`, `progress` public payload
    `{ sides: { [side]: { currentRound, stage } } }` visible to both sides,
    final `reveal` event unchanged in shape but now carries ALL rounds.
  - **Privacy rule (critical):** per-side snapshot builders must NOT include the opponent's
    `counted`, `attempts`, `groups`, hidden-test results, or `reveal` before
    `roundPhase` is `SCORE_REVEAL`/`MATCH_COMPLETE`. Today the snapshot may expose opponent
    fields; audit the snapshot builder (grep `snapshot` in engine.ts / game.service.ts /
    gateway files) and filter per viewer. Opponent only gets `{currentRound, stage}`.
  - Reconnect: a snapshot for a viewer must reconstruct that side's current problem, its
    `runTests`, editor state keys for the current round, and its `problemDeadlineMs`.

3.i **Persistence & recovery**:
  - Find the persistence layer (grep `rounds` / `JSON` / repository in `packages/arena-game` and
    `services/game/src`). Persist `sideProgress` and the per-side `closing/cutoffPassed`.
  - **Migration/compat for in-flight matches:** when loading a match lacking `sideProgress`,
    synthesize it: for each side `{ currentRound: match.currentRound, stage: roundPhase ===
    "CODING" ? "CODING" : (roundPhase is reveal/complete and currentRound==totalRounds ?
    "FINISHED" : "CODING"), problemDeadlineMs: rounds[currentRound-1].codingDeadlineMs ?? null }`;
    convert boolean `closing/cutoffPassed` to `{ [side]: value }` for both sides. Put this in one
    `normalizeMatch()` used by load/recover paths. Add a test.
  - Restart recovery must re-arm nothing in memory: deadlines are derived from persisted
    `problemDeadlineMs` by the 1s sweeper, so just make the sweeper robust to `null`.

### Step 4 — GameService (`services/game/src/game/game.service.ts`)

- Remove the fire-and-forget `autoRevealIfAllSidesCounted` call in `submit()`.
- Timers: keep `deadlineTimer` (1s → `sweepExpiredMatches`) — it now also drives per-side problem
  timeouts. No new timer.
- Any REST/WebSocket DTOs and gateways that expose `currentRound` / `roundPhase` / `reveal`:
  update to the new per-viewer snapshot (grep in `services/game/src/game/`). Keep field names
  backward-compatible where the client still reads them; add `self` and `opponent` progress.

### Step 5 — Client (`client/components/arena/*`, `client/lib/*`)

Files: `ArenaWorkspace.tsx` (main), `ArenaTransport` (grep), `DuelPanel.tsx`, any reveal/result
components (grep `SCORE_REVEAL`, `reveal`, `roundPhase`).

- Derive the UI from the viewer's own `self.progress` (`currentRound`, `stage`,
  `problemDeadlineMs`) instead of the global `roundPhase`/`currentRound`:
  - `isCoding = roundPhase === "CODING" && self.stage === "CODING"`.
  - Problem statement, editor buffer, run results, test panel switch when `self.currentRound`
    changes. Editor buffer per round must be keyed by roundId so nothing leaks between problems
    (VERIFY how the editor state is keyed today).
  - Countdown: per-problem countdown from `self.problemDeadlineMs` plus the match countdown.
- On advance: show a short non-blocking notice "Problem N scored: X/100 — moving to problem N+1".
  Do NOT block the UI; pendingAction (`performAction`) must clear on advance so buttons are
  usable immediately.
- When `self.stage === "FINISHED"` but the match is not over: show "You finished all problems.
  Waiting for opponent (problem k of 3)" with no editor. This is the ONLY remaining waiting
  screen.
- Opponent indicator: small progress chip (problem k/3, or "finished"); never scores.
- Remove the mid-match per-round reveal screen. At `SCORE_REVEAL` show the final results screen
  using the multi-round reveal payload (per-round scores for both sides, totals, winner).
  Reuse existing reveal components by rendering one per round if possible.
- 2v2: readiness and shared-document UI must follow the TEAM's current round, not the global one.
- Update client tests in `client/tests/` accordingly.

### Step 6 — Docs / ADR / issue tracker

- Add `docs/adr/00NN-async-round-progression.md` (next free number; check `docs/adr/`) —
  supersedes the "automatic round closure once both sides have a scored submission" rule in
  `docs/spec/code-arena-gameplay-review.md`. Record: independent races, hidden opponent
  scores until match end, per-problem cap assumption, tiebreak unchanged, forfeit unchanged.
- Update `docs/spec/code-arena-gameplay-review.md` and `docs/spec/code-arena-integration-spec.md`
  (event/snapshot shapes) and `CONTEXT.md` vocabulary (add "Side progress", "Final reveal").
- Update `.scratch/arena-round-wait/spec.md`: mark superseded by the ADR (use the triage label
  convention from `docs/agents/triage-labels.md`; note it in the file, e.g. status/wontfix with
  pointer).

### Step 7 — Tests

Locations: `packages/arena-game/test/`, `services/game/src/game/*.test.ts`, `client/tests/`.
First list existing tests that reference reveal/round gating (`grep -rn "autoReveal\|SCORE_REVEAL\|
codingDeadlineMs\|currentRound"`) and rewrite them; do not just delete coverage.

New/updated engine tests (use existing test harness/fixtures):
1. Side A submits and gets counted → A is on round 2 immediately; B still on round 1; global
   phase still `CODING`; no reveal exists.
2. A can finish all 3 rounds while B is on round 1 → A `FINISHED`, match not complete.
3. Both finish → final reveal published once with 3 round snapshots, `cause =
   REVEAL_CONDITION_MET`, winner computed correctly; idempotent on repeat call.
4. Per-problem timeout: B submits nothing for problem 1 → after cap, B's round 1 is 0/
   `noSubmission`, B advances to round 2 with a fresh deadline; A unaffected.
5. Match deadline: both mid-race → `MATCH_DEADLINE` final reveal; unscored rounds 0.
6. Deadline clamp: per-problem deadline never exceeds match deadline.
7. Tiebreaks: equal totals → lower total counted time wins → fewer submissions → draw.
   (Reuse existing tiebreak tests where possible; they should pass unchanged.)
8. Non-competitive verdict (e.g. compile error) does not advance the side.
9. Submit rejected when side `FINISHED`, when global phase is not `CODING`, and for a stale
   evaluation of an old round (late verdict for round 1 arriving after advance must still
   record to round 1 but must NOT advance the side again — guard `submission.round ==
   progress.currentRound`).
10. 2v2: team A advancing does not touch team B's readiness/teamDocs; readiness is reset only
    for the advancing team's new round; shared-doc revision resets to 1 for the new round.
11. Privacy: snapshot for side A before final reveal contains no B `counted`/`groups`/`reveal`;
    only B `{currentRound, stage}`. After final reveal both are visible.
12. Recovery: persist mid-race state, reload via `normalizeMatch`, sweeper still times out the
    right side; legacy record without `sideProgress` migrates correctly.
13. Forfeit/surrender/grace during asymmetric progress still ends the match with the existing
    `computeFinal` forfeit path.
14. Concurrency: two submissions racing for the same side → only one counted advance (use the
    existing `withMatchLock` test style).

Client tests: progress chip, advance notice, finished-waiting screen, final results screen,
no opponent scores pre-final.

Final: `npm run check` must pass. Report any failure honestly with output; do not skip tests.

---

## 4. Suggested commit sequence (author MliliGenes, no co-author line)

1. `feat(arena-model): add side stage and async submit gates`
2. `feat(arena-game): add per-side progress model and migration`
3. `feat(arena-game): advance sides independently and final reveal`
4. `feat(game): per-viewer snapshots and progress events`
5. `feat(client): per-side problem flow and final results`
6. `test(arena): async round coverage`
7. `docs: ADR for async round progression, update specs and issue`

## 5. Risks to watch

- **Opponent data leak** in snapshots/events (biggest correctness risk) — test 11.
- **Stale evaluations** completing after a side advanced (test 9).
- **Double advance** from racing verdict + timeout sweeper — both must run under `withMatchLock`
  and re-check `stage`/`currentRound` inside the lock.
- **`matchSides()`** relies on `rounds[0].activities`; keep round 1 seeded for both sides.
- **Client editor state** leaking between problems.
- **Single Game instance** (ADR-0016): no multi-instance coordination needed; do not add any.
- **Chat integration contract**: do not change payload shapes other services consume.

## 6. Open question (default applied)

Per-problem cap: defaulted to existing `roundDurationMs` clamped by the match deadline
(section 1.5). Confirm with the user if behavior should instead be "only the 30-minute budget".
