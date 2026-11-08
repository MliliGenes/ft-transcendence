# Points Roadmap: Groups First, Frontend Next

This roadmap sequences the work so the group-chat backend is complete before the main frontend build. Frontend tasks are framed as visible features to build and demo, while each one also closes a module requirement where possible.

Use [the module tracker](../requirements/index.html) as the scoring source. Point totals below are planning estimates, not confirmed awards. The evaluator decides whether each module is complete. Finish the mandatory foundation requirements as well; modules alone do not satisfy the submission requirements.

## Target

The current repo-based estimate was **10 points**, pending verification of the existing modules. The quickest planned path to **18** is:

| Step | Module | Points | Running estimate |
| --- | --- | ---: | ---: |
| Current provisional baseline | W01, W04, W05, W07, U03, D03 | 10 | 10 |
| Complete groups and channels | U05 Organization system | +2 | 12 |
| Add friend online presence | U01 User management | +2 | 14 |
| Build a reusable themed component system | W12 Custom design system | +1 | 15 |
| Add activity insights for admins | U07 User activity analytics | +1 | 16 |
| Add sort/filter controls to the paginated directory | W13 Advanced search | +1 | 17 |
| Add status, automated backups, and recovery | D04 Health/status/backups/recovery | +1 | **18** |

The estimate assumes the existing modules meet their full requirements. Recheck them against the tracker before relying on the total.

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

The current account/chat frontend uses Vite and React. Build the requested Next.js app as the main experience, then migrate the working flows rather than spending the frontend phase on a static mockup.

### Session A: Set the visual foundation

- [ ] Set up Next.js with shadcn/ui and a small set of design tokens for colors, typography, spacing, and focus states.
- [ ] Add light/dark themes and a theme switcher; check text and controls in both themes.
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

- [ ] Add/verify health checks for the web app, User service, Chat service, and databases.
- [ ] Add a simple status page showing service availability without exposing secrets or internal details.
- [ ] Schedule backups for both User and Chat databases and define retention.
- [ ] Document and demonstrate restoring a backup into a clean database.

**Point target: D04 (+1).** Compose health checks already exist; status visibility, automated backups, and a proven recovery procedure remain.

## Phase 5 — Integrate the existing game, then decide on Chess

Your friend's game is outside this repo, and the Chess engine is not yet a running service here. Treat both as integration work until they are deployed, tested with separate clients, and demonstrable from the app.

### Integrate the friend's game

- [ ] Agree on a stable match/invitation API and event contract.
- [ ] Add authenticated game invitations from profiles/chat and show their current state.
- [ ] Run a full match between separate computers with clear rules and win/loss results.
- [ ] Handle latency and disconnects, then reconnect without corrupting or losing the match.
- [ ] If the game supports three or more simultaneous players, verify fair synchronized play separately.

**Conditional point targets:** G01 (+2) for the complete playable game; G02 (+2) for remote play plus latency/disconnect/reconnect behavior; G03 (+2) only if three or more players play the same match.

### Add the Chess service after the first game is integrated

- [ ] Wrap the existing `chess.js` match engine in a service that owns match creation, turn validation, completion, and persistence.
- [ ] Add authenticated Socket.IO rooms; only players in a match may read or send its moves.
- [ ] Persist move history, result, players, timestamps, and Elo changes in the service's own database.
- [ ] Add matchmaking/lobby flow and a frontend board with legal moves, turn state, resign/draw, reconnect, and match result.
- [ ] Add match history and rating views; add achievements/progression and a leaderboard only if targeting U02.

**Conditional point targets:** G04 (+2) for a second distinct game with history/statistics, matchmaking, and responsive performance; U02 (+1) if the full stats/history/achievements/leaderboard requirement is met. A second service does not earn D03 again.

## Optional points after the 18-point path

- [ ] **G06 Advanced Chat (+1):** after G01, add blocked-message enforcement, game invitations, game/tournament notifications, profile access, persistent history, typing indicators, and read receipts. All are needed; channel chat alone is not enough.
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

The current root README is only a title, so README/foundation completion needs its own focused pass before submission.
