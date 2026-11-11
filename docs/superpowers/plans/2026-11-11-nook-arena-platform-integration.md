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

- [ ] Preserve tips `970b3bd` and `f85969d` and create `integration/nook-arena-platform`.
- [ ] Commit pending documentation/PDF and plan on the integration branch.
- [ ] Record a no-commit merge and use the verified equivalent baseline for content reconciliation.
- [ ] Resolve real conflicts while preserving both developers' functional changes; exclude `envs.zip`.

### Task 2: Reconcile integration surfaces

**Files:** `client/app/`, `client/components/legal/`, `client/package*.json`, `compose.yaml`, `envs/README.md`, `README.md`, `docs/`.
**Interfaces:** Unique legal URLs; consistent dependencies; unified backup operation; linked documentation.

- [ ] Check route uniqueness before changing legal routes; keep the teammate's shared legal layout and current Game disclosures.
- [ ] Reconcile landing/auth/sidebar/group-avatar changes and package lock without unrelated dependency upgrades.
- [ ] Keep complete local backup scripts and reconcile teammate retention/docs without enabling competing schedules.
- [ ] Fix links affected by documentation moves; record security incident/operator actions without secrets.
- [ ] Run focused regressions for any changed functional behavior.

### Task 3: Verify and review

**Files:** Integration log and any narrowly required repairs.
**Interfaces:** Reviewable commit and exact evidence/limitations for a PR.

- [ ] Run client tests/build/lint, root Arena tests/typecheck/build, Chat tests/build/lint and affected User checks.
- [ ] Validate Compose and run a non-destructive stack smoke check where available.
- [ ] Check conflict markers, secrets in the new tree, route uniqueness, and ancestry of origin/main and both preserved tips.
- [ ] Obtain one fresh review of the integration delta; repair verified findings with focused regressions.
- [ ] Commit the integration and report readiness, remaining credential actions, and push/PR handoff.

## Progress / rulings

- Planning: local/remote baseline trees compare byte-identical (`git diff --exit-code 49a0936 4232a34`). The remote tip contains origin/main. Using this baseline avoids treating rewritten equivalent commits as unrelated file additions.
- Usage check: cached ccusage reports no active blocks; no reliable window percentage is available. Continue bounded inline work and recheck at the review boundary.
