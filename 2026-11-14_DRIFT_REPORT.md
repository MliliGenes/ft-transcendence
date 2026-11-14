# EGM Drift Report — 2026-11-14

> **Audit Baseline:** Published integration baseline `cc76da64b4cef767a81d86b01c9a266acbdd32f5` (`origin/integration/nook-arena-platform`) with consolidated candidate `048e7dbcffee44a6da1b52e779a3da2936ede2d2` (`npm run check` 22/22 steps `ok: true`, `dirty: false` generated `2026-11-14T18:11:51.960Z`).
> **Audited Scope:** `README.md`, `CONTEXT.md`, `envs/README.md`, `docs/README.md`, all current text documents in `docs/services/`, `docs/integrations/`, `docs/project/`, `docs/spec/`, `docs/infra/`, `docs/adr/`, `docs/client-console-audit.md`, current delivery evidence in `docs/evidence/`, checked-in OpenAPI contracts `docs/api/*.openapi.json`, service/package READMEs (`packages/problem-bank/README.md`, `user-service/README.md`, `user-service/test/README.md`, `chat-service/README.md`, `client/README.md`), `scripts/play.sh`, and the generated handbook `docs/book/Nook-Book.pdf`.
> **Not-Audited Scope (Preserved Owner Responsibilities):** Live external OAuth provider deployment and staging domain configuration (Saad Elm owner action); G02 multi-computer physical demonstration across two separate physical machines (team / evaluator action); hosted GitHub Actions runner billing / availability check (repository admin action); unmerged historical lineages (`Aimane`, `game-service-revised`, `amal`, `chat-foundation` preserved as bounded historical branches); private `.keys/`, `.pem`, and uncommitted local `.env` files (ignored by design).

## README.md
- **Judge Execution Bounds & Stdin Transport Undocumented:** Sections "Architecture" (line 65) and "Data model overview" (line 124) stated that code runs in resource-limited containers with a bounded judge process, but omitted the explicit 100 KiB UTF-8 byte admission limit (`Buffer.byteLength(source, "utf8") <= maxSourceBytes` in `packages/arena-game/src/engine.ts`, TICKET-13) and bounded stdin payload streaming (up to 8 MiB) with explicit container cleanup (`docker rm -f`) on orchestrator timeout in `packages/arena-game/src/container-judge.ts` (TICKET-14). *Resolution: Sourced paths and symbols documented in lines 65 and 124.*
- **Full Verification Stage Count:** Section "Verification" (line 128) and commands (line 189) did not state the full 22-step verification count (`22/22 PASS`). *Resolution: Updated lines 128 and 189 to explicitly specify the complete 22/22 full project gate.*

## CONTEXT.md
- **Round Coding Deadline Undocumented in Glossary:** Section "Domain Glossary" (lines 30–42) defined `Match Deadline` (30-minute overall match budget) but omitted `Round Coding Deadline`: the server-authoritative 10-minute coding deadline starting at the first `CODING` transition, persisted in PostgreSQL `rounds.coding_deadline_ms` across restarts and reconnects, bounded 2s evaluation grace for pre-cutoff submissions, and zero score for unsubmitted sides. *Resolution: Added `Round Coding Deadline` definition and clarified 30-minute match budget.*

## envs/README.md
- **Backup Container Ownership Omitted:** Table "File ownership" (line 34) listed `game-db.env` as loaded only by Game database, omitting the `game-db-backup` container under the `database-only-backups` Compose profile. *Resolution: Updated table row to include `game-db-backup`.*
- **Game Route Gateway Omitted in Client Section:** Lines 52–54 stated that browser requests use `/api/` and `/api/chat/`, omitting `/api/game/`. *Resolution: Added `/api/game/` to the browser-facing API path list.*

## docs/README.md
- **Drift Report Index Stale:** Section "Engineering checks" (line 57) referenced only the dated 2026-11-12 drift audit without indexing the 2026-11-14 drift report. *Resolution: Updated line 57 to link both `2026-11-12_DRIFT_REPORT.md` and `2026-11-14_DRIFT_REPORT.md`.*

