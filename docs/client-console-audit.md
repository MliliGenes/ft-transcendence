# Client console cleanup

The requirement is treated as a clean console during normal supported use:
no application logging, avoidable warnings, or unhandled action failures.
Caught request errors remain part of the API contract. Removing those errors
would make failed operations look successful. Browser network diagnostics and
React/Next crash reports remain enabled.

## Scope and changes

The audit covered 125 application source files under `client/app`,
`client/components`, `client/hooks`, and `client/lib`, starting with the error
pages, plus client configuration and the original 19 test files.

- Removed five console calls across the root/app error pages, arena workspace,
  and snapshot transport. Error fallback UI, references, and Next 16.4.2 `retry`
  callbacks remain intact.
- Arena actions catch failures at the UI boundary, show safe feedback (including
  introduction/reveal overlays), retain drafts, and release controls in `finally`.
  The workspace pending action is a closed set of names (`ArenaPendingAction`)
  rather than a free-form string. Every pending arena action keeps its label
  while the request runs, is marked `aria-busy`, and shows a quiet progress
  indicator; the progress is announced in a `role="status"` region — in the
  editor toolbar for the toolbar and header actions, and inside the overlay
  itself for the two actions that run behind an overlay (Begin Coding and
  advancing to the next round). Background synchronization publishes
  `ArenaSnapshot.notice`, retains the last snapshot, and clears the notice after a
  successful synchronization. Request spacing, coalescing, retries, and conflict
  handling remain intact.
- Match header and editor controls wrap within their available width. The progress
  region has its own row so it remains readable when the editor pane is narrow.
- Lobby actions show a separate inline error without replacing the lobby.
  An in-progress lobby action is announced in a `role="status"` region and the
  in-flight control is marked `aria-busy` with a quiet progress indicator, so a
  running action is distinct from an unavailable one while its label stays
  unchanged. Clipboard success appears only after the write completes; denied or
  absent clipboard access offers manual copying. A failed leave keeps the lobby
  open.
- Optional OAuth/password-reset storage cannot interrupt navigation or login.
  No credentials were added to storage or feedback.
- Converted 39 link-rendering buttons to native links styled with the existing
  `buttonVariants` and `cn` utilities, preserving destinations and OAuth handlers.
- ESLint rejects console use in application directories; tests/tooling are exempt.
  No global error suppression, console replacement, or HTTP-status changes were added.
- Preserved the pre-existing edit in `auth-form.tsx`. No dependencies, lockfile,
  backend APIs, migrations, or logging service were changed.

## Verification

