# Delivery Roadmap: Nook and Code Arena

This roadmap contains the platform backlog and current Code Arena follow-up. Some older group, search and analytics tasks below have not been re-audited; do not treat their checkboxes as a current implementation report.

Use [the module tracker](../requirements/index.html) as the scoring source. Point totals below are planning estimates, not confirmed awards. The evaluator decides whether each module is complete. Finish the mandatory foundation requirements as well; modules alone do not satisfy the submission requirements.

## Current scoring position

The earlier 10-point baseline and 18-point target were planning estimates, not evidence of completed rubric items, and are retired. Use the [current module tracker](../requirements/index.html) and the evidence map in the [root README](../../README.md). The original subject PDF, confirmed team roster, module owners and evaluator decisions are not recorded here, so this document does not claim a final score.

## Phase 1 — Finish group chat on the backend

Keep the existing [Chat Service Plan](../chat-service/PLAN.md) as the detailed behavior and architecture reference. Finish one complete, secured group/channel flow before starting the main UI.

- [ ] Create a group and make its creator an admin.
- [ ] List a caller's groups and read group details and members.
- [ ] Let admins edit/delete groups and add/remove members. Let members leave; prevent a group from ending up with no admin.
- [ ] Create, list, update, and delete text channels within a group.
- [ ] Store channel messages in their channel conversation; retain history and pagination.
- [ ] Enforce membership and group-role checks on every HTTP operation and socket subscription. Removed members immediately lose history access and live delivery.
- [ ] Broadcast channel messages only to current members. Recheck membership on reconnect and recover missed messages from the database.
- [ ] Finish request validation, persistence, and useful API documentation for the group/channel routes.
- [ ] Run the full flow with two users, including an outsider, a regular member, an admin, a removed member, and a reconnecting client.

**Point target: U05 (+2).** A group can serve as the organization if it supports create/view/edit/delete, membership add/remove, and organization-specific actions such as channel management. Group chat by itself has no separate module points.

## Phase 2 — Make presence and activity data usable

- [ ] Add authenticated socket presence with per-user connection counts, so closing one tab does not mark a user offline while another remains connected.
- [ ] Track a heartbeat/last-seen time with expiry so stale connections do not stay online after a crash or lost network.
- [ ] Expose online/offline state only where appropriate, especially in the friends list. Recheck access when friendship or block status changes.
- [ ] Record privacy-safe activity data needed for aggregate insights. Do not store message contents for analytics.
- [ ] Add server-side superadmin authorization before exposing Chat-owned metrics. The current Chat auth guard validates identity, but does not establish a superadmin role.

**Point targets:** U01 (+2) for the complete profile/friend system with online friend status; U07 (+1) only when admins can see useful activity insights, not just current online users.

## Phase 3 — Build the main frontend as feature-sized sessions

The main frontend is the Next.js App Router application in `client/`. Continue the real application and integration work there; the old plan to migrate from Vite is no longer current.

### Session A: Set the visual foundation

- [x] Use Next.js App Router and shared Nook tokens/components for colors, typography, spacing, and focus states.
- [x] Provide light/dark themes and a light/dark/system selector; automated checks verify theme tokens and text, action, input, and focus contrast.
- [ ] Manually review representative screens and controls in both themes.
- [ ] Build and reuse at least ten components (for example: button, input, dialog, dropdown, tabs, avatar, badge, card, toast, and navigation item). Use a consistent icon set.
- [ ] Keep the existing app accessible with keyboard navigation and responsive layouts as screens move over.

**Point target: W12 (+1).** Next.js and shadcn alone do not earn the point; demonstrate the complete design-system criteria.

### Session B: Make groups feel real

- [ ] Add a group directory and “Create group” dialog with useful validation and success/error feedback.
- [ ] Build a group home with channel navigation, member list, and a clear admin/member distinction.
- [ ] Add group settings for name, description, rules, member management, and deletion confirmation.
- [ ] Build the channel conversation view: history, pagination, composer, send state, retry, and live updates.
- [ ] Add profile access from member/message rows and useful empty/loading/error states.
- [ ] Verify the interface as owner/admin, member, outsider, and removed member.

**Point target:** demonstrate U05 end to end; the interface makes the completed backend observable.

### Session C: Finish the directory

- [ ] Add user-selectable ordering (such as username or newest) to the existing paginated directory.
- [ ] Add useful filters alongside username search and pagination.
- [ ] Apply filters and ordering on the server, validate allowed values, and preserve them while paging.

**Point target: W13 (+1).** Search and pagination already exist; sorting is missing, and the tracker expects filtering, sorting, and pagination together.

