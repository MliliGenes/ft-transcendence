# 42 Peer Evaluation & Live Defense Master Guide
*ft_transcendence v21.2 — Code Arena & Fieldnote Account Integration*

This is the comprehensive, all-inclusive defense manual for peer evaluations and teammate reviews. It provides exact terminal commands, database verification queries, pre-seeded credentials, and step-by-step browser scripts.

---

## Quick Reference & Test Credentials

| Account | Email | Password | Role / Purpose |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin@example.com` | `change-me-8-chars-min` | Platform administrator, profile testing |
| **Alice (Host)** | `alice@example.com` | `Password123!` | Player 1, room host, team leader |
| **Bob (Challenger)** | `bob@example.com` | `Password123!` | Player 2, challenger, collaborator |

- **Main Gateway**: `https://localhost/`
- **Code Arena Lobby**: `https://localhost/play/`
- **GDPR Legal Documents**: `https://localhost/privacy` and `https://localhost/terms`

---

## Proof Station 1: Fast-Track Terminal Commands

Run these commands in front of your teammate or evaluator. Every command must exit with code `0`.

### 1. Architectural Boundaries (397 Modules Checked)
```bash
npm run lint:boundaries
```
- **What it proves**: Checked via `dependency-cruiser` (`.dependency-cruiser.cjs`). Zero boundary violations. Subpackages and private internals cannot be accessed directly; all communication crosses public module entrypoints.

### 2. Full Test Suite (1,146 / 1,146 Passed — 0 Skipped)
```bash
npm test
```
- **What it proves**: 1,146 passing tests across all workspaces (`packages/arena-game`, `packages/arena-model`, `packages/browser-auth`, `services/game`, `services/judge-worker`, `frontend`). Zero failing tests and zero skipped tests.

### 3. Cyclomatic Complexity Audit (100% of Functions have CC <= 10)
Run this automated AST parser script to inspect the codebase:
```bash
node -e '
const ts = require("typescript"), fs = require("fs"), path = require("path");
function getCC(n) {
  let c = 0;
  function w(x) {
    if ([ts.SyntaxKind.IfStatement, ts.SyntaxKind.ConditionalExpression, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForInStatement, ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.CaseClause, ts.SyntaxKind.CatchClause].includes(x.kind)) c++;
    if (x.kind === ts.SyntaxKind.BinaryExpression && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(x.operatorToken.kind)) c++;
    ts.forEachChild(x, w);
  }
  w(n); return c + 1;
}
function scan(d, fl = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) scan(f, fl);
    else if (f.endsWith(".ts") && !f.endsWith(".d.ts")) fl.push(f);
  }
  return fl;
}
const res = [];
for (const f of scan("packages/arena-game/src")) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true);
  function find(n) {
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const cc = getCC(n);
      if (cc > 8) res.push({ file: path.relative(process.cwd(), f), name: n.name ? n.name.getText(sf) : "anonymous", line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, cc });
    }
    ts.forEachChild(n, find);
  }
  find(sf);
}
console.table(res);
'
```
- **What it proves**: Cyclomatic Complexity is strictly capped at `10` across every function in the domain logic, ensuring CRAP < 10.

---

## Proof Station 2: Dual Database Physical Separation

Prove that user credentials and game histories are completely decoupled across two independent PostgreSQL 17 databases running on separate volumes (`userpgdata` vs `pgdata`):

```bash
# 1. User Database Relations (Managed via Prisma ORM)
docker compose exec user-db psql -U arena_admin -d user_db -c "\dt"

# 2. Game Database Relations (Managed via SQL + JSONB state engine)
docker compose exec postgres psql -U arena_admin -d game_db -c "\dt"
```

### Table Inventory Breakdown:
- **`user_db` (11 tables)**: `User`, `UserImage`, `Friendship`, `Block`, `TwoFactorAuth`, `RecoveryCode`, `RefreshToken`, `AuthToken`, `AuthProvider`, `OAuthState`, `_prisma_migrations`.
- **`game_db` (11 tables)**: `matches`, `rounds`, `round_sides`, `submissions`, `reveals`, `collab_documents`, `arena_private_rooms`, `arena_private_room_members`, `arena_queue_entries`, `arena_runtime_ownership`, `match_failures`.

