# 42 subject compliance matrix

Last reviewed: 2026-10-22 against Aimane at `97e7492`, including the completed
auth proof, starter/transport repairs and frontend result repair.

Authoritative source: [ft_transcendence v21.2](../requirements/ft_transcendence-v21.2.pdf).

This document maps the current Account/Game integration to the subject; it does not award points.
Only behavior demonstrated from the final integrated team repository during
evaluation counts. The frozen [arena interaction reference](reference/code-arena-ui.html)
is design documentation, not implementation evidence.

## Maintenance rule

Review this matrix whenever runtime scope, integration boundaries, evidence, or
planned modules change. Resolve conflicts in favor of the subject PDF. Never
promote a row because code, a prototype, or a test name exists; record the
actual command, environment, result, and remaining integration gaps.

## Current integrated scope

The snapshot contains the React/Vite arena frontend, authoritative NestJS Game
service, shared model and engine packages, Postgres persistence, Redis
readiness, Nginx HTTPS/WSS ingress, a private judge worker, an isolated
container judge, and tests for 1v1/2v2 gameplay, lobby, reconnect,
collaboration, judging, and match-scoped chat.

The Account frontend (`/`) and Arena (`/play/`) share the Nginx HTTPS origin
and `browser-auth` session lifecycle. User Service runs privately at
`user-service:3000` with its own PostgreSQL database. Game verifies identity
through its principal API; production test identities are disabled.

The [completed auth repair evidence](auth-integration-repair-evidence.md), verified
on 2026-10-14, records real password login → Account Play → Lobby → playable 1v1
and four-player 2v2 with actual Judge results. Five real HTTPS groups passed with
a normal clock and five with an advancing browser clock 60 seconds slow. They
cover renewal, normal 900-second idle expiry recovery, team isolation, account
replacement, verification outage/retry, legacy-cookie migration and logout.
No principal, profile or Match responses are mocked. The public refresh cookie is
`HttpOnly`, `Secure`, `SameSite=Lax`, with `Path=/api/auth/`; the gateway rewrites
the upstream `/auth/` path. Signup, credential-route protections and provider
configuration also have focused server/configuration tests; this browser proof
uses password login, not a newly claimed live signup/OAuth/email journey.

Recorded checks/builds passed: 764 root cases, plus all 19 optional cases covered
by the earlier unchanged 47-case fixture run (783 distinct root cases); standalone
User Service 108/108, Account 23/23 and actual Account browser regressions 4/4.
The [independent sign-off](superpowers/reviews/2026-10-14-auth-integration-signoff.md)
records no open actionable finding in the completed repair gate. These are local,
isolated-stack results, not a new run, public release proof or module award.

Later [starter/transport evidence](starter-execution-repair-evidence.md) records
12/12 1v1, 16/16 four-player 2v2 and 6/6 maximum-input worker checks on the
2026-10-20 rebuilt stack. Both Match proofs completed three sealed Rounds at
300–300 with real password login and HTTPS/WSS network clients. They were not
four browser windows or separate-computer tests.

The [frontend repair evidence](frontend-repair-evidence.md), at `97e7492` on
2026-10-22, records **811 root tests passed, zero skipped**, including frontend
132/132, plus checks/build. An independent scoped forfeit review found no
Standards or Spec findings. A later two-browser run proved immediate forfeit
results without a Round Reveal, correct messages on both sides and reload
persistence. Temporary Chromium contexts used a local TLS exception; server
certificate/hostname validation passed separately. This is not browser trust
or public-certificate proof. The separate manual pass has a completed 1v1
Match; four-player layout, Team chat isolation and full-Match human acceptance
remain pending, followed by recovery/session/account/failure and final checks.

Live OAuth/SMTP, platform-chat integration, policy pages, production certificate
trust/deployment, contribution records and final team/module demonstrations remain
separate work. The approved release has one active Game process per database;
multi-server Game operation is outside that scope.

## Status key

