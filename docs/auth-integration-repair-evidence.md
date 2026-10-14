# Auth integration repair evidence — 2026-10-13

Branch: `Aimane`. Repair base: `99a493ec2ae81928cb2413496fd86a43a4c8e843`.
Latest verification: 2026-10-14. The owned User Service, Game and Judge images
remain at `40b24e4`. Only the gateway was rebuilt with `d8bcdb0` and the definitive-
expiry guard committed as `d352d37`. Existing application services/data were
preserved. The remaining gate is the independent scoped fix review and delivery.

Final review at `65e666a` found one Important natural idle-expiry interaction.
The fix and missing-token guard pass 123 frontend tests, all root checks/builds,
and 5/5 real HTTPS groups in 16.1 minutes, including normal 900-second App expiry
and automatic Match/Lobby recovery. Scoped re-review remains pending.

## Results

| Gate | Result |
| --- | --- |
| Full Node 22 root workspace suite | 762 passed; 19 optional cases skipped by default |
| All 19 optional cases with owned PostgreSQL/Docker fixtures | Passed in a 47-case run; no skips in that run |
| Standalone Node 24 User Service | 108/108, zero skips, including real transaction tests |
| Standalone Account | 23/23, zero skips; production build passed |
| Actual Account App browser regressions | 4/4: identity replacement, mutation no-replay, unavailable retry, saved-profile renewal/fresh-profile acceptance |
| Real production HTTPS proof | 5/5 groups, 16.1 minutes; observed pages reported no exceptions |
| Root production builds | Passed for packages, Game, Judge worker and Arena |
| Repository, dependency boundaries, type checks and lint | Passed |

Root counts include engine 339, harness 19, model 68, shared auth 48, Game 141,
Judge/config/gateway 22, frontend 123 and example 2. The optional run has 28 cases
that overlap the default suite plus the 19 previously skipped cases: 781 distinct
root cases were exercised successfully. The 47-case optional-fixture run is the earlier checkpoint at `65e666a`; its
engine fixtures did not change during the frontend idle-recovery fix. One final
root attempt reached Match complete in the restart/in-flight-evaluation case
while real browser Judge work overlapped. That exact case passed alone, then the
full suite passed during browser idle, with no source or grace changes. Resource
contention is a hypothesis, not a confirmed diagnosis. The successful final root
run, repository checks and builds all exited zero.

The default skips are PostgreSQL Lobby
atomicity (10), PostgreSQL private Lobby contract (6), PostgreSQL Lobby adapter
(2), and the opt-in real Docker timeout-reaping diagnosis (1).

## Real HTTPS proof

`frontend/e2e/auth-real-services.spec.ts` uses six normal fixture accounts.
Four play the team match; the fifth waits in Lobby and later proves identity
replacement; the sixth joins that Lobby after passive recovery. The fixture
password is used by the normal login UI. No principal, profile or Match responses
are mocked. No development user header or query grants identity.

The separate Compose project is `auth-repair-proof-20261013`: HTTPS on loopback
18443, HTTP on 18480, separate account/Game databases, Redis, generated RSA key,
separate image tags and volumes, `DEV_PRINCIPAL=false`. The existing application
stack and its data were not changed. The proof deliberately rejects a development
query identity and a development HTTP header while anonymous.

1. Normal password login opens Account. Its Play link opens Lobby. Two players
   create/join a private 1v1 room, ready, start, run the actual problem, submit,
   and receive Judge-backed 100/100 round scores. A deliberate leave retires the
   fixture match through the normal Game action.
2. Four players create/join a private 2v2 room. Lobby renews before Ready Up and
   retains the room. Shared code converges within each team; opponent code and
   chat remain isolated. Current-document readiness enables team Submit. Both
   teams receive actual Judge-backed 100/100 round scores.
3. The browser Date alone moves near JWT expiry; host/server time stays unchanged.
   A proactive Match command performs a real cookie refresh. Match, Collaboration
   and Chat reconnect with fresh baselines. Shared clients, code and chat remain.
   Lobby renewal is checked while its page is active; it is closed when Match
   replaces that page. Socket.IO polling and WebSocket frames are both observed.
   A controlled five-second JWT signed with the owned key is verified by the real
   User Service; idle sockets in `/`, `/lobby`, `/collab`, `/chat` all receive a
   server disconnect after expiry. This is not a principal mock.
4. The actual App waits for normal signed 900-second access tokens to expire.
   Match and a separate private Lobby remain idle. Incoming server disconnects
   and successful real cookie refreshes are observed without a button, reload,
   synthetic expiry clock, or baseline request from the test. Match, Collaboration
   and Chat have new handshakes/baselines, the same client objects and Match ID,
   retained code/chat, and enabled Run. Lobby has a new handshake and active-state
   baseline. Neither idle page sends an HTTP mutation during recovery. A sixth
   normal guest then joins the same room; the waiting host receives the passive
   room hint and updated member UI with no host action. Earlier proactive-clock
   tests restore an advancing system clock before this normal expiry case.