## docs/client-console-audit.md
- No drift detected. Document is an explicitly dated record of the 2026-11-13 console cleanup and preserves its original findings.

## docs/services/user-service.md
- No drift detected. Route table and auth section already accurately document `POST /auth/email-verification/request` and its 10-minute cooldown / single-use token invalidation semantics.

## docs/services/chat-service.md
- No drift detected. Contracts for messaging, group management, Socket.IO gateway, presence, and Game lifecycle notifications match current code.

## docs/services/client.md
- **Lobby Route Pattern Inexact:** Table "Routes" (line 39) listed `/play/lobby` instead of the dynamic parameterized route `/play/lobby/[code]`. *Resolution: Corrected route path to `/play/lobby/[code]`.*

## docs/services/infrastructure.md
- **Game Database Env Clarification:** Table "Environment files" (line 44) stated that User and Chat services load their database settings but did not specify that Game service loads `DATABASE_URL` from `game-service.env`. *Resolution: Clarified database configuration source for Game service.*
- **Database Backup Commands Omitted Game:** Sections "Start and inspect" (lines 109, 110–111), "Schedule and storage" (lines 122–123), and "Export a copy" (lines 131–132) omitted `game-db-backup` for logs inspection, manual execution, and volume export. *Resolution: Added `game-db-backup` to all command examples.*
- **Existing Database Monitoring Role Setup:** Section "Existing databases" (lines 280–283) listed `user-db` and `chat-db` but omitted `game-db`. *Resolution: Added command for `game-db`.*

## docs/integrations/user-chat.md
- No drift detected.

## docs/integrations/chat-storage.md
- No drift detected.

## docs/integrations/client-backend.md
- **Session Preservation & Unauthenticated Disposal Contract Undocumented:** Sections "Session" (lines 35–38) and "Errors" (lines 48–49) described refresh deduplication and `AuthRequestError` status but omitted the client auth session preservation contract implemented in `client/components/auth/auth-provider.tsx`: transient network errors (status 0) and 5xx server errors preserve the in-memory session and allow callers/polling to retry, while only true 401 unauthenticated responses (`isAuthenticationRejection`) dispose the session (`setSessionValue(null)`) and transition client transports to offline. *Resolution: Documented proactive renewal within 60s skew, session preservation on status 0 / 5xx, and session disposal on true 401.*

## docs/integrations/feed.md
- No drift detected.

## docs/project/COMPOSE.md
- No drift detected.

## docs/project/INTEGRATION_STATUS.md
- No drift detected. Preserves dated 2026-11-11 integration milestone.

## docs/project/POINTS_ROADMAP.md
- No drift detected. Preserves backlog and acceptance checks.

## docs/project/PROJECT_CONTEXT.md
- No drift detected. Confirmed decisions match current implementation.

## docs/project/VERIFICATION.md
- No drift detected. Accurately describes `npm run check` 22-stage full project gate.

## docs/spec/code-arena-integration-spec.md
- **Source Byte Admission & Stdin Judge Framing Undocumented:** Section "Service boundaries" (line 44) omitted the explicit 100 KiB UTF-8 source admission byte bound (`Buffer.byteLength(source, "utf8") <= maxSourceBytes` in `packages/arena-game/src/engine.ts`, TICKET-13) and 8 MiB stdin payload transport bound with explicit container cleanup (`docker rm -f`) on orchestrator timeout in `packages/arena-game/src/container-judge.ts` (TICKET-14). *Resolution: Updated Section "Service boundaries" to document UTF-8 byte admission, 8 MiB transport bound, and container timeout cleanup.*
- **Full Verification Reference Stale:** Section "Verification" (line 68) omitted reference to the consolidated 22/22 full gate results (`ok: true`, `dirty: false` on commit `048e7db`). *Resolution: Updated verification section.*

## docs/spec/code-arena-gameplay-review.md
- **Full Gate Count Stale & TICKET-13/14 Unrecorded:** Section "Current full verification" and "Follow-up verification" (lines 125–135) recorded historical 21-stage verification from 2026-11-12 and omitted the consolidated 22/22 full gate on commit `048e7db` (clean, generated 2026-11-14T18:11:51.960Z) as well as the resolution of TICKET-13 (100 KiB UTF-8 byte admission) and TICKET-14 (judge payload transport & container cleanup). *Resolution: Added follow-up entries recording 22/22 full verification, TICKET-13, and TICKET-14.*