### Session D: Give admins useful activity views

- [ ] Create a protected admin overview with daily/weekly active users and session trends.
- [ ] Add group and channel usage summaries and date filters.
- [ ] Show aggregate counts only; do not expose private message text or bypass Chat membership rules.
- [ ] Make the admin view unavailable to regular users at the backend, not only hidden in navigation.

**Point target: U07 (+1).** The page should provide activity analytics and insights rather than raw service counters.

## Phase 4 — Add two low-scope completion tasks

### W13 is already in Phase 3; finish D04 here

- [x] Compose health checks cover the client, Chat, Game, judge worker, and database containers.
- [ ] Add a health check for the User service and verify coverage for all required services.
- [ ] Add a simple status page showing service availability without exposing secrets or internal details.
- [ ] Schedule backups for the User, Chat, and Game databases and define retention; include MinIO attachments in the recovery plan.
- [ ] Document and demonstrate restoring the databases and required attachment data into clean services.

**Point target: D04 (+1).** Some Compose health checks already exist, but the User service still needs one. Status visibility, automated backups, and a proven recovery procedure remain.

## Phase 5 — Complete and demonstrate Code Arena

Code Arena is now in this repository and integrated into the Nook client, User identity, Chat invitation flow, Nginx routing and Compose stack. Automated implementation work is present; module claims still need a live demonstration and evaluator confirmation.

- [x] Use authenticated game APIs and canonical `/api/game/` HTTP and Socket.IO paths.
- [x] Support 1v1 matchmaking/private rooms and four-player 2v2 rooms.
- [x] Support profile and direct-message challenges with interactive room cards.
- [x] Persist matches, rounds, scores, source submissions and collaborative state in a Game-owned PostgreSQL database.
- [x] Show public match history, basic statistics and a wins/win-rate leaderboard.
- [x] Select three distinct seeded problems for the default three-round match.

### Remaining Code Arena integration work

The implementation items above are present. These verification, operations, and data-lifecycle items remain before the integration can be called fully demonstrated:

- [x] Validate the Compose configuration with `docker compose config --quiet` (2026-11-10). This checks Compose syntax and referenced files, not the correctness of local secret values.
- [x] Verify locally that `envs/game-service.env` contains the User service's matching public JWT key, never its private key, and that Game and Judge Worker use the same strong `JUDGE_WORKER_TOKEN` (2026-11-10): verified and configured.
- [x] Run the PostgreSQL restart/recovery test with `TEST_PG_URL` pointed to a disposable test database. Passed on 2026-11-10: 5 tests, including HTTP/game execution, sockets, and Postgres restart recovery. The default in-memory API tests alone do not verify persistent SQL behavior.
- [x] Verify G01’s three-round HTTP/socket match flow and G03’s four-client 2v2 service/socket flow (2026-11-10): 4 service E2E tests and 8 2v2 integration tests passed.
- [x] Verify G02 reconnect/resume against disposable PostgreSQL and RabbitMQ (2026-11-10): all 10 real-socket service tests passed, including disconnect/rejoin and process restart with in-flight evaluations.
- [x] Fix and regression-test reconnect-state feedback when the authoritative snapshot is delayed; the client now shows the recovered socket state immediately (2026-11-10).
- [x] Smoke-test the local Nook UI in Chrome (2026-11-10): resumed an existing 1v1 lobby, created fresh 1v1 and 2v2 lobbies, confirmed public player identity and readiness updates, then left with zero active sessions. This exposed and fixed a duplicate-admission error on lobby resume; the client now reuses the user's matching active room and redirects matched rooms to their in-progress match.
- [x] Demonstrate a complete live 1v1 match with two distinct authenticated players across two browser sessions (Chrome and Chrome Incognito) across all 3 rounds (2026-11-10): verified lobby join/ready, mid-match tab reload and G02 socket snapshot recovery without state loss, live Docker Judge Worker compilation and evaluation (C++ and Python), synchronized round transitions, hidden test score reveals, final match victory screen (300 vs 225), persistent Postgres records in `matches` and `submissions`, and clean return to Play lobby with zero active sessions. Remote multi-machine test remains ready for final evaluator grading.
- [x] Demonstrate synchronized 2v2 play with four distinct authenticated players (2026-11-10): verified 2v2 lobby creation (code `CKEYCE`), 4-player seat allocation (Team Alpha: `aymanysr_b3a987ed` + `player_alpha_2`; Team Beta: `player_beta` + `player_beta_2`), synchronized readiness and host match launch, in-game isolated 2v2 Team Chat (`/chat` namespace), collaborative Monaco editor synchronization via Yjs (`/collab` namespace), dual-teammate readiness gating for submissions, live Docker judge worker test evaluations across all 3 rounds, score reveals, match completion draw reveal (100 vs 100), PostgreSQL persistence, and zero-session lobby teardown.
- [x] Consume `user.deleted` events in Game; revoke pre-deletion access tokens, remove lobby records and affected-side source/editor data, forfeit unfinished matches, anonymize retained results, and document 2v2 shared-code deletion (2026-11-10).
- [x] Live expiry and joinability indicators on duel invitation cards: direct chat renders real-time status badges (`Open`, `In Match`, `Expired`) via `GET /lobby/rooms/lookup/:code` and dynamically routes to active matches or disables expired rooms (2026-11-10).
- [x] Player progression and achievements system for Code Arena: dynamic XP, level thresholds, rank titles, and 6 unlockable badges based on completed matches and scores, integrated in `/api/game/users/:userId/stats`, user profile Games tab, and leaderboard (2026-11-10).
- [ ] Complete the D04 backup and restore work in Phase 4 for the Game database and any required attachment data, then demonstrate recovery into clean services.
- [ ] Verify the full G06 tracker criteria before claiming the point. Code Arena invitations work, but the invitation flow does not provide tournament notifications; check the other chat criteria and record evidence for each.