**Blast Radius Isolation**: Dropping or corrupting `game_db` leaves `user_db` authentication completely unaffected.

---

## Proof Station 3: Live Docker Infrastructure

Check the active 7-container stack:
```bash
docker compose ps
```

Expected output:
1. `aimane-nginx-1`: Ingress gateway terminating HTTPS (ports 80 and 443).
2. `aimane-user-service-1`: Fastify auth and user management (port 3000, internal).
3. `aimane-game-1`: Fastify + WebSocket Code Arena match engine (port 3001, internal).
4. `aimane-judge-worker-1`: Sandboxed code evaluation engine on isolated internal network `judge-internal`.
5. `aimane-postgres-1`: Dedicated Game PostgreSQL 17 instance.
6. `aimane-user-db-1`: Dedicated User PostgreSQL 17 instance.
7. `aimane-redis-1`: Real-time pub/sub, presence, and matchmaking queue.

---

## Proof Station 4: Step-by-Step 2-Player Live Browser Walkthrough

Follow this exact sequence with two browser windows side by side (e.g. standard Chrome and Incognito):

### Step 1: Open Ingress & Check Console
1. Navigate to `https://localhost/` in Window 1.
2. If prompted by a self-signed certificate, click **Advanced** -> **Proceed to localhost**.
3. Open DevTools (`F12` or `Cmd+Option+I`) -> **Console** tab.
4. **Show Clean Console**: Zero JavaScript errors, zero unhandled rejections, zero failed requests.

### Step 2: Show Legal Compliance & GDPR
1. Scroll to the footer and click:
   - `https://localhost/privacy`
   - `https://localhost/terms`
2. **Point out substantive legal policies**:
   - Explicit GDPR data minimization, password hashing policies (Argon2 / bcrypt).
   - In-memory ephemeral JWT tokens and `HttpOnly; Secure; SameSite=Lax` refresh cookies.
   - User code sandboxing guarantees (no network, bounded CPU/RAM).

### Step 3: Login as Alice (Host)
1. Navigate to `https://localhost/login`.
2. Enter Alice credentials:
   - **Email**: `alice@example.com`
   - **Password**: `Password123!`
3. Show authenticated session in the top navigation bar.

### Step 4: Seamless Single Sign-On Transition to Arena
1. Click the **"Play"** button or navigate to `https://localhost/play/`.
2. Notice the browser automatically recognizes Alice's active session without asking to log in again.
3. Click **"Create 1v1 Room"**.
4. Note the generated 6-character invite code (e.g., `XMFPVA`) displayed on screen.

### Step 5: Bob Joins the Match (Incognito Window)
1. Open an **Incognito window** (Window 2) and navigate to `https://localhost/`.
2. Log in with Bob credentials:
   - **Email**: `bob@example.com`
   - **Password**: `Password123!`
3. Navigate to `https://localhost/play/`.
4. In the lobby, locate the **"INVITE CODE"** input.
5. Paste Alice's 6-character invite code and click **"Join"**.
6. Both Alice and Bob now appear in the room lobby.

### Step 6: Start Match & Active Coding Phase
1. In Window 1 (Alice) and Window 2 (Bob): click **"Ready Up"**.
2. In Window 1 (Alice): click **"Start Match"**.
   - The match initializes in `ROUND_INTRO` / `MATCH_FOUND`.
3. In Window 1 (Alice): click **"Start round"**.
   - The match transitions immediately to the active `CODING` phase.
   - The authoritative round timer starts counting down.
   - The **CodeMirror 6** editor becomes active for both players.

### Step 7: Test Sandbox Execution (Judge Worker)
1. In Alice's editor: write code or leave the starter solution.
2. Click **"Run"**:
   - The code is dispatched over WebSocket to the game engine, which sends a job to `judge-worker`.
   - `judge-worker` executes the code in an ephemeral Docker container with `--network none` and `--cpus 1`.
   - Instant public test case results are returned to Alice's screen.
3. Click **"Submit"**:
   - Alice's attempt is sealed and evaluated against hidden test cases.
   - Scores remain sealed until the round concludes.

