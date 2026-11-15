# Code Arena gameplay review

Status: agreed gameplay implemented and reviewed. The full `npm run check` suite passed on 2026-11-12 against the baseline worktree. A local four-client 2v2 browser run on 2026-11-12 confirmed shared editing and team isolation without completing a match. A subsequent four-client 2v2 run on 2026-11-13 against the single Game service instance progressed to terminal match completion on match deadline expiration (0:0 draw). On 2026-11-14, a local four-client 2v2 run completed all three rounds through evaluated, scored submissions on both sides, reaching normal MATCH_COMPLETE resolution. A separate-computer evaluator demonstration (G02) and production deployment checks remain outstanding.

## Progress

1. Confirm intended gameplay — decisions 1–8 agreed; round closure explained and acknowledged.
2. Review the integration — scoped source review and targeted existing tests completed; findings below.
3. Fix confirmed issues — implementation and focused regressions added.
4. Reconcile the gameplay specification and cross-service contracts — complete; the specification and ADR now agree on implemented behavior.
5. Run final checks and record environment limits — complete at that stage and not rerun for the current changeset; environment limits are listed below.

## Agreed rules

**Progression update:** ADR-0017 supersedes the shared-round closure and reveal bullets below. Each side now advances independently, opponent scores remain hidden until the match ends, and the 10-minute cap is measured per side and problem. The implementation and current verification status are tracked in ADR-0017.

Confirmed by the user on 2026-11-12:

- A match has three rounds sharing a 30-minute match budget.
- The latest completed scored submission counts, even if its score is lower than the previous submission. The interface must explain that Submit replaces the counted answer.
- Decide the winner by total score, then lower total counted-submission time, then fewer submissions, then a draw. Correctness takes priority over speed.
- In 2v2, an individual leaving must allow their teammate to continue. When the entire team is offline, start a 90-second forfeit window. Explicit team surrender is separate from an individual leaving.
- A remaining teammate may submit alone immediately after an explicit teammate leave, or after that teammate has been disconnected for 90 seconds. Before that timeout, both approvals remain required. Restore both-player approval if the teammate returns. The user specifically requires careful conflict handling.
- Team surrender requires agreement from both participating teammates; once solo continuation applies, the remaining teammate may decide alone.
- Historical shared-round rule: automatic reveal after both sides scored. Superseded by ADR-0017.
- Historical shared round deadline: superseded by ADR-0017's per-side, per-problem cap; accepted evaluations retain bounded grace.
- Keep the existing problem pool for this review. A larger pool is deferred; the user intends to add problems from the 42 Network later.

## Conflict behavior and regression coverage

- Engine match locks order readiness, edits, submissions, reconnects, leaves and surrender votes. The reconnect regression proves a solo submission accepted before a return remains valid while the returning teammate must approve again before a later submission.
- A teammate's earlier approval remains valid during the reconnect grace; after the member returns beyond grace, their readiness is removed. Shared document revision checks remain in the submission gate.
- Whole-team grace is enforced before a returning socket can clear expired offline state. Individual disconnection does not forfeit while the partner remains available; the 90-second timer begins when the whole side is unavailable.
- Duplicate and late socket closes remain idempotent; a gateway regression covers disconnect while the baseline snapshot is pending.
- Surrender votes are invalidated by presence changes and departure. Snapshot readiness and vote details are private to the viewer's team; the realtime surrender event carries only match ID and revision to trigger a safe refresh.
- A completed match rejects further surrender mutations. Votes and individual presence/leave changes are scoped to the affected team.
- A Run accepted before an individual leaves can finish and restore the shared team activity; new actions by the departed member remain rejected.
- Automatic reveal now checks the counted-score condition inside the engine and does not depend on the submitting user's later membership.
- Account erasure removes the original ID from departure and surrender-vote state, retaining departed status only under the new anonymous ID.

Focused regressions cover these rules. PostgreSQL-backed integration tests and a local four-client browser run are recorded in the follow-up verification below; the browser run did not complete a match. Multi-instance concurrency and separate-computer evaluation remain unverified.

## Implementation rulings

