# 42 subject compliance matrix

Last reviewed: 2026-10-13, after the auth-game integration (Tasks 1–7).

Authoritative source: [ft_transcendence v21.2](../requirements/ft_transcendence-v21.2.pdf).

This document maps the imported game to the subject; it does not award points.
Only behavior demonstrated from the final integrated team repository during
evaluation counts. The frozen [arena interaction reference](reference/code-arena-ui.html)
is design documentation, not implementation evidence.

## Maintenance rule

Review this matrix whenever runtime scope, integration boundaries, evidence, or
planned modules change. Resolve conflicts in favor of the subject PDF. Never
promote a row because code, a prototype, or a test name exists; record the
actual command, environment, result, and remaining integration gaps.

## Current imported scope

The snapshot contains the React/Vite arena frontend, authoritative NestJS Game
service, shared model and engine packages, Postgres persistence, Redis
readiness, Nginx HTTPS/WSS ingress, a private judge worker, an isolated
container judge, and tests for 1v1/2v2 gameplay, lobby, reconnect,
collaboration, judging, and match-scoped chat.

The teammate user service is integrated as a private Compose service
(`user-service:3000`, own database) behind the gateway: password
signup/login, ≤15 min access tokens, narrow refresh cookies, CSRF on cookie
endpoints, scoped rate limits, and query-free logs are proven by
`scripts/https-smoke.sh` (30/30) plus a live superadmin login →
`/play/` → Lobby → Match run with `DEV_PRINCIPAL=false`. OAuth callbacks are
proxied with cookie rewrites; a full OAuth demonstration remains pending.
Platform chat, policy pages, final deployment configuration, contribution
records, and final module demonstrations therefore remain integration work.

## Status key

| Status | Meaning |
| --- | --- |
| Imported evidence | Runtime code and focused tests exist in this snapshot. |
| Integration pending | The game-side seam exists, but another team component or deployment proof is missing. |
| Final demonstration pending | The behavior needs a clean, unrestricted run from the final repository. |
| Not in this snapshot | Another branch or future task owns the behavior. |

## Mandatory foundation

| Subject requirement | Current response | Status / remaining proof |
| --- | --- | --- |
| Frontend, backend, and database | React/Vite frontend, NestJS Game service, and Postgres-backed game persistence are imported. | Imported evidence; final integrated startup pending. |
| Meaningful team contributions | This branch preserves a traceable game snapshot and does not claim authorship for teammate branches. | Final README, ownership table, and Git history review required. |
| One-command container deployment | Compose starts Postgres, Redis, Game, the private judge worker, and Nginx. | Frontend and user-service integration plus clean-machine proof pending. |
| Latest stable Chrome with a clean console | Playwright journeys exist for arena, lobby, reconnect, collaboration, and chat. | Final unrestricted Chrome run pending. |
| Accessible Privacy Policy and Terms | Not part of the imported game runtime. | Not in this snapshot. |
| Simultaneous users and race prevention | Match authority, revisions, evaluation identifiers, persistence claims, and multi-client tests exist. | Imported evidence; final concurrency and multi-instance proof pending. |
| Responsive and accessible UI | Arena components and browser viewport checks exist. | Final accessibility review pending. |
| Styling solution | Tailwind is used by the frontend. | Imported evidence; final integrated build pending. |
| Ignored secrets and `.env.example` | Secrets and generated TLS material are ignored; safe variable names are documented. | Imported evidence; secret scan and deployment review required. |
| Documented database design | Game persistence and least-privilege bootstrap are documented by ADRs and code. | User-service schema integration and final README diagram pending. |
| Secure signup/login | Game consumes the verified principal only (no `?user=` in prod); user-service signup/login with ≤15 min tokens, narrow cookies (`httpOnly`, `lax`, `/auth/`), CSRF, and scoped limits is integrated and smoke-proven. | Imported evidence; final clean-machine demonstration pending. |
| Frontend and backend validation | Game commands validate membership, phase, size, revision, and request identity. | Imported evidence; cross-service validation review pending. |
| HTTPS for external backend connections | Nginx terminates HTTPS/WSS; only Nginx publishes ports in the game stack. | Local certificate + full-stack auth proof exists; production certificate pending. |
| At least 14 completed module points | Candidate modules are listed below. | No points are awarded by this document. |

## Candidate module evidence

| Candidate module | Points | Imported evidence | Gap before claiming completion |
| --- | ---: | --- | --- |
| Frontend and backend frameworks | 2 | React/Vite and NestJS are the real game implementation. | Demonstrate them in the final integrated application. |
| Real-time features | 2 | Socket.IO match/lobby events, reconnect, presence, collaboration, and chat tests. | Final remote-client, disconnect, load, and cross-instance demonstration. |
| User interaction | 2 | Match-scoped 2v2 text chat and quick pings. | Profiles, friends, and the final platform/game chat ownership must be integrated. |
| Standard user management/authentication | 2 | Game consumes the verified principal only; user-service signup/login (≤15 min tokens, narrow cookies, CSRF, scoped limits) is integrated and smoke-proven. | Final clean-machine demonstration pending. |
| Complete web-based game | 2 | Code Arena has defined rounds, Run/Submit, hidden judging, reveal, scoring, tie-breaks, and terminal results. | Clean final-stack 1v1 demonstration and team sign-off. |
| Remote players | 2 | Socket transport, reconnect, reservation, and browser multi-client journeys exist. | Demonstrate play from separate computers under realistic disconnect/latency conditions. |
| More-than-two-player multiplayer | 2 | 2v2 supports four principals, team-scoped shared editing/readiness/chat, and one team score. | Clean four-client synchronization/fairness demonstration. |
| Backend microservices | 2 | Game, the private judge worker, and user-service use narrow authenticated boundaries. | User-service integration demonstrated; final loose-coupling review pending. |
| OAuth 2.0 | 1 | User-service OAuth callbacks are proxied with cookie rewrites (smoke-covered). | Full OAuth login demonstration pending. |
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
- Player code runs without network access or service credentials and under
  CPU, memory, wall-time, output, process, filesystem, and cleanup limits.

## Evidence still required before evaluation

1. Run install, lint, typecheck, build, unit/integration tests, Docker judge
   security tests, and Playwright journeys from a clean clone of the final
   repository.
2. Demonstrate HTTPS/WSS, the user-service principal flow, 1v1, four-client
   2v2, reconnect, hidden-data isolation, and match-scoped chat end to end
   (auth-matrix proof with `DEV_PRINCIPAL=false` recorded in the Task 8
   report; clean-machine rerun still required).
3. Inspect the final Compose network and secrets, including proof that only the
   judge worker receives the Docker socket and internal worker token.
4. Complete policy pages, the subject-required README sections, ownership and
   contribution records, database documentation, AI-use disclosure, and team
   sign-off.
5. Remove every candidate module that is incomplete or cannot be demonstrated;
   the subject assigns zero points to incomplete modules.
