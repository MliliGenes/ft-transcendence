# Code Arena Delivery Readiness & Verification Note

**Delivery Date:** 2026-11-14
**Workspace:** `nook-client`
**Target Integration Branch:** `integration/nook-arena-platform`
**Reference Delivery Commit:** `ae6a3aa75312597702ccdd3f82313a9fa7c6b1d4`
**Remote Integration Ref:** `ed4c149f0bb0b3e36ed4f16699551f6c8b3fc465` (PR #4 merge)
**Main Branch Ref:** `origin/main` (`c52c1d413e404dc154b38daebbc07be54ae55d8f`; prior checked ref `b01eabb6b4a49e2cf90425cba54765f4d19b663c`)
**Merged Platform Candidate Commit:** `afe99b8068bdf3e87ddc976fa12981ac55916b7a` (Normal merge of `origin/main` `c52c1d4` into local integration `f72a743`)

---

## 1. Executive Summary

This tracked delivery readiness document records the consolidated verification evidence, architectural policies, test results, and owner responsibilities for the Code Arena platform delivery.

All code, tests, documentation, and browser evidence have been reviewed, repaired, and validated across both the initial consolidated delivery and the reconciled integration candidate:
- **Historical Pre-Reconciliation Verification:** Pre-merge verification `npm run check` completed with **21/21 steps `ok: true`** (historical artifact generated `2026-11-14T15:50:04.103Z` at base HEAD `0ef74ba` dirty, prior to consolidation).
- **Post-PR4 Integration Candidate Verification:** Root verification `npm run check` completed with **22/22 steps `ok: true`** (`dirty: false`, artifact generated `2026-11-14T17:03:42.367Z` at `f72a743`), reconciling `ae6a3aa` with remote integration `ed4c149` (preserving Saad Elm's commits `5635641` and `fdc912e`, 1v1 language fallback, candidate bank/version guards, and all round deadline/auth recovery features).
- **Current Merged Candidate Verification (Latest Main Consolidation):** Full root verification `npm run check` completed with **22/22 steps `ok: true`** (`dirty: false`, artifact generated `2026-11-14T17:21:18.644Z` at commit `afe99b8068bdf3e87ddc976fa12981ac55916b7a`), covering merged code reconciling latest `origin/main` (`c52c1d4`) with integration platform delivery (`f72a743`). Fully preserves Saad Elm's email verification resend endpoint, DTO validation, and UI resend form alongside client graceful error handling, auth session recovery, and client verification view test coverage. Raw logs captured at `.scratch/code-arena/npm-check-2026-11-14-merged.log`.
- **Client Verification:** All **114/114 client tests passing** (`npm test`), ESLint clean (0 errors, 0 warnings), TypeScript compilation clean (`tsc --noEmit`). Includes new email verification view coverage (`email-verification-view.test.mjs`), 9 socket transport regressions (unsupported language fallback, offline on 401, transient error survival), F1 auth-provider session recovery, and client console error handling.
- **User Service Verification:** **95/95 unit/mock tests passing**, 22/22 Discord mock tests passing. Test harness port-churn stabilized. Includes `/auth/email-verification/request` route validation and token rotation.
- **Browser Runtime QA:** Real 10-minute round deadline verified on pre-reconciliation rebuilt client image `sha256:e706b77a3a4231c17cbb4c494e1111ddcd566056198214a4a2ed408ea0696ed1` (four-client 2v2 completed all 3 scored rounds, 100:100 each round, 300:300 final normal completion without forfeit or timeout); no new merged-tree browser claim made.
- **Deployment Qualification:** Deployment readiness remains qualified on existing pending owner actions: evaluators' multi-computer test (G02), Saad Elm live OAuth/domain deployment confirmation, and admin CI runner unblocking.

---

## 2. Verified Test Commands & Results

| Check / Suite | Command | Result | Scope / Notes |
|---|---|---|---|
| **Root Full Gate** | `npm run check` | **22/22 PASS (`ok: true`, `dirty: false`)** | Covers packages, services, client, lint, typecheck, integration. Duration: ~5m41s (generated `2026-11-14T17:21:18.644Z` at `afe99b8`). |
| **Client Test Suite** | `npm test` (in `client/`) | **114/114 PASS** | Includes email verification view (5), 9 socket transport regressions, F1 auth recovery, and feed carousel. |
| **Client Typecheck** | `npx tsc --noEmit` (in `client/`) | **PASS (exit 0)** | Zero type errors. |
| **Client Lint** | `npm run lint` (in `client/`) | **PASS (exit 0)** | Zero lint warnings/errors. |
| **User Service Tests** | `node --test ...` (in `user-service/`) | **95/95 PASS** | Zero failures. Includes email verification request and DTO tests. Ephemeral listener churn eliminated. |
| **Discord Mock Tests** | `node --test test/discord-oauth.test.mjs` | **22/22 PASS** | Red/green teardown fixture proves state isolation. |
| **Arena Game Suite** | `node scripts/checks/arena-tests.mjs` | **PASS** | 5/5 deadline regressions, 13/13 PostgreSQL tests pass. |
| **Source Byte Admission** | `npx vitest run packages/arena-game/test/source-byte-admission.test.ts` | **3/3 PASS** | TICKET-13: UTF-8 byte-length admission across Run/Submit. |
| **Judge Payload Transport** | `npx vitest run packages/arena-game/test/judge-payload.test.ts` | **15/15 PASS** | TICKET-14: Stdin framing, 8 MiB bound, binary NUL, and zero container leaks on timeout. |
| **Secret Prevention** | `node scripts/checks/secrets.mjs staged` | **PASS** | Zero staged credentials, keys, or forbidden files. |

*Local Verification Scope:* Automated suites run in sanitized mock environments with transient credentials. Browser QA was executed on pre-reconciliation images against the local disposable Compose stack (`nook-live2v2`) at `https://localhost:18443`.

---

## 3. Committed Evidence Assets

Sanitized screenshot evidence is tracked in the repository:

### 3.1 Round Coding Deadline & Guest Route Guard (`docs/evidence/arena-deadline-qa/`)
- [01-guest-match-sign-in-prompt.png](arena-deadline-qa/01-guest-match-sign-in-prompt.png): Unauthenticated guest profile immediately sees *"Sign in required"* card; no infinite loading spinner.
- [04-1v1-coding-round-timer-and-tests-passed.png](arena-deadline-qa/04-1v1-coding-round-timer-and-tests-passed.png): Real 10:00 round countdown in `ArenaHeader`.
- [05-1v1-submitted-waiting-for-opponent-deadline.png](arena-deadline-qa/05-1v1-submitted-waiting-for-opponent-deadline.png): Alpha submitted and passed; waiting for deadline while Beta has not submitted.
- [06-1v1-reveal-alpha-100-beta-unsubmitted-zero.png](arena-deadline-qa/06-1v1-reveal-alpha-100-beta-unsubmitted-zero.png): Real 10-minute deadline elapsed; reveal shows Alpha 100, Beta 0.
- [07-1v1-reveal-beta-zero-explanation.png](arena-deadline-qa/07-1v1-reveal-beta-zero-explanation.png): Explicit explanation displayed: *"Opponent received 0 points: no scored submission was completed before the round deadline."*

### 3.2 Full 3-Round Scored 2v2 Normal Completion (`docs/evidence/arena-deadline-qa/`)
- [15-2v2-round1-all-evaluated-reveal.png](arena-deadline-qa/15-2v2-round1-all-evaluated-reveal.png): Match `ce7c4810-3501-44ac-b193-172f8dda2380` Round 1 scored 100:100.
- [16-2v2-round2-evaluated-reveal.png](arena-deadline-qa/16-2v2-round2-evaluated-reveal.png): Round 2 scored 100:100 (cumulative 200:200).
- [17-2v2-round3-evaluated-reveal.png](arena-deadline-qa/17-2v2-round3-evaluated-reveal.png): Round 3 scored 100:100 (cumulative 300:300).
- [18-2v2-final-result-normal-completion.png](arena-deadline-qa/18-2v2-final-result-normal-completion.png): Server-authoritative terminal resolution: `MATCH COMPLETE`, cumulative score 300:300, normal completion (no surrender, no forfeit, no timeout).

### 3.3 Responsive Viewport Layout Audit (`docs/evidence/arena-deadline-qa/`)
- [19-layout-desktop-1440.png](arena-deadline-qa/19-layout-desktop-1440.png): 1440px desktop layout.
- [20-layout-tablet-768.png](arena-deadline-qa/20-layout-tablet-768.png): 768px tablet layout.
- [21-layout-mobile-375.png](arena-deadline-qa/21-layout-mobile-375.png): 375px mobile viewport showing clean fit of final result modal (`scrollWidth === clientWidth`). Note: confirms result modal viewport responsiveness; does not claim full coding editor optimization on mobile screens.

### 3.4 Preserved Prior Diagnostic Evidence (`docs/evidence/arena-2v2-scored/`)
- Preserves `02-lobby-four-players.png`, `03-lobby-ready-to-start.png`, and `04-timeout-result-diagnostic-not-book.png` (evidencing match expiration draw behavior).

---

## 4. Architectural Policies & Migration

1. **Additive PostgreSQL Database Migration:**
   - The round deadline is persisted via an additive column: `coding_deadline_ms BIGINT NULL` on `rounds`.
   - Backward-compatible: existing round records without `coding_deadline_ms` load cleanly with `null`.
   - Engine initialization stores the authoritative deadline on round start; surviving fresh connections, restarts, and reconnects without timer resets.
2. **Round Coding Deadline Policy (TICKET-12):**
   - Each round enforces a shared 10-minute coding deadline starting at the first CODING transition.
   - Cutoff boundary: new submissions are rejected at or after `min(roundDeadline, matchDeadline)`.
   - Bounded evaluation grace (2 seconds): submissions accepted before cutoff are evaluated. Expired pending evaluations are discarded and superseded by deadline closure, retaining prior scored results.
   - Unsubmitted sides receive zero points; early reveal is preserved when both sides submit scored solutions before cutoff.
3. **Single Game Instance Constraint (ADR-0016):**
   - Code Arena runs against a single Game service instance in the initial release. Cross-pod Redis/database pub-sub coordination for multi-instance deployments is deferred to post-evaluation milestones.

---

## 5. TICKET-11 Reliability & Test Harness Stabilization

1. **Remediation of Ephemeral Listener Churn:**
   - In `user-service/test`, SuperTest was dynamically binding and unbinding ephemeral ports on every HTTP request across test files that only invoked `await app.init()`.
   - By adding explicit `await app.listen(0)` and invariant guard `assert.ok(server.listening)` alongside `getHttpServer()`, the test harness maintains persistent listener ownership.
   - All 9 Nest test suites cleanly release resources in `t.after(() => app.close())`.
   - **Zero production code modified:** `git diff user-service/src` is completely empty.
2. **Proper Scientific Uncertainty & Historical Distinction:**
   - Two concrete transport-level failures were captured in raw logs before the fix: a `404 Not Found` on `POST /auth/refresh` (run-03) and an `ECONNRESET` (run-02).
   - In historical root run B, per-test stdout was filtered away, and the failure was not preserved. The exact failing test in run B remains unknown.
   - The historical upstream Discord mismatch (200 vs 502) did not reproduce during this investigation. While listener stabilization eliminates port churn, it does not prove the historical upstream root cause.
   - **TICKET-11 remains open (`ready-for-agent`)** to preserve this uncertainty honestly.
3. **Credentials Ownership:**
   - Saad Elm owns the live working Discord OAuth application configuration and client secrets.
   - Automated unit and integration tests run entirely against local mock stubs and require no external credentials.

---

## 6. Teammate Coordination & Shared Ref Integrity

1. **Saad Elm's Changes Protected:**
   - Published commits authored by Saad Elm — including `5635641` (console error handling and promise catching) and `fdc912e` (feed post carousel UI) — are preserved in the published history of `origin/integration/nook-arena-platform` (via merge commit `ed4c149`).
   - No teammate commits have been overwritten, rebased, or force-pushed.
2. **Semantic Overlap Audit:**
   - **Authentication / Session Contracts:** F1 client auth fix clears sessions only on genuine `401 Unauthorized` HTTP responses (`isAuthenticationRejection`), preserving sessions on transient network errors (status 0) or 5xx gateway errors. This complements Saad's graceful error handling in `5635641`.
   - **OAuth Redirects & Callbacks:** Local redirect URIs remain configured for `https://localhost:18443/api/auth/discord/callback` and `/github/callback`.
   - **Deployment & Config:** No changes to `envs/*.env`, Docker Compose service topologies, or proxy mappings.
3. **Precise Limitation & Latest Main Inclusion:**
   - Latest `origin/main` (`c52c1d4`) has been merged into local integration (`afe99b8`), fully preserving Saad Elm's email verification resend endpoint, DTO validation, and UI resend form alongside all Code Arena delivery features and auth recovery.
   - Any unpushed local changes in teammate working copies cannot be inspected from the repository.

---

## 7. Main Branch Readiness & Next Owner Actions

### Current Status
- `origin/main` (`c52c1d413e404dc154b38daebbc07be54ae55d8f`) is now cleanly merged into local `integration/nook-arena-platform` candidate (`afe99b8068bdf3e87ddc976fa12981ac55916b7a`).
- All 22/22 full gate verification checks pass on the committed candidate (`dirty: false`, artifact at `.verification/latest-full.json`).
- All pushes are held locally on `integration/nook-arena-platform` pending coordinator review and explicit authorization. Main itself remains untouched.
- The [branch completeness audit](branch-completeness-2026-11-14.md) records that the two source and judge findings have been fixed and verified: TICKET-13 enforces UTF-8 byte-length admission in `engine.ts` (100 KiB contract verified by `source-byte-admission.test.ts`), and TICKET-14 replaces Docker argv base64 arguments with bounded stdin transport (8 MiB upper limit) and explicit bounded container cleanup on orchestrator timeout in `container-judge.ts` (verified by `judge-payload.test.ts` with zero container leaks). Historical branch comparison limits, socket token expiry, and optional setup/eval documentation remain recorded. Review these verified findings and the owner actions below before deciding on promotion to `main` via PR #3.

### Remaining Owner Actions for this Evening

| Owner | Action | Description |
|---|---|---|
| **Coordinator / User** | **Authorize Main Update** | Review consolidated commit and delivery readiness note; authorize promotion from `integration/nook-arena-platform` to `main`. |
| **Team / Evaluators** | **G02 Multi-Computer Test** | Perform the required demonstration of Code Arena match completion and reconnect/recovery across **two separate physical computers**. (Local multi-tab browser QA confirms 2v2 logic but does not satisfy G02). |
| **Saad Elm** | **Deploy & Live OAuth** | Verify Vercel / staging deployment status, production domain configurations, and live Discord/GitHub OAuth provider redirect URIs. |
| **Repository Admin** | **CI Billing & Runner Check** | Confirm whether external GitHub Actions billing/runner startup limitations have been resolved. (Checked read-only / marked unverified in this report). |
