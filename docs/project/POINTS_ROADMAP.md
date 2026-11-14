# Delivery Roadmap: Nook and Code Arena

This roadmap contains the platform backlog and current Code Arena follow-up. Some older group, search and analytics tasks below have not been re-audited; do not treat their checkboxes as a current implementation report.

Use [the module tracker](../requirements/index.html) as the scoring source. Point totals below are planning estimates, not confirmed awards. The evaluator decides whether each module is complete. Finish the mandatory foundation requirements as well; modules alone do not satisfy the submission requirements.

## Current scoring position

The earlier 10-point baseline and 18-point target were planning estimates, not evidence of completed rubric items, and are retired. Use the [current module tracker](../requirements/index.html) and the evidence map in the [root README](../../README.md). The supplied subject is the requirements source; this roadmap does not record a confirmed team roster, module owners or evaluator decisions, so it does not claim a final score.

## Phase 1 — Group chat backend implemented; acceptance remains open

The secured group and channel backend is implemented. See the [Chat service guide](../services/chat-service.md) for its routes and rules.

- [x] Create groups, list a caller's groups, and make the creator an admin.
- [x] Read, edit and delete groups; add members, change their roles, and let members leave or admins remove them. The final admin cannot be removed or demoted.
- [x] Create, list, update and delete text channels. Channel messages use their channel conversation and keep paginated history and per-channel unread counts.
- [x] Check active-user status, group membership and admin role on protected operations. Message and typing delivery uses the current member list; clients can reload saved history after reconnecting.
- [ ] Finish and demonstrate the group/channel interface with two accounts: owner/admin, regular member, outsider and removed member.