- **Both teammates explicitly leave:** do not forfeit immediately; record both as departed and apply the same 90-second whole-team unavailability window. This follows the confirmed rule that the whole team must be unavailable for 90 seconds, while a separate explicit surrender flow requires consent. Cost if wrong: a team that intends an immediate exit waits up to 90 seconds for its result.
- **Both team grace windows have expired before a sweep:** the side that became fully unavailable first forfeits. This keeps tie handling deterministic and follows the existing 1v1 earliest-offline rule. Cost if wrong: when both teams miss the timeout together, the other side may receive the win.
- **Surrender notification visibility:** send a match refresh signal without voter identity or vote details; snapshots expose votes only to that team. This preserves the snapshot privacy boundary. Cost if wrong: clients cannot build a public opponent-facing surrender notification from the realtime payload.

## Open decisions

- Round deadline policy (resolved in TICKET-12): Approved and implemented per-round 10-minute coding deadline starting at first CODING transition, bounded evaluation grace for pre-cutoff submissions, 30-minute match cap, zero score for unsubmitted sides, UI countdown with low-time warning, and reveal explanation. Multi-instance reveal coordination and active-socket token expiry remain separate design concerns.

## Scoped review findings

### Existing reconnect defect — resolved

`services/game/src/game/match-socket-presence.ts:46` deletes the socket-count entry, awaits match information, then writes offline presence. A replacement socket can finish its online update during that await, only to be overwritten by the older close operation. A read-only in-memory execution of the existing module reproduced `online, online, offline` while the replacement socket remained open. In 1v1 this can start an incorrect forfeit countdown. Serialize presence transitions per match/user and verify the current connection generation before committing presence.

Related source-trace concern: the gateway now attaches the verified principal before awaited snapshot/presence work, checks `connected` around presence registration, and cleans up an open registration if the connection drops. `game.gateway.test.ts` covers disconnect during the baseline snapshot.

### Gaps against the newly agreed team rules — resolved

- `packages/arena-game/src/engine.ts:1212`: individual leave records a whole-side forfeit. Separate member departure from explicit team surrender; require current team consent for surrender.
- `packages/arena-game/src/engine.ts:1185`: all 2v2 matches bypass grace forfeits. Compute the team-offline window from authoritative member state.
- `packages/arena-game/src/team-collaboration.ts:118` and `packages/arena-game/src/engine.ts:565`: every original teammate must approve the current revision. Add the agreed solo-approval policy without weakening revision checks. Align the frontend gate in `client/components/arena/ArenaWorkspace.tsx`.

The old tests encoded the prior policy. New regressions cover the agreed rules, including 2v2 leave/continue, whole-team grace, solo readiness, return-to-team approval, surrender consent and cancellation on presence change.

### Documentation drift — resolved

ADR-0015 now reflects implemented account erasure and progression and records the deliberately small current problem pool. The integration specification records the agreed timer, scoring, reveal and 2v2 continuity rules.

### Whole-branch review — repairs complete

A fresh-context review found five important issues: post-terminal surrender mutation, an in-flight Run stranded by caller departure, auto reveal tied to the departing submitter, cross-team vote loss, and identifiers retained in the new erasure fields. Failing regressions reproduced each issue; the focused engine/account-erasure tests passed at that verification stage and were not rerun for the current changeset.

The earlier ADR/spec mismatch about invitation availability is resolved: ADR-0015 now states that the Chat invitation card shows a live status badge and that Game checks joinability again when a participant opens or joins the room.

### Conditional risks outside the first repair

- Ordinary reveal waits for pending evaluations held by the current Game process, unlike deadline closure, which queries durable pending rows. A second Game service instance could close a round before an accepted replacement on another instance finishes within reveal grace. ADR-0016 chooses one Game service instance for the initial release; adding instances requires a separate coordination design and tests.
- Socket authentication checks JWTs on connection, while subsequent actions use the stored principal and account-deletion guard. Active-socket token expiration needs an explicit session policy; this review does not classify handshake-only authentication as an independently proven exploit.

## Verification evidence

**The test totals in this section are historical.** They were recorded before the current changeset added its engine, service, gateway and client regressions. They are not the current counts; the full verification of the current worktree is recorded below.

Historical baseline, 2026-11-12: 143 existing tests passed across 20 files:

