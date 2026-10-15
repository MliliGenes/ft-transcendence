# Manual game testing and command reference

Source inventory checked: 2026-10-15, Aimane at `fd7f6e6` plus local documentation changes.
This guide tells you how to test. It is not a claim that these tests were run today.

## 1. Start here

```sh
cd /path/to/ft-transcendence
bash scripts/manual-game-test.sh --list
bash scripts/manual-game-test.sh
```

The wizard has 20 approved stages. It opens the chosen site and records your
observations; it does not start containers, execute test suites, stop services,
change application `.env`, capture passwords/tokens, or mark a skipped test as
passed. It saves the public test origin in
`.scratch/manual-game-testing/settings.env` and results under
`.scratch/manual-game-testing/runs/`. Both stay ignored by Git.

```sh
bash scripts/manual-game-test.sh --group 1  # access/account/Lobby
bash scripts/manual-game-test.sh --group 2  # solo game
bash scripts/manual-game-test.sh --group 3  # team game
bash scripts/manual-game-test.sh --group 4  # session/recovery
bash scripts/manual-game-test.sh --group 5  # final checks
bash scripts/manual-game-test.sh --from 12 # resume at reconnect, new result report
```

Allow about 3-5 hours for a full manual pass with four profiles, including real
15-minute auth expiry and a separate 30-minute Match deadline. Provider setup,
remote computers, image downloads and first builds add time. Groups can run in
separate sessions. Four local profiles prove four sessions, not four computers. A complete stage needs every listed check; record SKIP with partial observations if a prerequisite is missing.

**Darija:** PASS kat3ni belli chfti l-resultat l-matloub. Ila ma jerrbtich test,
kteb SKIP w sabab. Tkmil wizard ma kay3nich ga3 l-game validated.

Use Bash for the command blocks with functions, `read` or arrays:

```sh
bash
```

The root Game workspace requires Node 22. Standalone Account/User Service use
Node 24. To avoid the machine's current Node 26, either select those versions
with your Node manager, or define these helpers once per terminal:

```sh
qa22() { npx --yes --package=node@22 --package=npm@10 --call "$1"; }
qa24() { npx --yes --package=node@24 --package=npm@11 --call "$1"; }
qa22 'node --version'
qa24 'node --version'
```

The helpers download registry packages on first use. Only pass trusted command
text from this guide. Values such as test database URLs are inherited from the
terminal environment; do not interpolate credentials into command strings.

## 2. Choose the right environment

### A. Real password login and normal manual play (recommended)

Use the existing configured local Compose environment. Starting it reuses its
existing data. Use disposable QA accounts for account edits and Match actions.
Do not point database-clearing automated tests at these databases.

```sh
# From the repo root. Create .env only if missing; then fill its placeholders.
test -f .env || cp .env.example .env
# Check required names in .env.example; keep real values out of reports/Git.
# Generate local certificates only if the existing files are missing/expired:
openssl x509 -in infra/nginx/certs/localhost.crt -noout -dates
# If new local certificates are needed:
# bash scripts/gen-dev-certs.sh

docker info >/dev/null
docker compose --project-name ft-transcendence config --quiet
docker compose --project-name ft-transcendence up -d --build
docker compose --project-name ft-transcendence ps
```

Expected: seven services: `postgres`, `user-db`, `redis`, `user-service`, `game`,
`judge-worker`, `nginx`. Open `https://localhost/login`. The local certificate is
self-signed; review any browser trust prompt yourself. Public certificate trust
is a separate check. The Docker socket is mounted only in the Judge worker.

`.env` needs database credentials, JWT keys, superadmin bootstrap fields,
`AUTH_FRONTEND_URL`, SMTP settings and the private Judge token. OAuth settings are
optional until the live-provider stage. Configure `DEV_PRINCIPAL=false` here.
Use normal login and Account's **Play** link, not a `?user=` URL.

```sh
curl --cacert infra/nginx/certs/localhost.crt --fail https://localhost/health
curl --cacert infra/nginx/certs/localhost.crt --fail https://localhost/ready
docker compose --project-name ft-transcendence exec -T game \
  node -e 'fetch("http://localhost:3002/ready").then(r=>{console.log(r.status);process.exit(r.ok?0:1)})'
docker compose --project-name ft-transcendence exec -T judge-worker \
  node -e 'fetch("http://localhost:3010/ready").then(r=>{console.log(r.status);process.exit(r.ok?0:1)})'
```

Expected: HTTP 200. Gateway `/ready` alone is Nginx liveness, not proof that Game
owns its runtime or the Judge is ready. Keep the separate service probes.

### B. Development-only game identity and mock UI

This mode tests Game/UI without password auth. It is not auth proof. Game
binds `0.0.0.0:3220`; the Vite `--host 127.0.0.1` option does not restrict Game.
With `DEV_PRINCIPAL=true`, any peer that can reach Game can use test identities.
Use section 2A for normal manual play on a connected workstation.

For this fixture, use a disposable VM. Prepare the dependencies and images
inside that VM while its network adapter is connected:

```sh
qa22 'npm ci && npm run build:packages && npm run build --workspace arena-game'
docker pull python:3.12-slim
docker pull gcc:14-bookworm
```

Then disable every VM network adapter in the VM manager before starting Game.
Keep the browser, Docker Engine and both terminals inside the VM. The VM must
have no LAN, Internet, VPN or forwarded host-port access. If you cannot enforce
this isolation, do not start the dev-identity fixture; use section 2A instead.
Dependencies and runner images must already be cached. Without DATABASE_URL,
Game uses memory, so process-restart persistence is not proved.

