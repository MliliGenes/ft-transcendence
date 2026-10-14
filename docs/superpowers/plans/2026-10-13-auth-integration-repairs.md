# Auth integration repair plan

Goal: repair every finding in the 2026-10-13 auth review, including the Referer logging issue, and record real verification. Base: 99a493ec2ae81928cb2413496fd86a43a4c8e843 on Aimane.

## Current status — 2026-10-14

Tasks 1–4 passed independent task review. Task 5 real HTTPS proof passed 5/5 in
16.1 minutes, including normal 900-second idle App expiry, automatic Match/Lobby
recovery and passive room updates. Final root suite: 764 passed; the 19 optional
cases have the earlier unchanged-fixture evidence. Frontend: 125/125. Checks and
production builds pass. Final review's Important idle-expiry fix is committed;
a scoped review found a remaining slow-browser-clock recovery fault. The fix
passes 125 frontend tests; real slow-clock proof passed 5/5. Bounded clock-fix re-review remains. See
[verification evidence](../../auth-integration-repair-evidence.md).

## Global constraints

- Preserve tokens in memory only. A persistent logout marker must contain no credential or user profile.
- Preserve the approved one-Game-server ownership rules, accepted evaluations, Submit IDs, Chat IDs and collaboration recovery.
- Same-user token renewal must retain client state. Identity replacement must close and clear the previous Game scope.
- Never automatically replay mutations. Only explicitly opted-in GET/HEAD reads can replay once.
- All four namespaces require expiry disconnect, current recipient checks and fresh renewal baselines.
- Production uses HTTPS and DEV_PRINCIPAL=false. Node 22 for Arena, Node 24 for standalone auth projects.
- Preserve application data and the existing untracked workspace file. Integration tests use owned disposable databases, containers and ports.
- Work on the user's chosen Aimane branch. No force push, reset, migration reset against existing databases, deployment or merge.
- Follow TDD for behavioral repairs. Save RED and GREEN evidence. Keep test output in this plan's ignored workspace.
- Do not spawn helper agents from a dispatched worker. Root dispatches reviews after implementation.

## Task 1: Shared browser auth lifecycle — F1, F2, F3 core, F4 shared API

Files: packages/browser-auth/src/client.js, client.d.ts, src/lib/api.js, src/lib/session.js, coordination.js as needed, public-entry tests and package README.

Reproduce delayed login → logout with a real serialized lock queue; a late login or profile result, or late error, must not revive or alter the newer session. Check generation after every await. Dispose must invalidate pending work.

Reproduce failed logout → new client and other SPA/tab restore. Add a shared persistent, credential-free logout marker, injected through a `storage` option for tests and defaulting to browser localStorage. Enforce the marker under the origin lock for every restore/refresh, including forced restore. Mark pending synchronously before logout work, and keep writes ordered with cookie operations. Confirmed logout or deliberate new login can clear it. No credentials in storage or control messages.

Reproduce account B → SIGNED_IN account A. Identity replacement must create a new generation, invalidate old async work and expose the new profile. Same-user token renewal retains the generation. Public snapshots stay token-free.

Reproduce default POST → 401 → refresh: only one POST may be sent, even if retrySafeRead=true was supplied for a mutation. An opted-in safe GET may retry once. Authentication can renew, but the mutation returns a deliberate-retry error.

Run public package tests RED→GREEN and the complete package suite. Update declarations and README. Commit only these task files after successful verification. Report exact tests and commands, not just a pass claim.

## Task 2: Game browser identity and renewal — F3 consumer, F4 Lobby, F5, F6, F12

Files: frontend/src/App.tsx, arena/lobby.ts, arena/lobby-session.ts, arena/socket.ts and focused tests.

Consume Task 1 generation and authenticated profile transitions. Keep one stable Lobby client per identity. Close old Match/Lobby/sidecars on identity replacement or logout. Remove the old match scope on account change. Same-user token rotation retains existing clients and pending request IDs.

Renew the Lobby socket explicitly on token revision. Recover /lobby/active and room membership before commands resume. Lobby POSTs must never replay after 401. Selected reads can renew and retry once.

Commands that cause proactive token renewal must await a shared socket/baseline recovery promise and recheck active lifetime/connectivity before sending. Include a delayed baseline test proving no mutation is sent early. Handle disconnect and identity replacement during the await.