- Engine: deadline closure, team rules/collaboration, reconnects, concurrency, scoring/reveal, and cross-side isolation — 84 tests across 7 files.
- Service: presence counting, judge factory, socket authentication, development fixture gate, and problem selection — 15 tests across 5 files.
- Engine: trusted container verdict handling, submissions, sealing, and account erasure — 28 tests across 4 files.
- Service: progression, statistics erasure, and active-account guard — 5 tests across 3 files.
- Real Docker judge security/isolation matrix — 11 tests in 1 file. The initial sandbox run could not reach Docker; the same suite passed after Docker access was granted.

At the initial scoped review stage, the PostgreSQL integration suite and live four-player browser demonstration had not run. The original results below record that stage. The follow-up section records later checks. No production deployment check has been run.

Usage-limit tooling was unavailable: the offline `ccusage` attempt reported no cached package. The review was bounded to two focused read-only agents and targeted checks.

## Implementation pass

1. Serialize presence transitions; attach the gateway principal early; add reconnect and early-disconnect regressions — complete.
2. Implement departures, whole-team offline expiry, solo readiness, return-to-team approval, and consent-based surrender — complete with targeted engine tests.
3. Align controls and explanatory copy for replacement submissions, automatic reveal, reconnect approval and surrender — complete.
4. Update the Game-to-Chat surrender event contract and reconcile the gameplay spec/ADR — complete.
5. Run root arena checks, Chat tests/build/lint, typechecks, and the disposable database integration suite; record final review — complete at that stage. The database suite passed. The earlier totals above are historical; the full verification was rerun against the current worktree and is recorded below. A local four-player run was performed later; the separate-computer evaluator and production deployment checks remain outstanding.

Earlier detailed verification record on 2026-11-12 (historical baseline; the later full check is recorded below):

- `npm test`: 387 passed, 41 skipped. Arena engine 214 passed / 30 skipped; harness 19 passed; model 68 passed; Game service 72 passed / 11 skipped; judge worker 14 passed. The repository intentionally removes database URLs for this general test command.
- `npm run test:integration`: passed with a temporary PostgreSQL and RabbitMQ setup bound to localhost; the runner removed both containers after completion. Arena engine database group 60 passed; Game Postgres/reconnect group 15 passed; Chat Postgres group 20 passed; User Postgres group 17 passed. This exercised the 41 database-dependent cases skipped by `npm test`.
- `npm run typecheck`: passed, including package builds and workspace TypeScript checks.
- Root lint, Chat lint, Chat build, Chat tests (24/24), client TypeScript check, and `git diff --check`: passed.
- Docker-backed arena security and execution cases ran successfully in the root suite. At that verification point, no production deployment check or live four-player browser demonstration was available.

Completion condition met for the implementation and database verification pass at that stage: agreed rules are enforced in the engine and HTTP/socket boundary, the client and Chat notification reflect server authority, and the unit and database-backed regressions passed at that stage. See the follow-up below for later live-run evidence and current limits.

## Follow-up verification — 2026-11-12

- The earlier root test report counted 395 passed and 41 skipped. That report predates the current changeset; the full verification below supersedes it. The integration runner then ran 112 database/socket tests using disposable PostgreSQL and RabbitMQ containers. Two initial RabbitMQ readiness attempts failed; a retry passed.
- `npm run typecheck` and `npm run lint` passed. The focused client socket test passed 3/3.
- Four isolated browser contexts joined one local 2v2 match on the single Game service instance. Alpha2's edit appeared in Alpha1; the Beta clients retained their own shared document; Alpha's two visible tests passed with output `10`. The run did not complete the match: no scored round, final result or final draw was recorded, and the four saved screenshots show round 1 of 3 with both sides at 0. The rebuilt client kept snapshot reads near the expected two-second sync cadence, without bursts or 429 responses, and showed no browser console warnings or errors during the check.
- The browser run happened before the final boot-recovery reveal change. That change has unit and PostgreSQL-backed integration coverage; it was not repeated in a browser session.
- Four dark screenshots are saved at 3456×1992 pixels in `docs/book/assets/code-arena-live-2v2-*.png` and included in the rebuilt Nook Book. The local test containers and network were stopped after the run; their database volumes were preserved.
- This run used four browser contexts on one computer. It does not prove play across separate computers or production behavior. Multiple Game service instances remain out of scope under ADR-0016; active-socket JWT expiry still needs a separate session-policy decision.

## Current full verification — 2026-11-12

