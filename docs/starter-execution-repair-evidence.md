# Starter execution repair — 2026-10-19

## Result and scope

The unchanged Even Ledger editor starters now execute as advertised: Python
`Solution.ledger_sum`, C `ledgerSum(long long*, int)`, and C++
`Solution::ledgerSum(const vector<long long>&)`. Starter Run results are
`false, false, true` with outputs `0, 0, 0`; these are normal wrong answers,
not execution failures. Correct implementations pass the visible examples
and earn 100/100 on sealed Submit. Double It remains a complete stdin/stdout
program. The manual guide contains working examples for all three languages.

Baseline: `fb63d346f7010c17280cfac386f94f18a21431ac` on `Aimane`.
This evidence covers the source repair and the user-approved local Compose
rollout recorded below. Browser UI and remote deployment are not claimed.
Database, account, Redis, gateway and mail container identities were preserved.

## Cause and repair

The Python container driver originally discovered module-level functions only.
Game Run also omitted the bank entrypoint, and the worker visible endpoint did
not carry that metadata. Compiled snippet drivers were rejected before execution,
although the bank advertised C and C++ snippet starters.

The repair supports Python Solution methods while retaining free functions.
Game Run, fresh Submit and pending evaluation recovery resolve the bank's
language-specific snippet declaration. Worker visible and sealed endpoints
preserve and validate that declaration. Even Ledger declares the C/C++
`int64-array` ABI, function name, and C++ class name explicitly; the judge does
not infer them from contestant source. Optional Judge0 requests reuse the same
compiled harness. Explicit Python entrypoints prefer a callable module function,
then fall back to the Solution method, consistently across adapters.

The compiled harness parses a single integer-array assignment without host
execution, preserves signed 64-bit integers, and accepts at most 100000 elements.
It sends only the current case through stdin. Expected answers and other cases
remain in trusted memory. Original submission source, hashes, counting,
persistence and recovery identities are unchanged. Existing one-shot container
limits, output capture and host-timeout cleanup remain in force.

## Test-first evidence

The user confirmed two test seams: public Game Run/Submit with the actual bank
and isolated Docker execution, and Game-to-Judge HTTP. Browser/certificate
checks were explicitly excluded.

| Regression | Observed RED | GREEN after repair |
| --- | --- | --- |
| Actual Python starter | Three false results instead of empty-array pass | Outputs 0/0/0; false/false/true |
| Python Solution with helper | Three false results when bank entrypoint was omitted | All visible cases pass |
| Same Python program through real worker HTTP | runtime_error on every case | Accepted, all visible cases pass |
| Actual C starter | Rejected before execution; empty-array case failed | Outputs 0/0/0; false/false/true |
| Correct C Run + Submit | Submit lacked compiled ABI configuration | Visible cases pass, sealed score100 |
| Actual C++ starter and completed Solution | Unsupported compiled configuration | Starter runs; solution passes, sealed score100 |
| C++ through real worker HTTP | HTTP503 because ABI metadata was dropped | Starter runs and sealed results pass without input/expected fields |
| Optional Judge0 Python metadata | Three false visible results | Run and Submit pass |
| Optional Judge0 compiled metadata | Unsupported snippet driver | C++ Run and Submit pass |
| Free Python function plus unrelated Solution class | Container passes; Judge0 fails all examples | Both providers Run/Submit pass, score100 |

Additional coverage checks bounded nonterminating Solution construction followed
by a successful Run, and HTTP400 for malformed entry/class identifiers.
The original Python/C source-and-case reproduction is retained locally; its
updated invocation supplies the same bank ABI declaration as Game.

## Verification

- Full root `npm test`: **794 passed**, no skipped cases, with owned PostgreSQL
  fixture, both database variables set, and `ARENA_DIAGNOSIS_DOCKER=1`.
- The final provider-precedence correction adds two public Game cases after
  that root run. Final complete Game suite: **368/368 passed**, zero skips,
  including all 14 real-bank starter/provider regression cases (89.00s).
- Final worker starter/metadata suite, using the built public package entrypoint:
  **3/3 passed** (7.31s); full worker suite in the root run: **25/25 passed**.
- Across the root run and the final two added cases, **796 distinct root-suite
  cases passed**. This is a combined distinct-case count, not one invocation.
- `npm run check`: passed (repository links, package boundaries, all workspace
  typechecks, frontend lint and example tests).
- `npm run build`: passed (packages, Game, worker and production frontend).
- `git diff --check`: passed.
- Original Python/C starter reproduction, updated only to supply the bank ABI
  metadata now used by Game: passed. Both produce accepted execution verdicts,
  outputs 0/0/0, and false/false/true example results.