The completed backend does not establish that U05 is ready to claim. The remaining user-visible flow is tracked in [Session B](#session-b-make-groups-feel-real).

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

- [x] Compose health checks cover the client, User, Chat, Game, judge worker, and database containers (2026-11-10).
- [x] Add a health check for the User service and verify coverage for all required services (2026-11-10).
- [x] Add a public status endpoint (`/api/status`) and responsive status page (`/status`) showing live service availability and latency without exposing secrets or internal details (2026-11-10).
- [x] Automated backups for User, Chat, and Game databases and MinIO attachments with SHA-256 integrity verification and automated retention rotation (`infra/backup/backup.sh`) (2026-11-10).
- [ ] Demonstrate all three databases and matching attachment data restored into clean, isolated services. The earlier 2026-11-10 record referred to live restore/count checks; inspection during integration found that `verify-recovery.sh` writes into live services, so that evidence does not prove clean-service recovery. See `docs/infra/BACKUP_RECOVERY.md`.

**Conditional point target: D04 (+1).** Health/status and complete snapshot scripts are implemented. Verify the operator-installed schedule and demonstrate isolated full recovery before claiming completion.

## Phase 5 — Complete and demonstrate Code Arena

Code Arena is now in this repository and integrated into the Nook client, User identity, Chat invitation flow, Nginx routing and Compose stack. Automated implementation work and prior local 1v1/2v2 demonstration records are present; separate-computer remote-play evidence and evaluator confirmation remain pending.

- [x] Use authenticated game APIs and canonical `/api/game/` HTTP and Socket.IO paths.
- [x] Support 1v1 matchmaking/private rooms and four-player 2v2 rooms.
- [x] Support profile and direct-message challenges with interactive room cards.
- [x] Persist matches, rounds, scores, source submissions and collaborative state in a Game-owned PostgreSQL database.
- [x] Show public match history, basic statistics and a wins/win-rate leaderboard.
- [x] Select three distinct seeded problems for the default three-round match.

### Remaining Code Arena integration work

The implementation items above are present. The checklist below records prior verification, operations and data-lifecycle work. Checked items are historical evidence, not checks rerun during the documentation reconciliation. Open acceptance checks follow it:

- [x] Validate the Compose configuration with `docker compose config --quiet` (2026-11-10). This checks Compose syntax and referenced files, not the correctness of local secret values.
- [x] Verify locally that `envs/game-service.env` contains the User service's matching public JWT key, never its private key, and that Game and Judge Worker use the same strong `JUDGE_WORKER_TOKEN` (2026-11-10): verified and configured.
- [x] Run the PostgreSQL restart/recovery test with `TEST_PG_URL` pointed to a disposable test database. Passed on 2026-11-10: 5 tests, including HTTP/game execution, sockets, and Postgres restart recovery. The default in-memory API tests alone do not verify persistent SQL behavior.
- [x] Verify G01’s three-round HTTP/socket match flow and G03’s four-client 2v2 service/socket flow (2026-11-10): 4 service E2E tests and 8 2v2 integration tests passed.
- [x] Verify G02 reconnect/resume against disposable PostgreSQL and RabbitMQ (2026-11-10): all 10 real-socket service tests passed, including disconnect/rejoin and process restart with in-flight evaluations.
- [x] Fix and regression-test reconnect-state feedback when the authoritative snapshot is delayed; the client now shows the recovered socket state immediately (2026-11-10).
- [x] Smoke-test the local Nook UI in Chrome (2026-11-10): resumed an existing 1v1 lobby, created fresh 1v1 and 2v2 lobbies, confirmed public player identity and readiness updates, then left with zero active sessions. This exposed and fixed a duplicate-admission error on lobby resume; the client now reuses the user's matching active room and redirects matched rooms to their in-progress match.
- [x] Demonstrate a live 1v1 match with two distinct authenticated players across two browser sessions (Chrome and Chrome Incognito) (2026-11-10): verified lobby join/ready, mid-match tab reload and G02 socket snapshot recovery without state loss, live Docker Judge Worker compilation and evaluation (C++ and Python), a hidden-test score reveal, and clean return to Play lobby with zero active sessions. The evidence does not include a completed three-round scored 1v1 match, so no final three-round score is claimed here. The saved 1v1 evidence is a Round 1 score reveal (100 points earned; the cumulative score at 100–100 at that point, not a final result) in `docs/book/assets/code-arena-round-score-reveal-dark.png` and the live two-client demonstration of 2026-11-11, which ended in a forfeit — a completed match with a recorded winner. See [the G06 evidence](../evidence/g06-live-demo/README.md). Remote multi-machine test remains ready for final evaluator grading.
- [x] Demonstrate synchronized 2v2 play with four distinct authenticated players (2026-11-10): verified 2v2 lobby creation (code `CKEYCE`), 4-player seat allocation (Team Alpha: `aymanysr_b3a987ed` + `player_alpha_2`; Team Beta: `player_beta` + `player_beta_2`), synchronized readiness and host match launch, in-game isolated 2v2 Team Chat (`/chat` namespace), collaborative CodeMirror editor synchronization via Yjs (`/collab` namespace), dual-teammate readiness gating for submissions, and zero-session lobby teardown. The repository holds no artifact for a completed 2v2 match, a sequence of scored rounds or a final draw, so none is claimed here. The supported 2v2 evidence is the 2026-11-12 four-client run: an Alpha teammate's edit appeared in the other Alpha client, the Beta clients kept their own shared document, and Alpha's two visible tests passed with output `10`, with no scored round or completed match. See the [gameplay review](../spec/code-arena-gameplay-review.md).
- [x] Consume `user.deleted` events in Game; revoke pre-deletion access tokens, remove lobby records and affected-side source/editor data, forfeit unfinished matches, anonymize retained results, and document 2v2 shared-code deletion (2026-11-10).
- [x] Live expiry and joinability indicators on duel invitation cards: direct chat renders real-time status badges (`Open`, `In Match`, `Expired`) via `GET /lobby/rooms/lookup/:code` and dynamically routes to active matches or disables expired rooms (2026-11-10).
- [x] Player progression and achievements system for Code Arena: dynamic XP, level thresholds, rank titles, and 6 unlockable badges based on completed matches and scores, integrated in `/api/game/users/:userId/stats`, user profile Games tab, and leaderboard (2026-11-10).
- [ ] Close D04 with an installed schedule and isolated clean-service recovery for Game and matching attachment data; see the corrected Phase 4 acceptance gate above.
- [x] Record prior G06 Advanced Chat implementation and verification (2026-11-10; separate notification acceptance check remains below): enforced bidirectional block checks on direct messages (`ensureCanContact`), real-time Socket.IO typing indicators (`typing:changed`) with peer notification and debounced UI display, durable read receipts in PostgreSQL (`ConversationReadState`) with REST endpoints and real-time socket delivery (`read:updated`), profile access navigation from message rows, persistent message history, and interactive Code Arena challenge/duel notification cards. Verified with automated unit tests in `chat-service` (12/12) and `client` (38/38) and live dual-user browser sessions.

### Subject evidence and remaining acceptance checks

Use [the supplied v21.2 subject](../../ft_trans_subject.pdf) as the requirements source; module IDs are local tracker labels.

- [x] **G01 subject evidence:** Saved 1v1 evidence shows a live two-client match that ended in a forfeit — a completed match with a recorded winner — and a Round 1 score reveal (100 points earned; the cumulative score at 100–100 at that point, not a final result). The saved evidence does not include a completed three-round scored match. The game rules and win/loss/draw conditions are described in the [integration specification](../spec/code-arena-integration-spec.md). Be ready to explain them during evaluation. The subject allows a 2D or 3D game; advanced 3D graphics are a separate module.
- [ ] **G02:** Complete a live match on two separate computers, including latency/disconnection recovery (§IV.6). The recorded same-machine browser sessions do not establish the separate-computer requirement.
- [x] **G03/W09 subject evidence:** A saved four-player 2v2 run on one machine put four isolated browser clients in one match. The recorded evidence is that an edit made by one teammate reached the other teammate's editor, the opposing team kept its own separate shared document, and the Alpha team's two visible tests passed with output `10`. That run did not complete the match: no scored round, final result or final draw was recorded, so no complete 2v2 result is claimed. The subject asks for more than two players, fair play and synchronized clients; it does not require separate computers here (that is G02). See the [gameplay review](../spec/code-arena-gameplay-review.md).
- [ ] **Optional team confidence check:** Show a live reconnect during a 2v2 match. This is useful extra proof for the team; reconnect is not a separate G03 or W09 subject requirement. G02 still requires disconnection and recovery on two separate computers.
- [ ] **U02:** Demonstrate history dates/results/opponents, statistics, achievements/progression and leaderboard updates, including persistence across a service restart (§IV.3). Implementation is present; this is an acceptance check.
- [x] **G06 notification sub-check:** Verify game notifications in chat separately from direct game invitations (§IV.6 lists both). Invitation cards alone do not establish that separate requirement. Add any missing behavior before claiming full coverage. The missing behavior is implemented and automatically verified: the Game service publishes authoritative match events over the `game.events` exchange and Chat writes them into the conversation that carries the challenge (match start, match result including forfeit and deadline, and challenge cancellation). A challenge is bound to a conversation only after the Game service, which owns rooms and their membership, confirms that the sender may announce that room; a refusal writes neither a message nor a link. The notifications are persisted, delivered live, replay-safe and rejected for participants who are not members of the conversation. Automated evidence: `services/game/src/game/game-events.test.ts`, `chat-service/test/game-notifications.spec.ts`, `chat-service/test/game-notifications.postgres.test.mjs` (real PostgreSQL and a real broker round trip) and `client/tests/arena-game-notifications.test.mjs`, all run by `npm run check`. Live two-client browser demonstration (2026-11-11): two authenticated accounts in two independent browser sessions and one direct conversation showed the owner's duel invitation, the second account accepting it, the match-started notice, the match-result notice after a forfeit, the challenge-cancelled notice after a withdrawal, and the challenge-cancelled notice after an expiry; both clients received every notice live. Reloading preserved the five cards present at those checkpoints; the expiry arrived afterward and was received live and persisted once, but was not part of the reload check. The database held seven rows in that conversation, three `USER` invitations and four `SYSTEM` notifications, with distinct request IDs. Evidence and screenshots: [docs/evidence/g06-live-demo](../evidence/g06-live-demo/README.md). Known limits: broker delivery is best effort and a service restart can drop an in-flight event (no outbox), the run covered the 1v1 mode, and the two sessions shared one machine, so remote-play latency and recovery stay under G02.
- [ ] **G06 full-module check:** Demonstrate every Advanced Chat requirement together: blocking incoming messages, game invitations, game notifications, profile access, saved message history, typing indicators and read receipts. The notification sub-check above is complete, but the roadmap still asks for confirmation of the full module.
- [ ] **G09 candidate (+1, not included in the README subtotal):** Verify achievements, leaderboard and XP/levels as three features; demonstrate database-backed persistence across restart, visual feedback and clear progression rules (§IV.6). Progression currently derives from completed match records: 50 XP per match, plus 100 for a win or 25 for a draw; each 100 XP advances a level, starting at level 1.

Invitation expiry/joinability labels are implemented and polled every ten seconds; they are no longer an open UX decision.

**Conditional point targets:** G01 (+2) for a complete playable game; G02 (+2) for demonstrated remote play and recovery; G03 (+2) for fair synchronized play with at least three participants. The [integration specification](../spec/code-arena-integration-spec.md) records current behavior and known limits.

### Optional: add Chess as a second game

- [ ] Wrap the existing `chess.js` match engine in a service that owns match creation, turn validation, completion, and persistence.
- [ ] Add authenticated Socket.IO rooms; only players in a match may read or send its moves.
- [ ] Persist move history, result, players, timestamps, and Elo changes in the service's own database.
- [ ] Add matchmaking/lobby flow and a frontend board with legal moves, turn state, resign/draw, reconnect, and match result.
- [ ] Add match history and rating views for Chess; Code Arena already has match history, statistics, a wins/win-rate leaderboard and achievement/XP progression; Elo rating is not implemented.

**Conditional point targets:** G04 (+2) for a second distinct game with history/statistics, matchmaking, and responsive performance. Code Arena's U02 (+1) implementation is present; its acceptance demonstration is tracked above and does not depend on adding Chess. A second service does not earn D03 again.

## Other module candidates

- [x] **G06 Advanced Chat (+1):** Blocking, direct game invitations, profile navigation, persistent history, typing indicators and read receipts are implemented with prior test/live evidence. The separate game-notification criterion now has its own server-backed path (start, result, forfeit and cancellation notices in the linked conversation) with automated evidence and a live two-client browser demonstration (2026-11-11) recorded in [docs/evidence/g06-live-demo](../evidence/g06-live-demo/README.md); both clients received every notice live, and the five cards present at the reload checkpoints were preserved. The expiry notice arrived later and was not included in those reload checks. Invitations and notifications are distinct subject requirements.
- [ ] **W06 Public API (+2):** defer until stable, useful endpoints are ready for external clients. Use the planned [Public API adapter](POINTS_ROADMAP.md) for key management, per-key limits, scopes, and allowlisted routing; document at least five database-backed endpoints covering GET, POST, PUT, and DELETE. Keep private conversation data out of it.
- [ ] **W10 SSR (+1):** if using Next.js, render a public content surface server-side for performance/SEO. Choosing Next.js alone is not sufficient.
- [ ] **W08 Notifications (+1):** cover relevant create, update, and delete actions across the product; a message alert alone is insufficient.

## Submission gate — foundation requirements

The tracker treats these as mandatory foundation checks separate from module points. Before calling the score ready, verify the whole list against [the supplied subject](../../ft_trans_subject.pdf):

- [ ] One-command containerized start; all required work is in this repository.
- [ ] Multiple users can act concurrently without data corruption; the team can demonstrate the work and explain the implementation.
- [ ] Chrome compatibility, responsive/accessibility basics, validated frontend/backend inputs, and a clear database schema.
- [ ] Ignored local secrets, `.env.example`, and HTTPS for external backend connections.
- [ ] Relevant Privacy Policy and Terms of Service.
- [ ] Complete root README with the required attribution, setup, resources/AI disclosure, team roles, project management, stack, schema, module owners/calculations, contributions, and challenges.

The root README and public Privacy Policy and Terms pages are present. Saad's main update `9f66044` supplies the italicized attribution as the first README line, with team logins, role assignments and contribution descriptions. The team should confirm their accuracy against its actual work before submission. The checklist above remains an acceptance checklist; a local tracker is not a substitute for checking the original subject.