Compile all ?user= and legacy development identity branches out of production Play. Anonymous production entry must show sign-in. Preserve approved development tests through explicit DEV guards.

Run focused regressions RED→GREEN, frontend suite and build/type checks.

## Task 3: Game principal and socket gates — F7, F8, F9

Files: services/game/src/auth/auth-principal-client.ts, game/socket-auth.ts, four gateways and their tests.

Reproduce idle expiry with no application event. Schedule server-side disconnect at verified expiry, clear its timer on disconnect, handle expiry during admission, and run normal Presence cleanup. Accepted evaluation work must remain live.

Reproduce recipient lookup rejection and readiness loss during awaited lookup. Fail closed on lookup failure; check current readiness immediately before each emit, plus recipient connection and expiry. Preserve sender exclusion for relays. Pass a readiness getter where needed, rather than a pre-await boolean.

Reproduce null, arrays and non-object JSON principal bodies. Classify malformed upstream replies as VerificationUnavailableError; HTTP must return 503, not 401. Keep existing two-second whole-fetch deadline and in-flight-only deduplication.

Run focused regressions RED→GREEN and the Game suite/type checks.

## Task 4: Cookies, credential routing and deployment — F10, F11, F13, Referer minor

Files: user-service/src/auth/session-cookie.ts, browser-origin.ts and controller callers/tests; auth-profile-web/vite.config.js and session compatibility code; infra/nginx/nginx.conf; docker-compose.yml; .env.example and relevant README.

Expire legacy HttpOnly root cookies with a server Set-Cookie response on successful login/refresh/logout compatibility paths. Keep narrow /auth/ internally and /api/auth/ externally. Do not weaken duplicate-cookie rejection. Align Vite cookie rewriting and remove false claims that document.cookie deletes HttpOnly cookies.

Cover or reject every equivalent credential route form, including trailing slash and case variants, with the same rate limit/header policy. Enforce required source and X-Requested-With headers in User Service. Preserve legitimate same-origin login/refresh/logout, OAuth redirects and internal principal requests.

Pass GitHub/Discord provider settings and public callback URLs explicitly to the User service. Optional providers may remain unavailable if credentials are absent; configured credentials must reach the service. Remove full Referer from access logs.

Add meaningful route/cookie/config regressions before behavioral changes. Run Node24 auth tests/builds, Compose config and Nginx validation against owned fixtures. Update required Markdown.

## Task 5: Real proof and final verification — F14

Add production browser tests for password login → Account Play → Lobby → playable 1v1 and four-client 2v2 over HTTPS. Use real User service, Game, Redis and owned PostgreSQL databases. Do not mock principal/profile/match authorization or use development identity headers/query input. DEV_PRINCIPAL=false.

Exercise same-user renewal, all four namespaces, idle expiry, logout, failed logout across reload, account switching and Auth outage. Reuse existing judge/test fixtures only where they do not bypass authentication. Verify root-cookie migration through the actual browser cookie jar.

Run complete workspace tests, repository checks, standalone auth tests/builds and relevant full-stack tests. Record every unavailable external proof by exact cause. Do not claim OAuth provider success without real configured providers.

Update the original auth plan status and affected documentation to the verified results. Refresh the local visual recap. Request one fresh final review of the repair diff, address important findings with regressions, then make delivery safe and reviewable.

## Interface checks

| Producer | Consumer | Contract |
| --- | --- | --- |
| Task 1 identity generation | Task 2 Game scope | Identity replacement changes generation; same-user renewal changes revision only. |
| Task 1 API replay policy | Task 2 Lobby | POST never replays; safe reads need explicit opt-in. |
| Task 2 socket renewal | Task 3 expiry | New socket with fixed token; admission and baseline must complete before commands. |
| Task 4 credential headers | Task 1 and real tests | Same-origin source headers and X-Requested-With, with narrow HttpOnly cookies. |
| Tasks 1–4 implementation | Task 5 evidence | Real services; production identity; separate disposable data. |

Each task is internally consistent: regression first, minimum fix, task suite, evidence, then review. The earlier implementation plan remains the spec for approved behavior; this repair plan corrects the observed departures.