## docs/infra/BACKUP_RECOVERY.md
- No drift detected. Covers User, Chat, Game, and MinIO snapshots and live restore safety gates accurately.

## docs/adr/0015-code-arena-nook-integration.md
- **Round Deadline Persistence Omitted:** Section "Consequences and known limits" (line 31) described the 10-minute round deadline but omitted that the deadline is persisted in PostgreSQL `rounds.coding_deadline_ms` across restarts and reconnects. *Resolution: Added persistence note.*

## docs/adr/0016-one-game-service-instance.md
- No drift detected.

## docs/evidence/arena-delivery-2026-11-14.md
- **Published Ref Status Clarification:** Section 7 (lines 127–129) stated that latest candidate fixes are consolidated on local integration candidate and pushes are held locally, but the integration baseline commit `cc76da6` (consolidating candidate `048e7db`) is already published on `origin/integration/nook-arena-platform`. *Resolution: Clarified that candidate `048e7db` and verification evidence `cc76da6` are published on `origin/integration/nook-arena-platform`, while main promotion / pushes to `main` via PR #3 remain held pending coordinator review.*

## docs/evidence/branch-completeness-2026-11-14.md
- **Published Integration Baseline Clarification:** Section "Included work" (line 17) and final status (line 73) recorded that main promotion remains held, but did not explicitly state that integration baseline `cc76da6` is published on `origin/integration/nook-arena-platform`. *Resolution: Updated lines 17 and 73 to state published integration baseline `cc76da6` and held main promotion.*

## docs/evidence/arena-tiebreak-live/README.md
- No drift detected.

## docs/evidence/feed-carousel-live/README.md
- No drift detected.

## docs/evidence/g06-live-demo/README.md
- No drift detected.

## docs/api/chat-service.openapi.json
- No drift detected.

## docs/api/user-service.openapi.json
- **Saad Elm Email Verification Resend Endpoint Missing:** Missing endpoint `POST /auth/email-verification/request`. Handler in `user-service/src/auth/auth.controller.ts:109` accepts `RequestEmailVerificationDto` (`email: string`) and returns `{ requested: true }`. *Resolution: Added OpenAPI 3.1 path definition with `operationId: "postAuthEmailVerificationRequest"`, request schema requiring `email`, 200 response `{ "requested": true }`, and 400 Bad Request error response, matching controller and DTO semantics.*

## packages/problem-bank/README.md
- No drift detected. Accurately distinguishes legacy `even-ledger` (Python snippet) from active matchmaking `even-ledger-v2` (`stdio` for C++, C, Python).

## user-service/README.md
- No drift detected.

## user-service/test/README.md
- No drift detected.

## chat-service/README.md
- No drift detected.

## client/README.md
- No drift detected.

## scripts/play.sh
- **Obsolete Workspace Reference:** Script is an obsolete standalone development seam referencing absent `arena-frontend` workspace and nonexistent `services/game/dist/main.js`. *Resolution: Added top-of-file header warning directing operators to Docker Compose startup (`docker compose up --build`) in `README.md` and `docs/project/COMPOSE.md`.*

## docs/archive/client-plan.md
- No drift detected. Explicitly archived historical record.

## docs/superpowers/plans/2026-11-11-nook-arena-platform-integration.md
- No drift detected. Explicitly dated historical plan.

## docs/superpowers/plans/2026-11-11-verification-guardrails.md
- No drift detected. Explicitly dated historical plan.

## docs/requirements/index.html
- No drift detected. Reference module tracker.

## docs/book/Nook-Book.pdf
- **Stale Handbook Claims & Missing Email Verification Endpoint:** Generated handbook repeated stale claims from source docs and omitted `POST /auth/email-verification/request`. *Resolution: Rebuilt via `docs/book/build.mjs`, verified generated PDF page count (194 pages) and text inclusion across pages 44, 45, 83, 98, and 106 using Swift PDFKit.*