| Status | Meaning |
| --- | --- |
| Imported evidence | Runtime code and focused tests exist in this branch. |
| Local integrated proof | Real services passed the recorded local HTTPS journey; final team/deployment acceptance remains separate. |
| Integration pending | The game-side seam exists, but another team component or deployment proof is missing. |
| Final demonstration pending | The behavior needs a clean, unrestricted run from the final repository. |
| Not in this snapshot | Another branch or future task owns the behavior. |

## Mandatory foundation

| Subject requirement | Current response | Status / remaining proof |
| --- | --- | --- |
| Frontend, backend, and database | Account and Arena React/Vite frontends, NestJS User Service/Game, and separate account/Game PostgreSQL storage are integrated. | Local integrated proof; clean-clone startup of the final team version remains pending. |
| Meaningful team contributions | This branch preserves a traceable game snapshot and does not claim authorship for teammate branches. | Final README, ownership table, and Git history review required. |
| One-command container deployment | Compose defines seven services: Game PostgreSQL, account PostgreSQL, Redis, User Service, Game, private Judge worker and Nginx serving both frontends. | The seven-service base stack was exercised; an optional local mail fixture adds an eighth service. Final clean-machine configuration/startup proof remains pending. |
| Latest stable Chrome with a clean console | Real-browser Account/Play/Lobby/Match journeys passed, including intentional outage/failure cases. | The 2026-10-22 Chromium forfeit run had no JavaScript errors. Final clean-console coverage on the selected Chrome release remains pending; this focused run and intentional outage logs do not cover every screen. |
| Accessible Privacy Policy and Terms | Not part of the imported game runtime. | Not in this snapshot. |
| Simultaneous users and race prevention | Match authority, revisions, evaluation IDs, persistence claims and four-player collaboration/isolation have tests and local integrated proof. | Final remote-client/concurrency demonstration remains pending. One Game owner per database is enforced; multiple active Game instances are not a release requirement. |
| Responsive and accessible UI | Arena components and browser viewport checks exist. | Final accessibility review pending. |
| Styling solution | Tailwind is used by Arena; root and standalone Account production builds passed. | Final team-version build/demonstration remains pending. |
| Ignored secrets and `.env.example` | Secrets and generated TLS material are ignored; safe variable names are documented. | Imported evidence; secret scan and deployment review required. |
| Documented database design | Game persistence and least-privilege bootstrap are documented; the imported User Service Prisma schema and separate database are present. | Final combined database guide and README diagram remain pending; account schema import is complete. |
| Secure signup/login | User Service owns registration/login and verified principals. Password login → Play is real-service proved with DEV_PRINCIPAL=false. The public refresh cookie uses HttpOnly, Secure, SameSite=Lax and /api/auth/; CSRF and scoped credential limits have tests. | Local integrated password-auth proof; final clean-machine demonstration and live OAuth/SMTP checks remain pending. |
| Frontend and backend validation | Game validates membership, phase, size, revision and identity. Auth repair tests cover principal failure handling, production identity guards and credential-route protections. | Focused repair checks/reviews passed; final integrated validation review remains pending, not a general security-audit claim. |
| HTTPS for external backend connections | Nginx terminates HTTPS/WSS; only Nginx publishes host ports. Real password-login and gameplay proof used the HTTPS gateway. | Local integrated proof with a local certificate; trusted production certificate and public deployment remain pending. |
| At least 14 completed module points | Candidate modules are listed below. | No points are awarded by this document. |

## Candidate module evidence