**Optional UX decision:** Decide whether invitation cards should show a live expiry/joinability label. Currently, opening a card routes to the lobby and Game checks joinability.

**Conditional point targets:** G01 (+2) for a complete playable game; G02 (+2) for demonstrated remote play and recovery; G03 (+2) for fair synchronized play with at least three participants. The [integration specification](../spec/code-arena-integration-spec.md) records current behavior and known limits.

### Optional: add Chess as a second game

- [ ] Wrap the existing `chess.js` match engine in a service that owns match creation, turn validation, completion, and persistence.
- [ ] Add authenticated Socket.IO rooms; only players in a match may read or send its moves.
- [ ] Persist move history, result, players, timestamps, and Elo changes in the service's own database.
- [ ] Add matchmaking/lobby flow and a frontend board with legal moves, turn state, resign/draw, reconnect, and match result.
- [ ] Add match history and rating views for Chess; Code Arena now has match history, basic statistics and a wins/win-rate leaderboard, but no Elo rating or achievement progression.

**Conditional point targets:** G04 (+2) for a second distinct game with history/statistics, matchmaking, and responsive performance. U02 (+1) remains incomplete until all local tracker criteria, including achievements/progression, are addressed. A second service does not earn D03 again.

## Other module candidates

- [ ] **G06 Advanced Chat (+1):** Code Arena challenge invitations are implemented in Phase 5, but do not alone complete G06. Verify every tracker criterion—blocked-message enforcement, game/tournament notifications, profile access, persistent history, typing indicators, and read receipts—and record evidence for each before claiming the point. The challenge-card flow does not establish tournament notifications.
- [ ] **W06 Public API (+2):** defer until stable, useful endpoints are ready for external clients. Use the planned [Public API adapter](PUBLIC_API_ADAPTER_PLAN.md) for key management, per-key limits, scopes, and allowlisted routing; document at least five database-backed endpoints covering GET, POST, PUT, and DELETE. Keep private conversation data out of it.
- [ ] **W10 SSR (+1):** if using Next.js, render a public content surface server-side for performance/SEO. Choosing Next.js alone is not sufficient.
- [ ] **W08 Notifications (+1):** cover relevant create, update, and delete actions across the product; a message alert alone is insufficient.

## Submission gate — foundation requirements

The tracker treats these as mandatory foundation checks separate from module points. Before calling the score ready, verify the whole list against the official subject:

- [ ] One-command containerized start; all required work is in this repository.
- [ ] Multiple users can act concurrently without data corruption; the team can demonstrate the work and explain the implementation.
- [ ] Chrome compatibility, responsive/accessibility basics, validated frontend/backend inputs, and a clear database schema.
- [ ] Ignored local secrets, `.env.example`, and HTTPS for external backend connections.
- [ ] Relevant Privacy Policy and Terms of Service.
- [ ] Complete root README with the required attribution, setup, resources/AI disclosure, team roles, project management, stack, schema, module owners/calculations, contributions, and challenges.

The root README and public Privacy Policy and Terms pages are now present. The exact italicized 42 attribution line, team role assignments and individual contribution mapping remain pending confirmed team information. The local tracker is a project reference, not a substitute for checking the original subject.