`npm run check` passed all 21 verification stages on the current worktree, including secret scanning, lint, builds and type checks, Arena, client, Chat and User tests, and disposable PostgreSQL/RabbitMQ integration suites. Some unit suites skip database-dependent cases; the matching database suites ran and passed in the integration stage. The check ran with HEAD at `348a844` and a dirty worktree, so it verifies the changes present at that time rather than a committed revision. It does not establish separate-computer play or production deployment.

## Follow-up verification — 2026-11-13 & 2026-11-14

- **2v2 Terminal Completion Evidence:** On 2026-11-13, a four-client 2v2 run against the single Game service instance assembled in lobby (`docs/evidence/arena-2v2-scored/02-lobby-four-players.png`), readied up (`03-lobby-ready-to-start.png`), and ran until match deadline expiration (`00:00`), successfully reaching terminal match completion (`MATCH COMPLETE`, 0:0 draw, `04-timeout-result-diagnostic-not-book.png`). This demonstrates that 2v2 matches advance to final terminal resolution and draw state on timeout. Because neither team submitted code, that run did not exercise a completed 2v2 match via scored submissions; the later scored run is recorded below. All four browser contexts ran on one computer; this does not satisfy separate-computer evaluation (G02) or prove production deployment.
- **Local Browser Authentication Milestones:** On 2026-11-14, the user confirmed both Discord and GitHub local browser login functional at `https://localhost:18443` against the live local `nook-live2v2` stack. Private temporary environment files provided valid credentials securely without source or volume exposure, secret values were not displayed in output or committed to version control, and only the User service was recreated to load them.
- **2v2 Three-Round Scored Completion Evidence:** On 2026-11-14, a local four-client 2v2 match (`Match ID: ce7c4810-3501-44ac-b193-172f8dda2380`) on the live local `nook-live2v2` stack completed all three rounds through evaluated, passing submissions from both teams in every round (Round 1: Even Ledger Python, 100 vs 100; Round 2: Double It Python, 100 vs 100; Round 3: Sum Array Python, 100 vs 100). Both teams used mutual readiness approval to submit, advanced cleanly through all three score reveals, and reached server-authoritative normal terminal match completion (`MATCH COMPLETE`, final score 300:300) without surrender, forfeit, or timeout. Rebuilt client image `sha256:e706b77a3a4231c17cbb4c494e1111ddcd566056198214a4a2ed408ea0696ed1` incorporates accepted F1 auth fixes; final-result modal screenshots were inspected at desktop (1440), tablet (768), and mobile (375) widths. These images establish modal layout only, not every coding-workspace control at those widths. All four browser contexts ran on one computer; this does not satisfy separate-computer evaluation (G02) or prove production deployment.
- **Client Transport Session Renewal & Tiebreak Alignment:** The client transport (`SocketArenaTransport`) now refreshes tokens proactively within a 60-second expiration skew, halts polling upon unrecoverable 401s to prevent request storms, and honors the server's authoritative `final.winner` directly when scores are tied rather than relying on client score heuristics.
- **Language Capability Guards:** `packages/arena-game/src/engine.ts` enforces `requireProblemLanguage` against available starters and routes non-Python snippet requests to `stdio`, ensuring snippet execution is bounded to Python while C/C++ run via `stdio`.
- **Source Byte Admission & Judge Transport Bounds (TICKET-13 & TICKET-14):** `packages/arena-game/src/engine.ts` enforces `Buffer.byteLength(source, 'utf8') <= maxSourceBytes` (100 KiB) across Run and Submit, rejecting oversized multibyte payloads before attempt mutation or judge dispatch. Public Run/Submit controllers retain their separate 65,536-character request-code limit. In `container-judge.ts`, Docker CLI `-e` arguments are replaced with bounded stdin payload streaming (up to 8 MiB) and explicit bounded container cleanup (`docker rm -f`) on orchestrator timeout. The tested timeout path left no new containers; an unavailable Docker daemon can still prevent cleanup.
- **Full Consolidated Gate Verification (22/22):** On 2026-11-14, root `npm run check` completed all 22 verification stages (`ok: true`, `dirty: false`, artifact generated `2026-11-14T18:11:51.960Z` at consolidated candidate commit `048e7db`), validating packages, services, client, lint, typecheck, source byte admission (3/3), and judge payload transport (15/15) with zero leaked containers.
