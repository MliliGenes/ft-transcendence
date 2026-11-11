# Nook / Code Arena integration plan

> **For agentic workers:** Use superpowers:executing-plans inline, then one fresh whole-change review.

**Goal:** Produce a tested integration branch preserving local Arena work and the teammate's latest platform work, suitable for a PR to main.

**Architecture:** Integrate using the verified identical trees at local `49a0936` and remote `4232a34` as the content baseline. Preserve both actual commit histories with a merge commit. Keep the canonical Game service, authoritative gameplay, deletion controls and data stores; incorporate the platform UX and documentation updates.

**Tech Stack:** Next.js / React, NestJS, PostgreSQL, Socket.IO / Yjs, Docker Compose.

**Spec:** User-authorized integration scope in this session; `docs/spec/code-arena-integration-spec.md`; `ft_trans_subject.pdf`.

## Global constraints

- Do not force-push, overwrite a teammate branch, rotate deployed credentials, rewrite published history or merge main without separate authorization.
- Preserve local uncommitted documentation and supplied PDF on the new integration branch; leave the original branch tip unchanged.
- No environment files, archives or secret values in new commits or logs.
- Existing exposed credentials are a separate operator action. Record the historical exposure without copying the archive into the integration tree.
- Keep one privacy route and one terms route, with Game erasure and retention semantics accurate.
- Preserve user/chat/game databases and attachment backup coverage; avoid competing scheduled backup mechanisms.

## Review focus

- Duplicate route groups resolve to the same URL: production build must detect/prevent this.
- Teammate's legal UI must preserve Arena source deletion and side-shared 2v2 erasure disclosures.
- Backups must cover Game and MinIO as well as User/Chat, with a single scheduling approach.
- Sidebar cookie state must not weaken authentication or create hydration mismatches.
- Reorganized docs must retain game/backup guides and working entry-point links.

### Task 1: Preserve and reconcile histories

**Files:** Existing README/roadmap/PDF; Git branch refs; this plan.
**Interfaces:** Both tips become ancestors of the final integration commit; working tree contains the combined feature set.

- [x] Preserve tips `970b3bd` and `f85969d` and create `integration/nook-arena-platform`.
- [x] Commit pending documentation/PDF and plan on the integration branch.
- [x] Record a no-commit merge and use the verified equivalent baseline for content reconciliation.
- [x] Resolve real conflicts while preserving both developers' functional changes; exclude `envs.zip`.

### Task 2: Reconcile integration surfaces

**Files:** `client/app/`, `client/components/legal/`, `client/package*.json`, `compose.yaml`, `envs/README.md`, `README.md`, `docs/`.
**Interfaces:** Unique legal URLs; consistent dependencies; unified backup operation; linked documentation.

- [x] Check route uniqueness before changing legal routes; keep the teammate's shared legal layout and current Game disclosures.
- [x] Reconcile landing/auth/sidebar/group-avatar changes and package lock without unrelated dependency upgrades.
- [x] Keep complete local backup scripts and reconcile teammate retention/docs without enabling competing schedules.
- [x] Fix links affected by documentation moves; record security incident/operator actions without secrets.
- [x] Run focused regressions for any changed functional behavior.

### Task 3: Verify and review

**Files:** Integration log and any narrowly required repairs.
**Interfaces:** Reviewable commit and exact evidence/limitations for a PR.

- [x] Run client tests/build/lint, root Arena tests/typecheck/build, Chat tests/build/lint and affected User checks.
- [x] Validate Compose and run a non-destructive stack smoke check where available.
- [x] Check conflict markers, secrets in the new tree, route uniqueness, and ancestry of origin/main and both preserved tips.
- [x] Obtain one fresh review of the integration delta; repair verified findings with focused regressions.
- [x] Commit the integration and report readiness, remaining credential actions, and push/PR handoff.

## Progress / rulings

- Planning: local/remote baseline trees compare byte-identical (`git diff --exit-code 49a0936 4232a34`). The remote tip contains origin/main. Using this baseline avoids treating rewritten equivalent commits as unrelated file additions.
- Usage check: cached ccusage reports no active blocks; no reliable window percentage is available. Continue bounded inline work and recheck at the review boundary.

- Task 1: preserved local/remote backup refs, switched to `integration/nook-arena-platform`, committed the pending documentation/PDF as `c141de9`, and loaded the explicit-base content merge while retaining the real remote merge parent.
- Ruling: preserve the teammate's PostgreSQL scheduler behind `database-only-backups` and extend it to Game; complete snapshots remain the recommended single operator-installed schedule. This preserves both implementations without enabling competing jobs by default.
- Task 2: consolidated legal routes under `(legal)`, preserved Game erasure disclosures, merged landing/feed/Arena previews, sidebar preference and group avatars, kept reorganized docs, and reconciled dependencies without upgrades.
- Ruling: backup scripts assumed database names contradicted by the newer examples. Regressions failed first, then scripts were changed to read running container configuration. Live SQL restore now stops on errors and requires explicit maintenance opt-in.
- Ruling: prior D04 clean-service completion was unsupported by the live restore helper. Corrected docs and left isolated full recovery and scheduler installation as explicit operator acceptance gates.
- Ruling: full client lint exposed an existing conditional `useMemo`, synchronous initial status loading state, and reserved test variable names. Repair these as part of the green integration gate; do not suppress the rules.

- Task 2: complete. Both developers' integration surfaces retained; dependency sets agree with the lock. Snapshot scripts use configured database names. Current documentation links resolve.
- Task 3: checks and independent review complete; exact commands/results and limitations are in `docs/project/INTEGRATION_STATUS.md`.
- Final: fixed unsafe retention with a failing-then-passing spaced-path regression; root is normalized and snapshot paths stay intact through array iteration.
- Final: fixed legal-first session restoration with failing-then-passing `/privacy` and `/terms` regressions; retained login restore suppression.
- Final: real Chat HTTP/SQL regressions exposed case-insensitive self-DM bypass and generic HTTP 500. Normalize identifiers before comparison and return BadRequestException; 8/8 real tests pass.
- Final: corrected stale User fixtures to mock SMTP/events and test the existing HttpOnly refresh-cookie contract, rather than restoring obsolete JSON refresh tokens; 68/68 tests pass.
- Final: repaired atomic-lobby MatchStore mock history methods; typecheck and 10 real PostgreSQL atomic-lobby tests pass.
- Final: removed a previously tracked generated localhost TLS key/certificate from the index while retaining local copies; corrected the generator's output path to the Compose mount.
- Remaining operator actions: exposed credential rotation, optional coordinated published-history cleanup, backup schedule installation, clean isolated full recovery demonstration, and trusting the local certificate for visual browser QA. No live restore, credential rotation, force push, shared-branch push or main merge was performed.
