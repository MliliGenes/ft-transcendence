# Verification and secret-prevention plan

> Use inline execution and one fresh review at completion.

**Goal:** Make the checks used during the integration repeatable locally and in CI, and block newly introduced secrets before commit/push.

**Scope:** Existing root Arena workspaces, Client, Chat, User, backup regressions and isolated database/socket tests. No production data, credential rotation, history rewrite, deployment or main merge. Continue on the integration branch so the review can see the checks alongside the changes they protect.

## Decisions

- Plain Node scripts and native Git hooks; no formatter migration or new JavaScript runtime dependencies.
- `npm run check` explicitly runs every surface's existing lint/build/type/test commands, including Node-based User regressions and backup tests. Root lint must invoke real linters rather than silently skipping workspaces.
- `npm run test:integration` creates uniquely named PostgreSQL/RabbitMQ containers, separate databases, schema setup and test environment; it cleans up only those containers on success, failure or interruption.
- CI uses the same full check on an Ubuntu Docker runner with Node 22, pinned action revisions, read-only contents permissions and no deployment secrets.
- Gitleaks 8.30.1 is installed into ignored local tooling using verified upstream SHA-256 digests. Scan output is redacted and archives are inspected.
- Native hooks check staged files and outgoing commits. CI checks the tracked tree and every commit after the reviewed `ecbbfdd` integration baseline. This is prevention of new leaks, not certification/remediation of pre-baseline historical exposure; no broad finding allowlist.
- Keep secret filenames/archives blocked even when their contents evade pattern scanning. Tests use synthetic values in temporary repositories and never commit live credentials.

## Work

- [x] Add failing regression tests for gate coverage/failure propagation, disposable-service cleanup and secret detection (including staged vs unstaged content and removed-in-later-commit leaks).
- [x] Implement explicit verification entry point and checked-in disposable integration runner; use existing suites and fail on missing prerequisites.
- [x] Implement pinned scanner installation, index/outgoing-history checks and opt-in repository-local hook setup.
- [x] Wire one CI workflow to the same entry points and document setup, scope and known historical incident.
- [x] Run the full gate, scanner/hook regressions and independent review; repair verified findings, then commit the result.

## Completion

A successful full local run proves all required stages executed; summaries retain failed commands/exit codes. Regression tests prove new-secret blocking and cleanup boundaries. CI configuration is validated locally; a hosted Actions run is only claimed if actually observed. Remind the user about evidence quality (retro item 4) and concise navigation/tool guidance (item 5) where still applicable.

## Progress / rulings

- Regression tests demonstrate staged-vs-unstaged scanning, removed-in-later-commit leaks, provider tokens inside renamed archives, fail-fast reporting and owned-container cleanup.
- Replaced the empty User Vitest default with the real Node suite; it exposed stale mail/event/config/cookie fixtures now being repaired. No production auth behavior is changed.
- Removed template-only key headers and an unused template badge token, and untracked already-ignored generated Graphify cache data rather than exempt broad directories. One synthetic public numeric Discord app ID needs a single inline scanner annotation because the actual OAuth configuration validates its numeric shape.
- Independent review found legacy engine tests could probe localhost SQL and that the first runner omitted some SQL contracts. Preliminary workspace commands now clear application targets and disable those probes; direct engine SQL tests also require explicit TEST_PG_URL. Disposable coverage now includes collaboration, persistence and lobby contracts.
- Independent review reproduced surviving grandchildren on cancellation. A failing-then-passing process-tree regression now checks termination before cleanup returns.
- The first Game integration run exceeded default 5-second test timeouts under Docker/SQL load. The runner uses a 30-second default for those real integration cases, preserving explicit longer restart deadlines, and bounds readiness probes. This does not change gameplay timing.
- User PostgreSQL suites passed 17 tests against a newly provisioned disposable database; full final gate remains pending.

## Local completion evidence

- `npm run check` completed successfully: 20 recorded stages, no failed stages. Includes 13 guardrail/tool regressions plus 4 backup regressions; full workspace tests; Client 43 tests; Chat 12 unit + 8 PostgreSQL tests; User 92 default tests + 17 PostgreSQL checks; 57 engine/database tests; 15 Game HTTP/socket/reconnect checks; all configured builds, linters and typechecks.
- Required SQL cases now run with disposable connection settings; direct engine SQL tests require explicit opt-in rather than guessing localhost defaults. The optional external judge-provider checks remain environment-dependent.
- New scanner diagnostics report only filename, line and rule; a regression confirms the synthetic token value is absent from the error. Renamed archives are rejected both in the index and when added then removed from history.
- Independent review's three findings were repaired with focused evidence: explicit safe unit-test environment, full SQL-contract selection, and failing-then-passing grandchild cancellation test. Only owned disposable services were used and none remained after cleanup.
- Workflow YAML parsed and pinned action/scanner refs/checksums verified against upstream. Hosted GitHub Actions validation is pending the PR update; local success is not presented as a hosted run.
- Retro reminders: item 4 remains relevant to deployment/evaluation claims and actual hosted check results. Item 5 is addressed by one concise README/index link to `docs/project/VERIFICATION.md`; no expanded global agent instructions were added.