```sh
# Terminal 1, inside the disconnected VM. Use the qa22 definition in this terminal.
DEV_PRINCIPAL=true PORT=3220 DATABASE_URL= JUDGE_BACKEND=container \
  npm_config_offline=true qa22 'node services/game/dist/main.js'

# Terminal 2: DEV Vite, not a production preview.
VITE_GAME_URL=http://localhost:3220 \
  npm_config_offline=true qa22 'npm run dev --workspace arena-frontend -- --host 127.0.0.1 --port 4173 --strictPort'
```

Open `http://localhost:4173/?live=1&user=qa-a` and another player URL using
`user=qa-b`; four players can use `qa-a` through `qa-d`. These query identities
work only in the development app outside `/play/`. A dev UI mock playground is
`http://localhost:4173/` without `live=1`; it is visual behavior only.

**Current wrapper limit:** `npm run play` builds a production frontend and serves
it with preview, while current production code intentionally ignores dev query
identities. Use the two-terminal Vite command above for dev-identity testing.
No production identity guard was weakened for this guide.

### C. Production Arena-only frontend fixture

For the mocked-auth production guard regressions, serve a production build:

```sh
VITE_API_URL=/api qa22 'npm run build --workspace arena-frontend'
qa22 'npm run preview --workspace arena-frontend -- --host 127.0.0.1 --port 4174 --strictPort'
```

This is an Arena fixture, not the full Account/gateway application. It is useful
for mocked browser tests below. Build output is shared: do not rebuild the same
frontend directory while another preview/browser run uses it.

## 3. Test accounts and browser tools

Use four independent browser profiles A/B/C/D, plus a fifth/sixth
normal account for the full passive-Lobby expiry check and cross-Match isolation. Separate normal tabs
and multiple private windows from the same browser profile can share cookies.
A/B form one 2v2 team; C/D form the other. Use additional tabs **within A** only
when intentionally testing cross-tab logout/account replacement.

