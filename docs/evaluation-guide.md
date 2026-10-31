# 42 Peer Evaluation & Live Defense Guide
*ft_transcendence v21.2 — Code Arena & Fieldnote Account Integration*

This guide walks through the exact demonstration script, technical talking points, and verification commands required during the 42 project evaluation.

---

## 1. Fast-Track Verification Commands

Run these commands in the terminal in front of the evaluator to prove repository health:

```sh
# 1. Verify repository structure and deep-module boundaries
npm run check

# 2. Run unit and integration test suites
npm test

# 3. Verify standalone browser Playwright tests
npm run test:clock --workspace arena-frontend
npm run test:chat --workspace arena-frontend

# 4. Check Docker Compose container status
docker compose ps
```

All commands should exit with code `0`.

---

## 2. Live Demonstration Script (Step-by-Step)

### Step 1: Launch & Ingress (`https://localhost/`)
1. Open Google Chrome and open DevTools (`F12` or `Cmd+Option+I`) to the **Console** tab.
2. Navigate to `https://localhost/`.
   - *Evaluator note*: If Chrome displays a self-signed certificate warning, click **Advanced** $\rightarrow$ **Proceed to localhost**.
3. **Show Clean Console**: Point out that there are zero JavaScript errors or unhandled rejections in the console.

### Step 2: Legal Compliance & Privacy
1. Scroll to the footer of the page or navigate to:
   - `https://localhost/privacy`
   - `https://localhost/terms`
2. Point out that these are substantive, bespoke legal documents covering:
   - Data minimization and password hashing (Argon2 / bcrypt).
   - Ephemeral in-memory JWT tokens and `HttpOnly; Secure; SameSite=Lax` refresh cookies.
   - Container isolation and non-networked execution limits for user-submitted code.
   - GDPR user rights (data export, account deletion).

### Step 3: User Authentication & Profile
1. Navigate back to `https://localhost/login`.
2. Sign in with the pre-seeded Superadmin credentials:
   - **Email**: `superadmin@example.com`
   - **Password**: `change-me-8-chars-min`
3. Point out:
   - Single Sign-On session established via `browser-auth`.
   - In DevTools Application tab $\rightarrow$ Cookies: Notice `auth-refresh` cookie has `HttpOnly`, `Secure`, and is scoped to `Path=/api/auth/`.
4. Update display name or upload a profile image in the Account settings.

### Step 4: Seamless Transition to Code Arena (`/play/`)
1. Click the **"Play"** button in the top navigation bar.
2. The browser navigates smoothly to `https://localhost/play/`.
3. Point out that the authentication session is automatically inherited without re-prompting for credentials.

### Step 5: Code Arena 1v1 Match
1. In the Code Arena Lobby:
   - Select **1v1 Mode**.
   - Create or join a match room.
2. Enter the match:
   - Point out the **CodeMirror 6** editor with syntax highlighting for C, C++, and Python.
   - Show the authoritative round timer counting down in real-time.
3. Test **Run** (Sandbox execution):
   - Type code solving the problem or use the starter template.
   - Click **Run**: shows immediate execution against public test cases (does not affect final match score).
4. Test **Submit** (Sealed attempt):
   - Click **Submit**: the solution is sealed and judged asynchronously against hidden test cases.
   - Point out that hidden test results and scores remain strictly concealed until the **Score Reveal** phase.
5. **Score Reveal & Progression**:
   - Both players submit or the timer expires.
   - The match transitions to `SCORE_REVEAL`: detailed score breakdowns, execution timings, and test case tallies are revealed simultaneously to both sides.
   - Advance to Round 2 and Round 3.
   - Final scoreboard displays overall match winner.

### Step 6: 2v2 Multiplayer & Team Collaboration (Candidate Module)
1. Open a second browser window (or Incognito window) and log in with a second account.
2. Join a **2v2 Room**:
   - Left Team (Players 1 & 2) vs Right Team (Players 3 & 4).