5. Only the owned User Service stops. A real Game request and Run return 503;
   Game shows unavailable and keeps code. Account bootstrap reaches its unavailable
   state after the existing 20-second SDK deadline, then Try again verifies the
   same identity after restart. A real password-login response deletes a seeded
   legacy HttpOnly root cookie and leaves only the secure `/api/auth/` cookie.
   Cookie loss permits another tab's normal login; its SDK broadcast replaces a
   still-live old Game scope and clears its Match URL/editor. A network-aborted
   logout keeps a credential-free intent across reload and entry to Play. A new
   deliberate login works; subsequent real 204 logout clears the browser cookie
   and signs out the other SPA/tab. Reload remains signed out.

The logout network abort is a failure injection, not a mocked auth response.
Accepted evaluations after auth loss and expiry are additionally covered by the
Game suite and the independent Task 3 bounded review; this browser proof does not
claim a new real-service accepted-evaluation/expiry race.

## Reproduction

Use an isolated Compose project and normal disposable accounts, not the existing
application database. The test accepts only `https://localhost:18443`. Keep private
fixture files outside Git. The JSON fixture has `origin`, `password`, and `users`
(each with `username` and `email`); it needs at least six normal users in that
owned account database. `E2E_REAL_AUTH_KEY` names its matching private RSA key.

```sh
# From frontend/, with Node 22 and Docker available:
E2E_REAL_AUTH_FIXTURE=/absolute/private/accounts.json \
E2E_REAL_AUTH_KEY=/absolute/private/key.pem \
  npx playwright test e2e/auth-real-services.spec.ts

# Root: owned Game PostgreSQL URL. No existing application data.
TEST_PG_URL=postgres://<fixture-user>:<fixture-password>@127.0.0.1:<port>/<db> npm test
# Engine optional PostgreSQL cases also consume DATABASE_URL.
# ARENA_DIAGNOSIS_DOCKER=1 enables the real timeout-reaping diagnosis.
npm run check
npm run build
```

The proof checks the Compose ownership label before stopping/starting its fixed
User Service container. That control never targets the default application stack.
Raw logs and generated fixtures stayed in the ignored task workspace during work.

## Independent reviews and rulings

Tasks 1–4 each passed independent review after their fix rounds. Task 4's saved
profile regression and dev provider-cookie mapping were independently re-reviewed
at `98119fa..40b24e4`. The final fresh review found the idle-expiry interaction above and no other
Critical, Important or actionable Minor finding. Task 5 has now passed its actual normal-expiry App proof; final delivery remains
blocked on the scoped fix review. Do not treat this document
as a push/merge approval by itself.

Rulings made during execution:

- Use the user's existing Aimane checkout. This preserves their branch choice;
  the cost if isolation were required is moving the repair commits later.
- A deliberate login supersedes an older restore. Its stale result returns
  `SESSION_CHANGED`; callers must handle cancellation, which prevents resurrection.
- Implement inline after the heartbeat prohibited workers. Keep independent task
  reviews; the cost is less isolated implementation context, covered by regressions.
- Continue the same inline/no-worker rule after resume; reviewers only review.
  The cost remains less isolated implementation context.
- Use a sixth normal disposable guest for the passive Lobby proof. This keeps the
  active Match available for the later outage case. The cost is one extra fixture
  account; it adds no authentication bypass.
- Wait for the real normal 900-second JWT expiry. The cost is about 16 minutes per
  full run; this avoids production TTL options and private auth-state changes.

Final review boundaries and costs if these rulings are wrong:

- Live OAuth and SMTP need real configured providers. Local cookie/config tests
  are accepted for this repair; the cost is a separate external integration run.
- Production certificate trust, public deployment, policy/module acceptance and
  team branch integration are separate delivery work. The cost is that local
  success alone does not establish production or team acceptance.
- Multiple Game servers and remote Socket.IO adapters are excluded by the approved
  single-owner model. The cost is that horizontal scaling needs a new design.
- Accepted evaluation versus auth expiry is preserved by Game tests and the Task 3
  independent bounded checks. No new real-service race is claimed; the cost is
  that this browser proof adds no evidence for that exact race.
- The final review covers the repair range. A new general/security audit,
  unsupported browser/storage policies and unrelated existing UI are outside it.
  The cost is that those surfaces can contain separate faults; no demonstrated
  repair issue was dismissed on that basis.

- Keep runtime code and grace unchanged after a timing-sensitive restart fixture
  failure. The exact case and the full suite passed on rerun. The cost is that a
  future failure can need further diagnosis; resource contention is unconfirmed.

No actionable Minor finding was deferred by the whole repair-diff review.

## External limits

Live GitHub/Discord authorization and external mail delivery were not run. Their
real provider credentials and SMTP service were not configured in the disposable
proof stack. Provider settings/callback defaults and dev state-cookie paths have
local tests; those tests do not claim live OAuth or mail success.

Access tokens retain their signed expiry after logout. Refresh-session revocation
is not immediate JWT revocation. Production certificates, policy/module evidence
and team-wide branch integration remain separate team deliverables.
