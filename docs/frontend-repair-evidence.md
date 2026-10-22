# Frontend repair evidence — 2026-10-22

Verified source: `97e7492` on Aimane. This record covers the two frontend
repairs after the [starter/transport rollout](starter-execution-repair-evidence.md).
It does not replace the dated [auth proof](auth-integration-repair-evidence.md).

## Shared editor status

Commit `fdb0703` keeps connection warnings stable while a shared edit waits for
its acknowledgement. Run, Submit and Readiness still wait for the saved document
and Match snapshot to agree. A real connection failure still pauses commands
and keeps the draft. The workspace regression checks these states. This does
not complete the separate human review of four-player layout and typing.

## Forfeit result without a Round Reveal

Commit `97e7492` fixes a terminal Match that had no current Round Reveal. The
Arena now renders the saved final outcome directly:

- Leaving player: **Opponent wins by forfeit. You forfeited.**
- Other player: **You win by forfeit. Opponent left the match.**

The server outcome takes precedence over saved scores. Grace-expiry forfeits
do not claim that the player deliberately left. The screen does not invent a
Reveal or a completed-Round count. Existing normal results and the deadline's
Reveal-before-final flow stay intact. No backend rule, deadline, Next Round
policy, authentication or runtime ownership change is included.

The agreed regression boundary was Game snapshot → real frontend transport and
adapter → rendered Arena page. External HTTP/Socket.IO were test doubles. Two
initial cases failed on the missing result before the fix. All six focused
cases then passed: both player perspectives, positive/zero Match clock, and
grace-expiry wording. The independent scoped review reported **Standards: 0;
Spec: 0**. The reviewer did not claim live delivery from these regressions.

## Full verification at the source commit

One fresh root run passed **811 tests, zero skipped**:

| Suite | Passed |
| --- | ---: |
| Game engine | 373 |
| Lifecycle harness | 19 |
| Shared model | 68 |
| Browser auth | 48 |
| Game service | 141 |
| Judge worker | 28 |
| Arena frontend | 132 |
| Example | 2 |
| **Total** | **811** |

The run used Node 22, real Docker execution and a separate, labelled,
loopback-only tmpfs PostgreSQL fixture. Both `TEST_PG_URL` and `DATABASE_URL`
selected that disposable database; `ARENA_DIAGNOSIS_DOCKER=1` enabled container
timeout cleanup coverage. The fixture was removed after the run. Application
accounts, databases and volumes were preserved. Reproduction commands and
fixture setup are in the [manual test guide](manual-game-testing.md#disposable-postgresql-fixtures).

`npm run check`, `npm run build`, frontend lint and whitespace checks passed.
The root suite excludes standalone Account/User Service and browser journeys;
their earlier dated results remain in the auth record.

## Installed local gateway and live browser proof

Only the local Nginx gateway was rebuilt and recreated from `97e7492`. Its
configuration passed before replacement. The other seven local containers,
mounts, Account static entry and settings file were preserved. `/login` and
`/play/` returned HTTPS 200 with independent certificate validation; Game and
Judge readiness passed. No application database or existing Match was deleted.

A later successful check used two isolated Chromium browser contexts, real
password UI, Account Play, a fresh private 1v1 Lobby, Game HTTP and Socket.IO.
There were no principal/profile/Match mocks, dev identity, clock overrides or
service restarts. Both players reached Coding before any Submission or Reveal.
When one selected **Leave match**:

- Both screens showed the correct winner and departure message without reload.
- Real snapshots had `reveal=null` and the correct forfeit winner, loser and reason.
- Editors, Run, Submit and Next Round were absent.
- Reloading both browsers preserved the same final result.
- No browser JavaScript errors were observed.

The server certificate and hostname were validated independently using the
repository public certificate. The automation browsers did not trust that local
self-signed certificate, so the temporary Chromium contexts used
`ignoreHTTPSErrors: true`, restricted to `https://localhost`. No global trust or
browser profile setting changed. This proves the focused UI/live result, not
browser certificate trust, Safari coverage or a public certificate deployment.
The earlier 2026-10-20 network proofs used strict CA validation without this
browser exception; their boundary is recorded separately.

Two earlier harness attempts stopped on assumptions about the Leave transport
and snapshot route. The corrected harness used the actual socket/UI completion
and supported snapshot routes; the final run passed without another product
change. Temporary browser sessions were logged out and closed. Local reports
and screenshots stay in ignored test storage; credentials and session traces
are excluded from this public record.

## Remaining work and review limits

1. Resume the human four-player pass with a fresh 2v2 Match: layout, shared
   typing, Readiness, Team chat isolation, full Match and result reload. The
   network proof above does not complete this browser acceptance.
2. Finish the manual recovery/session/account/failure/social and final checks.
3. Agree team integration and progression/disconnect rules; compare teammate
   branches before importing them. Team chat and platform Direct Messages have
   separate ownership.
4. Prove the final team build from a clean clone and separate computers; finish
   accessibility, policy/contribution/database/AI-use records and module sign-off.
5. Prove live OAuth, external SMTP and the approved public HTTPS deployment.

The backend and accepted-evaluation/auth expiry behavior were unchanged by
these frontend repairs. Existing Game/auth tests and prior reviews cover them;
this record does not add a new real expiry/evaluation race proof. Multiple
active Game owners are outside the approved release model. No merge into main,
public deployment or 42 module award is claimed.