3. Demonstrate **Real-Time Collaboration**:
   - Show shared document editing via **Yjs / CRDTs**: simultaneous typing on the same team is synchronized character-by-character with colored remote carets.
   - Readiness coordination: teammates must coordinate their submission.
4. Demonstrate **Team Chat Isolation**:
   - Send chat messages and tactical pings in the in-game Team Chat.
   - Point out that the opposing team's chat is completely isolated and cannot see teammate communication.

### Step 7: Disconnect / Reconnect & Forfeit Resilience
1. In an active match, refresh the browser window or close the tab and reopen it.
   - Point out that the session and CodeMirror editor state resume immediately via WebSocket reconnect grace period (`RECONNECT_GRACE_MS`).
2. Click **Leave match** (Forfeit):
   - Point out immediate match conclusion: the forfeit is recorded server-side, both players immediately receive authoritative notification, and the outcome persists across reloads.

---

### 3. Architecture & Security Talking Points

When evaluators ask technical questions, highlight these architectural decisions:

1. **Strict Container Isolation (`judge-worker`)**:
   - User submitted code is never executed on the host or inside web service containers.
   - The private `judge-worker` container is the **only** container with access to `/var/run/docker.sock`.
   - Worker execution happens in ephemeral containers with `--network none`, strict CPU limits (`--cpus 1`), memory caps (`--memory 256m`), read-only root filesystems, and bounded wall-clock timeouts.
   - Internal communication between `game` and `judge-worker` runs over a private, internal-only Docker network (`judge-internal`).

2. **Dual Database Architecture**:
   - **User Database (`user_db`)**: Dedicated PostgreSQL instance managed via Prisma ORM for accounts, roles, friendship graphs, blocks, and password hashes.
   - **Game Database (`game_db`)**: Dedicated PostgreSQL instance for match histories, revisions, round snapshots, Yjs updates, and ratings.
   - Databases run on separate volumes (`userpgdata` vs `pgdata`), preventing cross-domain blast radius.

3. **Cyclomatic Complexity & Code Quality**:
   - Decomposed every function across the entire codebase to **CC $\le$ 10** (composition roots $\le$ 20).
   - Strict deep-module boundaries enforced by `dependency-cruiser` (`.dependency-cruiser.cjs`), ensuring subfolders and internal implementations remain strictly private.

4. **CSRF & Security Architecture**:
   - Ingress terminates at Nginx (`infra/gateway/Dockerfile`).
   - Anti-CSRF verification checks: all mutating authentication calls require explicit `X-Requested-With: XMLHttpRequest` and same-origin validation.
   - Refresh tokens are stored in `HttpOnly; Secure; SameSite=Lax` cookies, preventing XSS exfiltration. Access tokens reside solely in browser memory.

---

### 4. 17-Point Module Breakdown

| Module | Points | Evidence in Codebase |
| :--- | :---: | :--- |
| **Frontend & Backend Frameworks** | 2 | React 19 + Vite frontends, NestJS Game and User microservices. |
| **Real-time Features** | 2 | Socket.IO WebSockets for matchmaking, match state, presence, and chat. |
| **User Interaction** | 2 | Profiles, avatars, relationships (friends/blocks), and team chat. |
| **Standard User Management** | 2 | User registration, password hashing, JWT RS256 signing, and cookie sessions. |
| **Complete Web-based Game** | 2 | Code Arena: 1v1 and 2v2 modes, multi-language support, automated testing. |
| **Remote Players** | 2 | Multi-client synchronization, reconnect grace, and socket state replication. |
| **Multiplayer (More than 2)** | 2 | 2v2 four-player matches with CRDT collaborative editor and team chat. |
| **Backend Microservices** | 2 | Decoupled Game Service, User Service, and Judge Worker over internal networks. |
| **OAuth 2.0 Integration** | 1 | Provider routing and linking infrastructure for GitHub and Discord. |
| **Total Points Claimed** | **17** | *(14 required to pass)* |