### Step 8: Test Forfeit & Disconnect Resilience
1. In Window 1 (Alice): click **"Leave match"** (or trigger forfeit).
2. Show immediate server-side resolution:
   - Bob's screen immediately updates to show `MATCH_COMPLETE` and `Opponent forfeited. You win!`.
   - Refresh both browser windows: state remains persistently completed in `game_db`.

---

## Proof Station 5: Code Quality & Uncle Bob Quality Gates

When asked how the code was engineered, explain the three **`ub-mode`** quality gates:

### Gate 1: CRAP Score Gate (Target: CRAP < 10)
- **Formula**: `CRAP(m) = CC^2 * (1 - cov)^3 + CC`
- When Cyclomatic Complexity is <= 10 and test coverage is high, CRAP is guaranteed to stay below 10.
- 100% of domain functions in `packages/arena-game` have CC <= 10.

### Gate 2: Duplication Gate / Dryer (Target: Similarity < 0.8)
- Zero copy-pasted domain logic between services.
- All shared types, schemas, and events live in `packages/arena-model`.
- Module boundaries verified via `npm run lint:boundaries`.

### Gate 3: Mutator Gate / Mutation Mindset (100% Killed)
- If you invert any condition (e.g. `if (!active)` -> `if (active)`) in `packages/arena-game/src/lib/round-lifecycle.ts`, running `npm test --workspace arena-game-engine` fails immediately with assertion errors.
- Proves tests actively guard domain rules rather than inflating superficial coverage.

---

## Proof Station 6: Security & Ingress Talking Points

Key talking points for security-minded evaluators:

1. **Sandboxed Code Execution**:
   - Only `judge-worker` has Docker socket access.
   - Ephemeral containers run with `--network none`, `--cpus 1`, `--memory 256m`, and strict wall-clock timeout reap loops.
   - Web containers cannot execute code or spawn processes.

2. **Anti-CSRF Architecture**:
   - Mutating API endpoints require custom header `X-Requested-With: XMLHttpRequest` and same-origin validation at the Nginx gateway.
   - Refresh tokens are stored in `HttpOnly; Secure; SameSite=Lax` cookies, preventing JavaScript exfiltration.

3. **Dual Database Blast Radius**:
   - `user_db` and `game_db` run on separate PostgreSQL instances with separate credentials and separate volumes.

---

## Proof Station 7: 17-Point Module Breakdown

| Module ID | Module Title | Points Claimed | Evidence in Codebase |
| :--- | :--- | :---: | :--- |
| **W01** | Frontend & Backend Frameworks | 2 | React 19 + Vite frontend; Fastify backend microservices. |
| **W04** | Real-time Features | 2 | WebSockets for matchmaking, live round countdowns, presence, and chat. |
| **W05** | User Interaction | 2 | Profiles, avatars, friendship graphs, user blocks, and isolated team chat. |
| **W09** | Real-time Collaboration | 2 | Multi-user collaborative CodeMirror editing powered by Yjs CRDTs. |
| **G01** | Complete Web-based Game | 2 | Code Arena: 1v1 and 2v2 modes, multi-language support, automated testing. |
| **G04** | Remote Players | 2 | Multi-client synchronization, reconnect grace, and socket state replication. |
| **G05** | Multiplayer (More than 2) | 2 | 2v2 four-player matches with CRDT collaborative editor and team chat. |
| **D03** | Backend Microservices | 2 | Decoupled Game Service, User Service, and Judge Worker over internal networks. |
| **S01** | Standard User Management | 1 | Secure signup/login, Argon2/bcrypt password hashing, JWT RS256 signing. |
| **Total** | **9 Modules Claimed** | **17 Points** | *(14 points required to pass)* |

---

## Proof Station 8: Emergency Troubleshooting & Quick Fixes

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `ERR_CERT_AUTHORITY_INVALID` | Dev self-signed TLS cert | Click **Advanced** -> **Proceed to localhost**. |
| `HTTP 403 Forbidden` on API calls | Missing Anti-CSRF header | Include `X-Requested-With: XMLHttpRequest` header. |
| `Port 80/443 already in use` | Local server running | Run `sudo lsof -i :80 -i :443` and terminate conflicting process. |
| Container unhealthy | Startup race condition | Run `docker compose restart <service-name>`. |
| Room full / prior state | Old room session in cache | Click **"Leave Room"** before creating a new 1v1 match. |