Chrome: Profile menu → Add Chrome profile; create independent local profiles.
See [Chrome's profile instructions](https://support.google.com/chrome/answer/2364824).
No Google account sign-in is needed for these local game test identities.

Keep DevTools open with Console and Network. Observe `/api/` requests and the
`/socket.io/` connection. Different Socket.IO namespaces can share one transport;
do not expect four separate browser WebSocket connections.

Record stage, environment/commit, steps, expected result and actual result.
Reports must not contain passwords, JWTs, cookies, OAuth codes or reset links.

## 4. Small code samples for manual judging

Check the problem title and selected language before pasting. **Even Ledger**
is a snippet problem; **Double It** is a standard-input/output program. Their
wrappers differ. These examples use the source-defined public problem contract;
do not inspect hidden fixtures as part of a player-isolation test.

### Even Ledger: correct implementations

Python:

```python
class Solution:
    def ledger_sum(self, nums: list[int]) -> int:
        return sum(v if i % 2 == 0 else -v for i, v in enumerate(nums))
```

C++:

```cpp
#include <vector>
using namespace std;
class Solution {
public:
    long long ledgerSum(const vector<long long>& nums) {
        long long total = 0;
        for (size_t i = 0; i < nums.size(); ++i)
            total += i % 2 == 0 ? nums[i] : -nums[i];
        return total;
    }
};
```

C:

```c
#include <stddef.h>
long long ledgerSum(long long* nums, int n) {
    long long total = 0;
    for (int i = 0; i < n; ++i) total += i % 2 == 0 ? nums[i] : -nums[i];
    return total;
}
```

### Double It: correct Python program

```python
import sys
print(2 * int(sys.stdin.read().strip()))
```

C++:

```cpp
#include <iostream>
int main() {
    long long x;
    if (!(std::cin >> x)) return 0;
    std::cout << 2 * x << '\n';
    return 0;
}
```

C:

```c
#include <stdio.h>
int main(void) {
    long long x;
    if (scanf("%lld", &x) != 1) return 0;
    printf("%lld\n", 2 * x);
    return 0;
}
```
Wrong-result test: retain the starter that returns/prints zero. Compile/syntax
error: remove required syntax. Runtime error: raise an exception in the Python
method. Timeout: use `while True: pass` inside the Python method on test data.
Expected: clear execution failure, not an application crash or fabricated score.

Default Game Run limit is 10 in a 60-second window. If throttled, wait rather
than treating a deliberate limit as a broken Judge. Scores and exact tie-breaks
are tested by the focused automated commands in section 6.

## 5. Browser failure controls

Use these controls only on your QA page. Return the browser to its normal state
before the next independent case.

- Offline: DevTools → Network → No throttling → Offline. Return to No throttling
  to reconnect. Confirm the existing socket really disconnected; if it did not,
  use an actual controlled network disconnect and record that method. In 1v1,
  return within the default 90-second grace when testing
  recovery; test longer absence separately because it can forfeit.
- Failed logout: DevTools Command Menu (`Command+Shift+P` on macOS,
  `Control+Shift+P` on Windows/Linux), search for request blocking/conditions.
  Add `*/api/auth/logout`, enable blocking, then sign out. Reload while blocked;
  the local logout intent must still prevent restore. Remove the block before
  a deliberate new login. UI names can vary by Chrome version; use the current
  [request-conditions instructions](https://developer.chrome.com/docs/devtools/request-conditions).
- Rejected shared input: on a disposable 2v2 round, disconnect one teammate, edit
  from the other, and reconnect. Check convergence and current readiness. For a
  deterministic server rejection/manual recovery copy and failed refresh after
  accepted command, use `command-recovery.spec.ts`; a normal offline edit alone
  is not guaranteed to produce a rejected server update.
- Natural expiry: a freshly signed access token lasts 900 seconds. Leave Match
  and a separate Lobby idle 16 minutes. Do not fake server time or change TTL.
  Expect a real refresh and fresh baselines before commands resume.
- Responsive checks: test 1440, 1024, 768 and 320px; use Device Mode plus keyboard
  navigation. Keep font controls, errors and focus reachable. DevTools offline
  affects network behavior, not the authoritative server deadline.

See [Chrome Network reference](https://developer.chrome.com/docs/devtools/network/reference)
for offline/throttling controls. A browser clock changed by a test does not change
host/server time. Use the real-service slow-clock suite for the exact regression.

## 6. Automated commands you can run yourself

### Root checks, builds and component suites (Node 22)

From the repository root, after `qa22 'npm ci'`:

```sh
qa22 'npm run check:repository'  # allowed paths and documentation links
qa22 'npm run lint:boundaries'   # package imports and cycles
qa22 'npm run typecheck'         # TypeScript
qa22 'npm run lint'              # frontend linter
qa22 'npm run check'             # combined checks; includes example tests
qa22 'npm run build'             # root packages/Game/Judge/Arena production output
qa22 'npm test'                  # all root workspaces plus example
```

`npm test` builds shared packages first. Root workspaces do NOT include standalone
`auth-profile-web` or `user-service`. Tests can launch child Game processes, use
Docker, and clear fixture tables. Use the separate PostgreSQL database below,
never the application Game database. Skip counts without optional fixtures are
not a complete PostgreSQL pass. Stop any dev Game using the same test database
before running the suite; ownership enforcement must remain enabled.

```sh
qa22 'npm run build:packages'
qa22 'npm test --workspace arena-model'
qa22 'npm test --workspace arena-game-engine'
qa22 'npm test --workspace arena-harness'
qa22 'npm test --workspace browser-auth'
qa22 'npm test --workspace arena-game'
qa22 'npm test --workspace arena-judge-worker'
qa22 'npm test --workspace arena-frontend'
qa22 'npm run test:example'
```

Focused cases, using exact current filenames:

```sh
qa22 'npm test --workspace arena-game-engine -- test/scoring-reveal.test.ts test/deadline-closure.test.ts test/diagnosis-match-rules.test.ts'
qa22 'npm test --workspace arena-game-engine -- test/lobby-contract.test.ts test/lobby-atomic.test.ts test/concurrency.test.ts'
qa22 'npm test --workspace arena-game-engine -- test/sealing.test.ts test/cross-isolation.test.ts test/judge-security.test.ts'
qa22 'npm test --workspace arena-game-engine -- test/team-collaboration.test.ts test/team-chat.test.ts test/collab.test.ts'
qa22 'npm test --workspace arena-game-engine -- test/runtime-ownership.test.ts test/persistence.test.ts test/shared-document-cache.test.ts'
qa22 'npm test --workspace arena-game -- src/game/runtime-live.test.ts src/game/socket-authorization-repairs.test.ts src/game/socket-expiry.test.ts'
qa22 'npm test --workspace arena-frontend -- src/arena/auth-renewal.test.ts src/arena/connection-lifetimes.test.ts src/components/ArenaPage.test.tsx'
```

These cover exact race/expiry/authority cases that a click-through cannot reliably
reproduce. To watch one Vitest file interactively, use the installed Vitest CLI
from that workspace, e.g. `qa22 'cd frontend && npx vitest src/arena/auth-renewal.test.ts'`.

### Disposable PostgreSQL fixtures

This fixture is independent of Compose application volumes. Its password is a
public, test-only value; the port binds only to loopback. If the name/port already
exists, inspect it before choosing another; do not remove an unknown container.

```sh
docker run -d --name arena-manual-tests-pg \
  --label code-arena.fixture=manual-tests \
  -e POSTGRES_PASSWORD=manual_test_only \
  -p 127.0.0.1:18432:5432 postgres:17-alpine
docker exec arena-manual-tests-pg pg_isready -U postgres
# Wait until ready; then create two separate fixture databases:
docker exec arena-manual-tests-pg createdb -U postgres arena_game_test
docker exec arena-manual-tests-pg createdb -U postgres arena_user_test

# In the terminal used for root tests only:
export TEST_PG_URL='postgresql://postgres:manual_test_only@127.0.0.1:18432/arena_game_test'
export DATABASE_URL="$TEST_PG_URL"
ARENA_DIAGNOSIS_DOCKER=1 qa22 'npm test'
```

Expected: optional PostgreSQL cases execute; the opt-in Docker timeout-reaping
case also executes. Some tests create temporary databases/schemas, so this role
is intentionally powerful only inside this disposable fixture. Run heavy root
and Judge browser suites sequentially to avoid confusing timing failures.

### Standalone Account and User Service (Node 24)

```sh
qa24 'cd auth-profile-web && npm ci && npm test && npm run build'
qa24 'cd user-service && npm ci'
```

User Service Prisma needs explicit fixture settings. Create this ignored file;
it contains only the disposable values above, no application credentials:

```sh
mkdir -p .scratch/manual-game-testing
(umask 077; cat > .scratch/manual-game-testing/auth-tests.env <<'ENV'
NODE_ENV=test
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=18432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=manual_test_only
POSTGRES_DB=arena_user_test
AUTH_TEST_DATABASE_URL=postgresql://postgres:manual_test_only@127.0.0.1:18432/arena_user_test
AUTH_FRONTEND_URL=http://localhost:5173
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=manual-fixture
SMTP_PASSWORD=manual-fixture
GITHUB_LINK_REDIRECT_URI=
DISCORD_LINK_REDIRECT_URI=
DOTENV_CONFIG_PATH=/dev/null
ENV
)

# Source only this trusted fixture file, not application .env. Subshell contains its settings.
(
  set -a
  . .scratch/manual-game-testing/auth-tests.env
  set +a
  qa24 'cd user-service && npm run prisma:generate && npx prisma migrate deploy && npm run build && node --test --test-isolation=none test/*.test.mjs'
)
```

Expected: generated client/build and all Node `.test.mjs` cases run against the
fixture (including PostgreSQL cases). Fixture mail services are mocked; no real
mail delivery is established. To run a subset, keep the same subshell settings:

| Command from `user-service/` with Node 24 | Coverage |
| --- | --- |
| `npm run test:register` | Registration/token contract |
| `npm run test:auth` | Four named auth files; NOT the complete `.test.mjs` suite |
| `npm run test:auth:postgres` | Real refresh/logout transaction ordering; migrated `*_test` DB required |
| `npm run test:accounts` | Account/profile/image HTTP cases |
| `npm run test:superadmin` | Bootstrap/admin HTTP cases |
| `npm run test:discord` | Mocked provider/database with JWT checks |
| `npm run build && node --test --test-isolation=none test/discord-link.postgres.test.mjs` | Provider constraints/concurrency in an owned schema; uses the exported fixture settings |
| `npm run lint` / `npm run prisma:validate` | Source lint / schema validation |

`npm test`, `test:e2e`, `test:watch`, `test:cov`, `test:debug` in User Service
select Vitest `*.spec.ts`/`*.e2e-spec.ts`; this checkout has no matching source
files. They are not a replacement for the Node `.test.mjs` suites above.
`npm run test:discord:postgres` adds Node's `--env-file=.env` flag. It fails
before testing when `user-service/.env` is absent, and that flag does not use
`DOTENV_CONFIG_PATH`. Use the direct Discord PostgreSQL command in the table
with the exported disposable fixture settings; do not copy application secrets
into an `.env` file just to satisfy this wrapper.

`format`, `deploy` and bootstrap scripts are mutations, not verification commands.

### Browser commands and their different fixtures

```sh
qa22 'cd frontend && npx playwright install chromium'
qa22 'cd frontend && npx playwright test --list'
```

Do not run every browser spec blindly against one shared server. Use the matrix:

| Specs | Required target / boundary |
| --- | --- |
| `live-lobby`, `live-1v1`, `live-2v2`, `live-collab`, `live-team-chat`, `reconnect` | Dev Game 3220 + DEV Vite 4173, development identities, real judging |
| `command-recovery` | Same dev setup; intentionally intercepted network failures |
| `diagnosis-ui` | DEV Vite root mock playground; no Game authority proof |
| `auth-flow`, `auth-integration-repairs` | Arena frontend with mocked auth/API/socket fixtures; production build 4174 for production guard cases |
| `account-auth-repairs` | Actual Account app, mocked APIs; separate Account Vite 18475 |
| `collab-reconnect` | Destructive dev-process fixture: kills the listener on fixed port 3220 and restarts Game; PostgreSQL required |
| `auth-real-services` | Fixed owned HTTPS project/fixture below; real services and logout failure injection |

Normal dev journeys, from another terminal with section 2B running:

```sh
E2E_GAME_URL=http://localhost:3220 E2E_WEB_URL=http://localhost:4173 \
  qa22 'cd frontend && npx playwright test e2e/live-lobby.spec.ts e2e/live-1v1.spec.ts e2e/live-2v2.spec.ts e2e/live-collab.spec.ts e2e/live-team-chat.spec.ts e2e/reconnect.spec.ts'

# Choose one file for visible debugging; use the same fixture environment:
E2E_GAME_URL=http://localhost:3220 E2E_WEB_URL=http://localhost:4173 \
  qa22 'cd frontend && npx playwright test e2e/live-2v2.spec.ts --headed'
# Replace --headed with --debug to pause in Inspector, or --ui for test UI.
# Add --trace on for diagnostics.
qa22 'cd frontend && npx playwright show-trace /absolute/path/to/trace.zip'
```

For screenshots/video, set `use.screenshot: "only-on-failure"` and
`use.video: "retain-on-failure"` in a separate Playwright configuration; they are
configuration fields, not `playwright test` CLI flags.

Keep traces/HAR local: browser artifacts can contain credentials and test data.
A live test can mutate fixture Matches. `collab-reconnect.spec.ts` must not run
while an unrelated service uses port 3220. It does not restart the Compose Game.

Production auth consumer regressions, with section 2C running:

```sh
TASK2_PRODUCTION=1 E2E_WEB_URL=http://127.0.0.1:4174 \
  qa22 'cd frontend && npx playwright test e2e/auth-flow.spec.ts e2e/auth-integration-repairs.spec.ts'
```

Account fixture (Terminal 1, do not use the root Game workspace's Vite):

```sh
qa24 'cd auth-profile-web && npm run dev -- --host 127.0.0.1 --port 18475 --strictPort'
```

Then Terminal 2:

```sh
E2E_ACCOUNT_WEB_URL=http://127.0.0.1:18475 \
  qa22 'cd frontend && npx playwright test e2e/account-auth-repairs.spec.ts'
```

Full real HTTPS proof is deliberately gated. These two variables alone do not
provision a stack:

```sh
E2E_REAL_AUTH_FIXTURE=/absolute/private/accounts.json \
E2E_REAL_AUTH_KEY=/absolute/private/matching-rsa-key.pem \
  qa22 'cd frontend && npx playwright test e2e/auth-real-services.spec.ts'
```

Required: project `auth-repair-proof-20261013`, origin `https://localhost:18443`,
six normal users, matching server RSA key, JSON `{origin,password,users}` (each
user has username/email), `DEV_PRINCIPAL=false`, private separate DBs/volumes.
The test checks ownership labels before it stops User Service. Earlier private
fixtures were removed after the completed proof; the command will skip without
its fixture or fail if it targets a different stack. Recreate that owned fixture
before rerunning; the unrelated QA project in section 8 is not a substitute.
See [recorded reproduction/evidence](auth-integration-repair-evidence.md).
Allow at least 16 minutes for its natural-expiry group. Never point it at a
real account database just to satisfy its fixed names.

## 7. API checks (manual commands)

### Anonymous and boundary probes

```sh
export QA_ORIGIN=https://localhost
curl --cacert infra/nginx/certs/localhost.crt -s -o /dev/null -w '%{http_code}\n' \
  "$QA_ORIGIN/api/lobby/active"                 # 401
curl --cacert infra/nginx/certs/localhost.crt -s -o /dev/null -w '%{http_code}\n' \
  "$QA_ORIGIN/api/lobby/active?user=forged" \
  -H 'x-dev-user-id: forged'                     # still 401 in production
curl --cacert infra/nginx/certs/localhost.crt --silent --show-error \
  --write-out '\nHTTP %{http_code}; type %{content_type}\n' \
  "$QA_ORIGIN/v1/run-visible"                   # Account HTML fallback, not Judge JSON
curl --cacert infra/nginx/certs/localhost.crt -s -o /dev/null -w '%{http_code}\n' \
  -X POST "$QA_ORIGIN/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data '{"email":"no-user@example.com","password":"WrongFixture123!"}'  # 403, browser headers missing
```

Expected for `GET /v1/run-visible`: HTTP 200 with `text/html` and the Account
SPA document. Nginx falls back to `/index.html`; this path does not prove privacy
by returning 404. Confirm the body is the frontend document, not a Judge result.
Also inspect section 8's Compose port list: Judge has no published port, Nginx
has no Judge upstream/route and is outside the private `judge-internal` network.
The fallback probe alone does not establish that network boundary.

### Authenticated reads and queue (no token saved to disk)

In a Bash terminal, copy the **disposable test account's** current access token
from its login/refresh response in DevTools Network. Do not paste it into chat,
report or a literal command. Enter it at this hidden prompt:

```sh
IFS= read -r -s -p 'Test access token: ' QA_ACCESS_TOKEN
printf '\n'
[[ "$QA_ACCESS_TOKEN" =~ ^[-_a-zA-Z0-9]+\.[-_a-zA-Z0-9]+\.[-_a-zA-Z0-9]+$ ]] || unset QA_ACCESS_TOKEN
qa_api() {
  local qa_method="$1" qa_path="$2" qa_body="${3-}"
  local qa_payload_args=()
  test -z "$qa_body" || qa_payload_args=(--data "$qa_body")
  test -n "${QA_ACCESS_TOKEN:-}" || { printf 'Enter a fresh test token first.\n' >&2; return 1; }
  { printf 'header = "Authorization: Bearer %s"\n' "$QA_ACCESS_TOKEN"; } |
    curl --config - --cacert infra/nginx/certs/localhost.crt \
      --silent --show-error --write-out '\nHTTP %{http_code}\n' \
      --request "$qa_method" --header 'Content-Type: application/json' \
      "${qa_payload_args[@]}" "$QA_ORIGIN/api$qa_path"
}
qa_api GET /auth/principal             # userId + future expiresAt
qa_api GET /accounts/me                # this account only
qa_api GET /lobby/active                # current room/queue/Match state
qa_api POST /lobby/queue '{"mode":"1v1"}'
qa_api GET /lobby/queue/status
qa_api POST /lobby/queue/cancel '{}'
unset QA_ACCESS_TOKEN                  # remove token from this shell when done
```

The queue API is real; the current Lobby UI exposes invitation rooms only.
A queue entry can immediately match another waiting fixture user. Cancel only
removes a still-waiting queue entry; inspect `/lobby/active` afterward. Expired
tokens return 401; obtain a new test token rather than assuming this helper
renews one. The wizard never reads or persists this token.

With a fresh hidden token and a Match ID copied from your game URL:

```sh
IFS= read -r -s -p 'Fresh test access token: ' QA_ACCESS_TOKEN
printf '\n'
read -r -p 'Test Match ID: ' QA_MATCH_ID
qa_api GET "/matches/$QA_MATCH_ID/snapshot"
qa_api GET "/matches/$QA_MATCH_ID/final"
# A different nonmember test token must not read this Match or act for its members.
```

Snapshot success requires membership; final-result availability depends on phase.
For exact mutation bodies, use `services/game/src/game/game.controller.ts` and
`lobby.controller.ts`. Supported Match actions: start, begin, run, ready,
language, submit, advance, leave. Do not edit phase, score, side or timer in a
client payload. Authenticated normal users cannot mint arbitrary Matches through
the development-only `POST /matches` endpoint.

### Game action request examples

Use `qa_api` with a fresh hidden test token and the intended disposable Match.
Choose one action at a time according to its current phase; do not paste the
whole table as a lifecycle script. A nonmember must be refused.

| Action | Request example / body | Expected boundary |
| --- | --- | --- |
| Start / enter coding | `qa_api POST "/matches/$QA_MATCH_ID/start" '{}'` then `begin` | Only valid phase/member; UI Start round performs the normal transition |
| Run | `qa_api POST "/matches/$QA_MATCH_ID/run" '{"language":"Python","code":"class Solution:\n    def ledger_sum(self, nums):\n        return 0"}'` | Visible tests only; no counted score |
| Ready | `qa_api POST "/matches/$QA_MATCH_ID/ready" '{"ready":true,"documentRevision":1}'` | Use actual current revision; stale revision rejected |
| Language | `qa_api POST "/matches/$QA_MATCH_ID/language" '{"language":"Python"}'` | Team/member/current-state checks |
| Submit | `qa_api POST "/matches/$QA_MATCH_ID/submit" '{"language":"Python","code":"class Solution:\n    def ledger_sum(self, nums):\n        return 0","documentRevision":1}'` | Current 2v2 revision/readiness required; authoritative team code, not forged body code |
| Advance | `qa_api POST "/matches/$QA_MATCH_ID/advance" '{}'` | Only after the proper reveal state |
| Leave | `qa_api POST "/matches/$QA_MATCH_ID/leave" '{}'` | Deliberate terminal action on this fixture Match; choose it only when intended |

Submission/evaluation retry IDs are optional controller fields, but must stay
stable when testing an idempotent retry. Do not reuse one identity for different
source. Use the unit/integration suites for deterministic duplicate/race proofs.

Account API families are `/accounts/me` (GET/PATCH), `/accounts/me/password`
(PATCH for change, POST for setting a first password), avatar/banner uploads
(PUT with multipart `file`) and social friendships/blocks. Account deletion
(`DELETE /accounts/me`) is irreversible: exercise it only on a separately created
disposable account after choosing that case explicitly. It is not run by the
wizard or any shared command block. Role/admin permissions have the focused
`test:superadmin` cases; do not promote normal accounts to make a test pass.

### Legacy gateway smoke command: known limitations

```sh
SMOKE_BASE=https://localhost bash scripts/https-smoke.sh
```

This old script uses `curl -k`, a hard-coded `Origin: https://localhost` and the
default Compose context for its log check. It is not a general custom-origin/QA
project probe, and it does not prove certificate trust. It also currently rejects
any root-path `auth-refresh` Set-Cookie, although the repaired server deliberately
sends a root-path deletion cookie during migration. Treat that assertion as a
known stale check, not proof that canonical cookies regressed. Use the focused
gateway tests plus real cookie inspection/auth proof for current behavior.

## 8. Isolated fault testing, logs and database inspection

Do not stop shared services to test failures. To exercise stage 16, first build a
separate QA Compose project with separate volumes and normal QA accounts:

1. Create `.scratch/manual-game-testing/qa.env` from `.env.example`; fill fresh
   test-only DB/JWT/bootstrap/worker/SMTP values and set
   `AUTH_FRONTEND_URL=https://localhost:18443`, `DEV_PRINCIPAL=false`.
2. Copy `infra/nginx/nginx.conf` to `.scratch/manual-game-testing/nginx.qa.conf`.
   In that COPY, change the port-80 redirect to
   `return 301 https://$host:18443$request_uri;` and `/play` redirect to
   `return 301 $scheme://$http_host/play/;` so the alternate port is preserved.
3. Save this override at `.scratch/manual-game-testing/compose.qa.yml`:

```yaml
services:
  nginx:
    image: code-arena-manual-qa-gateway:local
    ports: !override
      - "127.0.0.1:18480:80"
      - "127.0.0.1:18443:443"
    volumes:
      - ./.scratch/manual-game-testing/nginx.qa.conf:/etc/nginx/nginx.conf:ro
```

The `!override` port tag needs Compose 2.24.4+ (this machine reports 5.6.0).
Base Compose resolves relative paths from the repository root. Existing
certificate mounts are reused for localhost only. Separate browser profiles avoid
cookie interference between localhost ports, because cookies do not isolate by
port. Start only after the QA env is complete:

```sh
qa_compose() {
  docker compose --project-name arena-manual-qa \
    --env-file .scratch/manual-game-testing/qa.env \
    -f docker-compose.yml -f .scratch/manual-game-testing/compose.qa.yml "$@"
}
qa_compose config --quiet
qa_compose up -d --build
qa_compose ps
```

Use `https://localhost:18443` in the wizard. The Compose project name separates
Game/account/Redis volumes; only Nginx's alternate host ports are published.
The gateway image has its own tag. Do not reuse another project's real data.

Before any fault command, require the expected project ownership:

```sh
qa_require_owned_game() {
  local qa_id
  qa_id="$(qa_compose ps -q game)"
  test -n "$qa_id" &&
    test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$qa_id")" = arena-manual-qa
}
qa_require_owned_game && qa_compose stop user-service
# Try a Game request/action; expect unavailable/503 while transport remains open.
qa_require_owned_game && qa_compose start user-service
# Use Try again; verify the same identity and retained code recover.
qa_require_owned_game && qa_compose restart game
# Verify persistence/reconnect against the same QA Game DB.
qa_require_owned_game && qa_compose stop judge-worker
# Run/Submit should report infrastructure failure; do not count a failed attempt as a score.
qa_require_owned_game && qa_compose start judge-worker
# With the first QA Game healthy, a duplicate must exit before recovery/listen:
qa_require_owned_game && qa_compose run --rm --no-deps game
```

The duplicate command is expected to exit nonzero. It must not start a standby or
replace the current owner. Ownership-loss deadline/fencing have dedicated
`runtime-live.test.ts`/`runtime-ownership.test.ts` cases; do not terminate an
arbitrary database session by guessing a PID.

Logs/read-only diagnostics:

```sh
qa_compose logs --tail 100 game
qa_compose logs --tail 100 user-service
qa_compose logs --tail 100 judge-worker
qa_compose logs --tail 100 nginx
qa_compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER"'
qa_compose exec -T user-db sh -c 'pg_isready -U "$POSTGRES_USER"'
qa_compose exec -T redis redis-cli ping  # PONG; not shared Match-authority proof
# Disposable test DB inspection, after its tests have initialized tables:
docker exec arena-manual-tests-pg psql -U postgres -d arena_game_test \
  -c 'SELECT count(*) FROM matches;'
docker exec arena-manual-tests-pg psql -U postgres -d arena_user_test \
  -c 'SELECT count(*) FROM "User";'
```

Review logs before sharing. Counts prove database reachability/content, not
correctness of a whole Match. For the default application stack, use its explicit
`--project-name ft-transcendence` for read-only logs, not the fault commands.

Reversible shutdown keeps volumes:

```sh
qa_compose down
# If you are finished with the separately created test-PG container:
docker stop arena-manual-tests-pg
```

No volume deletion or blanket Docker cleanup is required for this guide.

## 9. Human test stages

Use the actual UI, record each expected/actual result, and mark unavailable
provider/remote/fixture checks SKIP. Each stage is also available in the wizard.


### Stage 1: Target and four browser profiles

Estimate: 5-10 min.

1. Use a local test environment and disposable accounts. Start it using guide section 2.
2. Create independent browser profiles A, B, C and D. Tabs in one profile share the same login.
3. Open the test origin in each profile. Review any local certificate prompt yourself.

**Expected:** The intended test site opens in each independent profile; no production or real account is used.

### Stage 2: Register, login and invalid input

Estimate: 10 min.

1. In each profile, use Create account or log in to a disposable normal account.
2. Try missing fields, an invalid email and a wrong password; then use correct credentials.
3. Check Account identifies the expected user; click Play and return to Account.

**Expected:** Invalid input is rejected clearly. Correct login reaches Account and Play opens the live Lobby without a query user identity.

### Stage 3: Profile, photos and social controls

Estimate: 10-15 min.

1. In Account, change Display name and Save; reload and check it persists.
2. Test avatar/banner upload using a small valid image and a wrong file type.
3. In Friends & blocks, use another test user ID from People: request, accept, block and unblock; inspect lists.
4. On a separate disposable account, check wrong/current password validation. Keep passwords out of this report.

**Expected:** Saved profile data persists; invalid uploads are rejected; social actions affect only intended test accounts; password errors are clear.

### Stage 4: Private 1v1 Lobby admission

Estimate: 5 min.

1. A: Play, select 1v1, then Create 1v1 Room. B: enter the INVITE CODE and Join.
2. Try an invalid code, a third player in a full room and an unavailable side.
3. Before everyone is ready, check Start is unavailable. Click Ready Up for both players, then let the host start.

**Expected:** Only valid members join; capacity and side rules hold; the host starts only with full ready sides. Public queue commands are in guide section 7.

### Stage 5: Editor, languages and draft controls

Estimate: 5-10 min.

1. Click Start round. Confirm the same problem and a decreasing Match clock.
2. Select Python, C++ and C. Check starters, keyboard typing and the Larger font/Smaller font controls.
3. Choose one language; keep a distinctive draft marker for reconnect checks.

**Expected:** The editor works in each supported language; available actions match the phase. Do not assume language switches preserve separate drafts unless observed.

### Stage 6: Visible Run and error results

Estimate: 10 min.

1. Use a correct solution from guide section 4 and click Run; note visible results and unchanged score.
2. Try a wrong result, then a syntax/compiler error, then a runtime error.
3. On test data only, try a short infinite loop and wait for the execution limit.
4. Use a fresh Match or wait for limits if repeated Run is throttled.

**Expected:** Run uses visible examples only, never counts a submission or reveals hidden inputs, and reports code failures without breaking the Match.

### Stage 7: Submit, sealed results and score reveal

Estimate: 10 min.

1. A: submit a known solution. Observe waiting/sealed state before B submits.
2. Check browser Network responses and UI do not disclose opponent code or hidden test inputs/answers.
3. B: submit. Check the score reveal and expected score.
4. In a separate round, submit a wrong solution and inspect the result. Repeated submission is explicit, not automatic.

**Expected:** Scored results appear at Reveal; submitted attempts are stable; score follows the solution and hidden judging, not client-supplied values.

### Stage 8: Full Match, deadline and deliberate leave

Estimate: 10-35 min.

1. Finish all rounds with Next round and See final result; check totals and final outcome.
2. In a separate Match, let the normal 30-minute Match clock expire; check Reveal before final result.
3. In another disposable Match, choose Leave match and confirm only if you intend the forfeit.
4. Use the scoring/deadline automated cases for exact tie-break and cutoff races; do not alter server clocks for this manual run.

**Expected:** Round progression, final totals, deadline completion and deliberate leave are visible and consistent. The 1v1 disconnect-forfeit rule still needs team ratification.

### Stage 9: Four-player 2v2 Lobby

Estimate: 5-10 min.

1. Use four independent profiles and normal accounts. A creates a 2v2 private room; B/C/D join.
2. Fill both teams with two members. Try Start while a member is missing or unready.
3. Ready all four and let the host start the Match.

**Expected:** Exactly four intended players enter one Match with the correct two-player teams.

### Stage 10: Shared editing, language and revision readiness

Estimate: 10 min.

1. Within one team, type from both profiles and check convergence; the other team uses different text.
2. Change the team language and verify its teammate follows.
3. Ready both teammates, then edit again. Confirm stale readiness cannot submit the changed document.
4. Ready the current document and submit the team solution.

**Expected:** Only teammates share code/language; readiness is tied to current document revision; submitted code is the server-owned team document.

### Stage 11: Chat, quick pings and isolation

Estimate: 10 min.

1. Send a Team message and a Team quick ping. Check the teammate receives them once.
2. Check the opposing team does not receive the message, ping or source text.
3. Try an empty message and a message at the 500-character input limit.
4. After completion, check chat is closed/read-only; a separate 1v1 has no team-chat panel.

**Expected:** Team chat and code stay scoped to Match/team, duplicate sends do not appear unexpectedly, and completed/1v1 states follow their rules.

### Stage 12: Offline reconnect and hard reload

Estimate: 5-10 min.

1. Keep a distinctive draft and chat message. On one profile, DevTools > Network: switch No throttling to Offline.
2. Confirm actions pause; return to No throttling within the reconnect grace (default 90 seconds).
3. Check Match, timer, draft/shared document and chat; then hard reload.
4. For rejected shared-edit recovery, follow guide section 5 and inspect the manual recovery copy before deciding to reapply.

**Expected:** Fresh state restores the same Match without automatic command replay or loss of retained text. Longer 1v1 disconnects can forfeit.

### Stage 13: Natural 15-minute session expiry

Estimate: 16-18 min.

1. Use a fresh login and a fresh Match with at least 18 minutes remaining. Keep another account waiting in a separate Lobby; use a sixth guest for its later join.
2. Leave both idle for at least 15 minutes; do not click, reload or alter clocks.
3. In Network, observe disconnect/refresh/reconnect; check the same Match and code/chat remain.
4. Join the waiting room from another profile and check the host receives its passive membership update.

**Expected:** Normal expiry starts recovery automatically; fresh state arrives before commands resume. Exact slow-clock behavior also has a fixture-gated browser proof.

### Stage 14: Logout and account replacement

Estimate: 5-10 min.

1. Within ONE profile, open Account and Play in separate tabs; this deliberately shares a session.
2. Sign out from Account. Check the other tab leaves the old authenticated scope; reload remains signed out.
3. Log in as another test account and check the old Match URL/editor is retired.

**Expected:** Tabs agree on identity; an old request cannot restore the previous user or keep the old Match editable.

### Stage 15: Failed logout and no automatic replay

Estimate: 5-10 min.

1. On a disposable login, use DevTools request blocking for */api/auth/logout (guide section 5).
2. Click Sign out, then reload Account and enter Play while logout is still blocked.
3. Check the signed-out intent persists. Remove the block; make a deliberate new login.
4. When inspecting retry cases, check Network shows no automatic second POST for a mutation.

**Expected:** Failed server logout does not silently sign the browser back in; deliberate login can proceed; mutations are not automatically resent.

### Stage 16: Auth outage, Game restart and recovery

Estimate: 10-20 min.

1. Use ONLY the separately named QA Compose project from guide section 8; otherwise mark SKIP.
2. Stop its User Service, try a Game action, then restart that same service.
3. Check unavailable versus signed-out UI, retained code, and Try again.
4. Restart only the QA Game and check persisted Match state. Use the automated ownership test for duplicate owners/loss; do not launch a second owner on real data.

**Expected:** Outage is unavailable/503 where transport stays open; recovery retains state. Accepted work is not blindly replayed. Persistence tests require a database-backed QA stack.

### Stage 17: Layout, keyboard and accessibility

Estimate: 10 min.

1. Check normal desktop plus widths 1024, 768 and 320 in DevTools Device Mode.
2. Use Tab/Shift+Tab, Enter and Space; inspect focus and labels for forms, editor and buttons.
3. Check long problem text/chat, font controls, errors and disabled actions.
4. Check Console on a clean happy path; distinguish deliberately injected network errors from unexpected exceptions.

**Expected:** Controls remain usable and readable, focus is visible, content is reachable and no unexpected page exception occurs. This is a manual check, not a full accessibility certification.

### Stage 18: Separate-computer play

Estimate: 10-20 min.

1. Use a second computer and an explicitly configured reachable test origin. localhost refers to each computer separately.
2. Play 1v1, then four-client 2v2 where available; verify synchronized actions and isolation.
3. Briefly disconnect one client and reconnect; record the actual origin and observed latency behavior.

**Expected:** Real remote clients reach the same server and preserve the expected game behavior. Local-only success does not prove this stage.

### Stage 19: Live OAuth and email (optional)

Estimate: 10-20 min per provider.

1. If real providers/SMTP are not configured, record SKIP with the missing prerequisite.
2. From login, use GitHub/Discord; from Account > Connected accounts, test linking and allowed unlinking.
3. Use a disposable real inbox to test verification and password-reset delivery, links and invalid/reused token handling.
4. Enter provider credentials only in their intended browser/settings flow; never put passwords, tokens or mail links in the notes.

**Expected:** Actual provider login/linking and mail delivery work on the configured test origin. A local unit/proxy mock is not a live-provider pass.

### Stage 20: Review results and remaining coverage

Estimate: 5 min.

1. Read the result report path printed below. Check every observed failure includes steps, expected result and actual result.
2. Mark untested prerequisites as SKIP, not PASS. A partial --group run leaves other stages untested.
3. Use the command reference for API queue, security, concurrency, database, ownership and exact scoring races.
4. Keep reports local; share only reviewed nonsecret evidence.

**Expected:** The report distinguishes PASS, FAIL, SKIP and untested stages. Completing this wizard alone does not prove every automated or deployment requirement.


## 10. Coverage and remaining limits

Manual stages cover normal visible behavior. API commands cover boundaries and
public queue. Automated files cover races, retries, duplicate IDs, cutoffs,
sealing and runtime fencing that are hard to trigger by hand. Real OAuth/SMTP,
remote-computer play, public certificate trust and final team acceptance still
need their own environment and observations.

Known command traps at this checkpoint:

1. `npm run play` uses production preview; use the DEV Vite procedure for dev identities.
2. `collab-reconnect.spec.ts` kills fixed port 3220; isolate it.
3. `scripts/https-smoke.sh` has stale root-cookie handling and fixed-origin/project assumptions.
4. Real HTTPS automation requires the removed/private owned fixture to be recreated; missing fixture is a SKIP, not a pass.
5. User Service's generic Vitest scripts currently find no `.spec.ts` files; use the actual Node `.test.mjs` suites.

These are documented limitations, not silently fixed application/test behavior.
No runtime suites or services were started to author this kit. Current commands
were checked against package scripts, source fixtures, installed CLI help and
shell syntax; execution results must be recorded separately.

Sources: [runbook](game-local-run.md), [auth evidence](auth-integration-repair-evidence.md),
[package interfaces](../packages/README.md), `frontend/e2e/`, Game/engine tests,
and each workspace's `package.json`. Chrome manual instructions use the official
[profiles](https://support.google.com/chrome/answer/2364824),
[Network](https://developer.chrome.com/docs/devtools/network/reference) and
[request conditions](https://developer.chrome.com/docs/devtools/request-conditions)
documentation, checked 2026-10-15.
