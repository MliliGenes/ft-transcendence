# Auth integration repair evidence — 2026-10-13

Branch: `Aimane`. Repair base: `99a493ec2ae81928cb2413496fd86a43a4c8e843`.
Production code proved by the owned images at `40b24e4`; this evidence and the
real-service test are the following verification commit. Final review and delivery
are pending until recorded below.

## Results

| Gate | Result |
| --- | --- |
| Full Node 22 root workspace suite | 754 passed; 19 optional cases skipped by default |
| All 19 optional cases with owned PostgreSQL/Docker fixtures | Passed in a 47-case run; no skips in that run |
| Standalone Node 24 User Service | 108/108, zero skips, including real transaction tests |
| Standalone Account | 23/23, zero skips; production build passed |
| Actual Account App browser regressions | 4/4: identity replacement, mutation no-replay, unavailable retry, saved-profile renewal/fresh-profile acceptance |
| Real production HTTPS proof | 4/4 groups, 56.7 seconds, no page exceptions |
| Root production builds | Passed for packages, Game, Judge worker and Arena |
| Repository, dependency boundaries, type checks and lint | Passed |

Root counts include engine 339, harness 19, model 68, shared auth 48, Game 141,
Judge/config/gateway 22, frontend 115 and example 2. The optional run has 28 cases
that overlap the default suite plus the 19 previously skipped cases: 773 distinct
root cases were exercised successfully. The default skips are PostgreSQL Lobby
atomicity (10), PostgreSQL private Lobby contract (6), PostgreSQL Lobby adapter
(2), and the opt-in real Docker timeout-reaping diagnosis (1).

## Real HTTPS proof

`frontend/e2e/auth-real-services.spec.ts` uses five normal fixture accounts.
Four play the team match; the fifth proves identity replacement. The fixture
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
4. Only the owned User Service stops. A real Game request and Run return 503;
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
(each with `username` and `email`); it needs at least five normal users in that
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
at `98119fa..40b24e4`. Task 5 and the complete repair diff await the final fresh
review; do not treat this document as a push/merge approval by itself.

Rulings made during execution:

- Use the user's existing Aimane checkout. This preserves their branch choice;
  the cost if isolation were required is moving the repair commits later.
- A deliberate login supersedes an older restore. Its stale result returns
  `SESSION_CHANGED`; callers must handle cancellation, which prevents resurrection.
- Implement inline after the heartbeat prohibited workers. Keep independent task
  reviews; the cost is less isolated implementation context, covered by regressions.
- Continue the same inline/no-worker rule after resume; reviewers only review.

## External limits

Live GitHub/Discord authorization and external mail delivery were not run. Their
real provider credentials and SMTP service were not configured in the disposable
proof stack. Provider settings/callback defaults and dev state-cookie paths have
local tests; those tests do not claim live OAuth or mail success.

Access tokens retain their signed expiry after logout. Refresh-session revocation
is not immediate JWT revocation. Production certificates, policy/module evidence
and team-wide branch integration remain separate team deliverables.