- Independent repair review and scoped follow-up: no remaining Critical,
  Important or Minor findings.

Reproducible commands, from the repository root with Node22 and Docker:

```sh
rtk proxy npm run build:packages
rtk proxy npm test --workspace arena-game-engine -- test/compiled-bank.test.ts
rtk proxy npm test --workspace arena-judge-worker -- test/starter-execution.test.ts
rtk proxy npm run check
rtk proxy npm run build
```

The full database-backed run additionally set `TEST_PG_URL` and `DATABASE_URL`
to a new loopback-only disposable test database, never the application database.
The owned container was `arena-starter-tests-pg-20261019`, with a tmpfs data
folder and no persistent volume. This fixture is removed after verification.
Do not aim these destructive fixture tests at a database with valuable data.

## Independent review and explicit limits

An independent read-only review covered the repair source/tests, metadata schema,
and manual-guide addition. It found no Critical/Important issues and one Minor
provider-precedence mismatch. That mismatch received its own RED→GREEN cycle
and a scoped follow-up review: no remaining Critical, Important or Minor findings.

Rulings on items the reviewer did not execute or judge:

- Missing required compiled ABI configuration is an infrastructure failure
  (HTTP503), not a competitive attempt; malformed metadata syntax is HTTP400.
  This is intentional: only trusted bank/worker callers supply ABI metadata.
  A misconfigured new bank therefore stays unavailable until its declaration
  is corrected; the judge does not guess an ABI or silently score it zero.
- Judge0 compatibility is proven with a local protocol fixture that runs the
  generated programs in actual isolated Docker containers. No live Judge0
  deployment, remote quotas or provider configuration was exercised.
- The parser was checked at 10000, 50000 and 100000 elements in review. Full
  100000-element transport/execution was not exercised. Existing Docker
  environment-variable transport can impose a smaller practical byte limit;
  this repair does not claim maximum-size end-to-end capacity.
- The reviewer did not duplicate the expensive execution suites. The executor
  ran the recorded Docker, database, root and focused regression commands.
- Browser UI and browser certificate trust were outside the agreed test seams.
  The user subsequently approved a controlled local Game/Judge rebuild. The
  live HTTPS network proof below validates that rollout; it is not browser UI
  proof. Existing account/database/mail containers and volumes were retained.

No external OAuth/email delivery, separate-computer UI or new four-browser
proof is claimed by this repair. Earlier four-player network proof remains a
separate result; this document does not relabel it as browser proof.

## Applied to the local running game — 2026-10-19

The user approved applying the verified repair after review and verification.
Only Game and Judge worker were rebuilt and recreated, retaining the existing
local mail Compose override. The worker became healthy before Game was replaced.
Nginx passed its configuration test and received a graceful reload to refresh
backend addresses; its container was not recreated.

Before/after container and mount identities confirm:

- Exactly Game and Judge worker container IDs changed.
- Both databases, Redis, User Service, Nginx and Mailpit kept their container IDs.
- All mount/volume identities were retained. All service health checks passed.
- `DEV_PRINCIPAL=false` remains enforced.

Certificate-validated HTTPS smoke proof used two existing owned normal QA
accounts through password login, a private 1v1 Lobby, the production Game API,
real worker HTTP, and one-shot Docker execution. **12 checks passed**:
all three unchanged Even Ledger starters ran with outputs 0/0/0 and the
empty-array pass; correct Python/C/C++ snippets passed all visible examples;
C and C++ sealed submissions earned 100/100 in round1; stdio submissions earned
100/100 in Double It; Python Solution methods earned 100/100 in round3. Both
clients recovered the completed three-round 300–300 scores. No browser UI,
certificate bypass, mock principal/profile, dev identity or hidden-suite
inspection was used in this live proof.

The local report and scripts are retained in the ignored repair workspace.
Build-time npm audit reported four development dependency advisories; production
`npm ci --omit=dev` reported zero. No dependency updates or audit auto-fixes were
part of this starter repair.

A fresh **16/16-check four-player 2v2 network proof** also passed on the rebuilt
stack using the four existing owned normal QA accounts. It covered authenticated
private Lobby formation, the missing-player start gate, shared code convergence
and opposing-team isolation, isolated chat/pings, readiness invalidation and stale
approval rejection, reconnect with preserved code/chat, visible Judge execution,
all three sealed rounds at 100/100 for both teams, and fresh authenticated socket
recovery of the same final 300–300 scores and outcome. Equal totals are not
reported as a draw: the normal tie-break policy still applies. These were real
HTTPS/WSS network clients, not four browser windows or separate computers.