| Candidate module | Points | Recorded evidence | Gap before claiming completion |
| --- | ---: | --- | --- |
| Frontend and backend frameworks | 2 | React/Vite Account/Arena and NestJS User Service/Game are integrated; production builds and local HTTPS journeys passed. | Demonstrate the final integrated team version. |
| Real-time features | 2 | Socket.IO Match/Lobby, presence, collaboration and chat have tests; real expiry recovery refreshes all four namespaces and preserves state. | Final remote-client, disconnect and load demonstration within the approved one-Game-owner model. |
| User interaction | 2 | Account profile regressions and match-scoped 2v2 text chat, quick pings and team isolation have local evidence. | Agree and prove final social/profile/friends flows and platform/game chat ownership with the team. |
| Standard user management/authentication | 2 | User Service registration/login and verified-principal code are integrated. Real password login, renewal, expiry, account replacement and logout passed; server/configuration tests cover credential protections. | Final clean-machine/team demonstration; real email and external-provider flows remain separate checks. |
| Complete web-based game | 2 | Code Arena implements rounds, Run/Submit, hidden judging, reveal, scoring, tie-breaks and terminal results. The 2026-10-20 network proofs completed three-Round 1v1 and 2v2 Matches at 300–300. The 2026-10-22 browser proof covered forfeit results without a Reveal. | Final integrated-version demonstration, four-player human acceptance and team sign-off remain pending. |
| Remote players | 2 | Socket transport, reconnect, reservation, and browser multi-client journeys exist. | Demonstrate play from separate computers under realistic disconnect/latency conditions. |
| More-than-two-player multiplayer | 2 | Four real accounts proved 2v2 shared editing, revision-based Readiness, isolated Team chat and a three-Round 300–300 result with HTTPS/WSS network clients. | Final four-client remote synchronization/fairness demonstration and team acceptance. |
| Backend microservices | 2 | Game, private Judge worker and User Service use authenticated boundaries; separate account/Game databases and real-service integration are exercised. | Final deployment/loose-coupling review and team acceptance. |
| OAuth 2.0 | 1 | GitHub/Discord settings, callback defaults and provider-cookie routing have local configuration/proxy tests. | Full real-provider login/linking demonstration pending; no live OAuth success is claimed. |
| **Potential total** | **17** | This is planning capacity, not a score. | Count only complete, functioning, demonstrated modules. |

## Code Arena rules relevant to evaluation

- Supported baseline modes are 1v1 and 2v2; 2v2 is the more-than-two-player
  candidate.
- A match uses a fixed problem sequence and one match-wide authoritative
  deadline.
- Run checks visible examples only and never changes score.
- Submit freezes an immutable attempt and uses a sealed hidden suite.
- Scores remain hidden until Reveal. Final totals use summed round scores,
  then lower scoring-submission time, then fewer submissions, then a draw.
- Game derives identity, membership, side/team, phase, score, and hidden data
  server-side. Client identity or authority fields are never trusted.
- Deliberate **Leave match** ends the Match by forfeit. Both players now see
  the authoritative outcome even without a current Round Reveal. The display
  repair does not change the engine rule for disconnect grace expiry, the
  match-wide deadline or who can advance after Reveal. Team ratification of
  those progression/disconnect rules remains separate.
- Player code runs without network access or service credentials and under
  CPU, memory, wall-time, output, process, filesystem, and cleanup limits.

## Evidence still required before evaluation

1. Run install, lint, typecheck, build, unit/integration tests, Docker judge
   security tests, and Playwright journeys from a clean clone of the final
   repository.
2. Demonstrate HTTPS/WSS, the user-service principal flow, 1v1, four-client
   2v2, reconnect, hidden-data isolation, and match-scoped chat end to end
   (the [completed auth proof](auth-integration-repair-evidence.md) records local
   real-service 1v1/2v2, renewal and recovery with `DEV_PRINCIPAL=false`;
   the later [starter/transport proof](starter-execution-repair-evidence.md)
   completed full Matches, and the [frontend proof](frontend-repair-evidence.md)
   covered live forfeit display; final human four-player, clean-machine and
   remote-client demonstrations are still required).
3. Inspect the final Compose network and secrets, including proof that only the
   judge worker receives the Docker socket and internal worker token.
4. Complete policy pages, the subject-required README sections, ownership and
   contribution records, database documentation, AI-use disclosure, and team
   sign-off.
5. Remove every candidate module that is incomplete or cannot be demonstrated;
   the subject assigns zero points to incomplete modules.