| Check                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency restore                             | The original audit used `npm ci` with the existing lockfile. The combined integration candidate reused local dependencies; its lockfile is unchanged.                                                                                                                                                                                                                                                                                                                                                                            |
| Lint                                           | `npm run lint` passed; an isolated lint probe also confirmed application console calls fail and test output remains exempt.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Types                                          | `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tests                                          | `npm test`: 95 passed, zero failed. The action tests were rerun after the final overlay adjustment; the lobby pending-state, arena pending-label and arena pending-action progress regression tests were added during review. Four Feed carousel checks also cover native video keys, motion preferences, and persistent endpoint controls. A public snapshot regression covers authoritative tie-break winners.                                                                                                                 |
| Production build                               | `npm run build` passed after granting network access for the existing Google Fonts.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Production HTTP rendering                      | 14 routes returned HTML with status 200; a missing route returned the custom 404. OAuth renders as a native link.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Development HTTP rendering                     | The same 14 routes and custom 404 passed against `next dev`. Both temporary local servers were stopped afterward.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Browser UI with fabricated APIs (2026-11-13)   | Lobby readiness and Match Run show pending feedback, retain labels, show failure feedback, and restore controls. Captured console empty. After the layout repair, all Match buttons and selectors fit a 1,076-pixel viewport and progress text remains visible.                                                                                                                                                                                                                                                                  |
| Live browser checks through Nginx (2026-11-13) | A real two-player 1v1 completed all three rounds with complementary final results (300–225). Reload during round-two reveal restored phase and totals. C++ snippets failed with HTTP 500 before the follow-up fix below; Python passed. Feed attachment upload was blocked by the browser before reaching storage. A fresh completed-match view selects Python after the fix; a full post-fix gameplay run used real HTTP. Chrome Feed upload, next/previous navigation and reload persistence passed with two synthetic images. |

HTTP rendering checks do not execute browser JavaScript. Authenticated flows,
manual video uploads, assistive-technology behavior, full post-fix browser gameplay, actual 2v2 sessions, and offline/denied/conflict/rate-limit
behavior through Nginx still need live browser verification. Unit checks cover
action rejections, retained drafts/state, pending-control recovery, pending label
stability and progress announcement, clipboard availability/denial, blocked
storage, and snapshot notices/recovery.

The test runner still emits Node's existing `MODULE_TYPELESS_PACKAGE_JSON`
warning for `lib/social/client.ts`; this is terminal output, not browser output.

## Remaining conditional console sources

These are follow-up findings from static analysis, not reproduced browser failures.

| Source                                                                                                                                                                                                                                                                                  | Potential effect                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Collaboration decoding](../client/lib/arena/collab.ts)                                                                                                                                                                                                                                 | Malformed Base64/Yjs payloads can throw from socket callbacks.                                                                                                                                        |
| [Profile](../client/components/app/public-profile.tsx), [chat](../client/components/app/chat/message-list.tsx), [details](../client/components/app/chat/details-panel.tsx), [feed](../client/components/app/feed/post-card.tsx), [groups](../client/components/app/chat/group-home.tsx) | Invalid API date strings can throw `RangeError` during formatting.                                                                                                                                    |
| [Sidebar skeleton](../client/components/ui/sidebar.tsx)                                                                                                                                                                                                                                 | Random initial width can cause hydration mismatch if used with server rendering; currently no callers.                                                                                                |
| [Match transport](../client/components/arena/MatchView.tsx)                                                                                                                                                                                                                             | Transport creation during render needs a separate lifecycle review; abandoned connections may keep reconnecting.                                                                                      |
| Browser/framework                                                                                                                                                                                                                                                                       | Failed HTTP requests (including expected unauthenticated responses), WebSockets, images, CORS/TLS checks, and genuine React/Next crashes can still produce diagnostics even when promises are caught. |

## Follow-up: executable language choices

The live run reproduced a separate game error: Even Ledger advertises C/C++
starters, but all current judge adapters execute snippet problems through a Python
harness. The Match page defaulted to C++, and submitting it produced an internal
judge failure. The fix filters the public snippet starters to Python, renders the
selector from that list, and selects an available language when a 1v1 round changes.
Complete-program (stdio) problems retain C++, Python and C. Run, Submit and team
language changes reject unsupported problem/language pairs before judge dispatch.
Input validation now carries the HTTP filter's 400 classification, so it produces
a useful client response instead of falling through to 500. This follow-up changes
validation status handling; the earlier console-only audit's no-status-change claim
does not describe this later repair.

Four public engine regressions cover advertised starters, unsupported Run/Submit
without competitive side effects, stdio choices, and team round/language behavior.
Existing collaboration language-switch and transaction-rollback tests now use a
valid stdio fixture, preserving their original assertions. The 94 client tests,
root type checks, root lint, frontend production build and both review axes pass.
All 112 disposable database/service integration checks pass (60 engine, 15 Game
and reconnect, 20 Chat, 17 User). Root workspace tests passed apart from missing
local example env fixtures in Compose topology tests; after supplying ignored
example-only files, all 15 judge-worker tests passed, including those three checks.

A real authenticated HTTP match on the rebuilt disposable stack also completed
all three rounds. Its snippet snapshot advertised only Python; unsupported C++
Run and Submit each returned HTTP 400 with the availability message and no
competitive attempt. Python hidden submissions passed and the match finalized.
This is real service evidence, not a browser replay.

Chrome/Orca control connections stalled during the post-fix browser attempt. The
user observed ERR_BLOCKED_BY_CLIENT for the upload. Direct trusted storage TLS and
CORS checks pass; the exact client blocking rule is not established, and no CORS or
certificate controls have been weakened. Real two-image Feed upload/carousel verification later passed in Chrome Guest,
including next/previous navigation and reload persistence; see
[original-size evidence](evidence/feed-carousel-live/README.md). A fresh completed
match view also selected Python. This is not a full browser replay of the post-fix
gameplay, which was covered through authenticated HTTP.

## Follow-up: authoritative tie-break winner

That fresh match view exposed a second confirmed issue: real HTTP reported left
as winner at125–125, but the Beta view displayed a draw. `adaptFinal` had compared
totals instead of using the authoritative winner. The repair preserves the server
winner for both viewers and treats null winner as a genuine draw; existing forfeit
handling is unchanged. The public snapshot regression was observed failing before
the fix. All95client tests, client lint, production build/TypeScript and both
scoped reviews pass. See [before/after evidence](evidence/arena-tiebreak-live/README.md).

The rebuilt frontend was then checked against the same real match in Chrome: the
Beta view now says Opponent wins the match at125–125, matching serverwinnerleft.
The corrected image and the earlier wrong draw image are saved at original
3456×2166 resolution. The user-selected Feed upload and persisted carousel were
also visually verified in this session; both scoped live follow-ups are complete.

## Follow-up: forbidden match synchronization

On 2026-11-14, browser QA found repeated snapshot HTTP 403 responses when opening
a match the viewer could not access. The transport treated access denial as a
temporary failure and displayed “Retrying automatically.”

A forbidden snapshot now disconnects that match transport, cancels background
refreshes, and displays “Access denied. You cannot access this match.” Queued
snapshot reads, late socket events, and token renewal cannot restart its requests.
This state belongs to the current match transport; it does not expire the user's
Nook session. Server authorization and HTTP response statuses remain intact.
Transient network/503 failures still retry and recover; 401 retains its sign-in
notice.

The regression failed before the repair and passed afterward. The complete client
suite passed (117 tests), as did client lint, TypeScript checking and whitespace
checks. The production build also passed. Only the local QA client was rebuilt
and recreated, running image
`sha256:c59687cc4c80ea8beb55765f08fe770af17055a89c79a6644f18777f9503f2e2`;
all backend container identities remained unchanged.

In the existing synthetic QA browser profile, the forbidden-match page displayed
the access-denied alert. Its current document recorded one snapshot request over
75 seconds, with no repeated polling. The browser's cumulative network log held
two 403 responses across navigations, with no increase between captures; these
are not two requests by the final document. The saved console capture was empty.
Navigating afterward to the viewer's completed 2v2 match loaded its 300–300 final
result, confirming that the denial did not end the Nook session. This verifies the
current client against the existing QA backends, not a public deployment or a
full browser replay of gameplay.
