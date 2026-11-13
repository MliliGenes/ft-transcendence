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
  Background synchronization publishes `ArenaSnapshot.notice`, retains the last
  snapshot, and clears the notice after a successful synchronization. Request
  spacing, coalescing, retries, and conflict handling remain intact.
- Lobby actions show a separate inline error without replacing the lobby.
  Clipboard success appears only after the write completes; denied or absent
  clipboard access offers manual copying. A failed leave keeps the lobby open.
- Optional OAuth/password-reset storage cannot interrupt navigation or login.
  No credentials were added to storage or feedback.
- Converted 39 link-rendering buttons to native links styled with the existing
  `buttonVariants` and `cn` utilities, preserving destinations and OAuth handlers.
- ESLint rejects console use in application directories; tests/tooling are exempt.
  No global error suppression, console replacement, or HTTP-status changes were added.
- Preserved the pre-existing edit in `auth-form.tsx`. No dependencies, lockfile,
  backend APIs, migrations, or logging service were changed.

## Verification

| Check | Result |
| --- | --- |
| Dependency restore | `npm ci --no-audit --no-fund --offline=false` passed using the existing lockfile. |
| Lint | `npm run lint` passed; an isolated lint probe also confirmed application console calls fail and test output remains exempt. |
| Types | `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed. |
| Tests | `npm test`: 79 passed, zero failed. The action tests were rerun after the final overlay adjustment. |
| Production build | `npm run build` passed after granting network access for the existing Google Fonts. |
| Production HTTP rendering | 14 routes returned HTML with status 200; a missing route returned the custom 404. OAuth renders as a native link. |
| Development HTTP rendering | The same 14 routes and custom 404 passed against `next dev`. Both temporary local servers were stopped afterward. |
| Live browser checks through Nginx | Unverified: Computer Use reported both browser and native hosts unavailable. |

HTTP rendering checks do not execute browser JavaScript. Authenticated flows,
uploads, hydration, actual 1v1/2v2 sessions, and offline/denied/conflict/rate-limit
behavior through Nginx still need live browser verification. Unit checks cover
action rejections, retained drafts/state, pending-control recovery, clipboard
availability/denial, blocked storage, and snapshot notices/recovery.

The test runner still emits Node's existing `MODULE_TYPELESS_PACKAGE_JSON`
warning for `lib/social/client.ts`; this is terminal output, not browser output.

## Remaining conditional console sources

These are follow-up findings from static analysis, not reproduced browser failures.

| Source | Potential effect |
| --- | --- |
| [Collaboration decoding](../client/lib/arena/collab.ts) | Malformed Base64/Yjs payloads can throw from socket callbacks. |
| [Profile](../client/components/app/public-profile.tsx), [chat](../client/components/app/chat/message-list.tsx), [details](../client/components/app/chat/details-panel.tsx), [feed](../client/components/app/feed/post-card.tsx), [groups](../client/components/app/chat/group-home.tsx) | Invalid API date strings can throw `RangeError` during formatting. |
| [Sidebar skeleton](../client/components/ui/sidebar.tsx) | Random initial width can cause hydration mismatch if used with server rendering; currently no callers. |
| [Match transport](../client/components/arena/MatchView.tsx), [sidecar lifecycle](../client/components/arena/ArenaWorkspace.tsx) | Transport creation during render and missing sidecar disposal need a separate lifecycle review; abandoned connections may keep reconnecting. |
| Browser/framework | Failed HTTP requests (including expected unauthenticated responses), WebSockets, images, CORS/TLS checks, and genuine React/Next crashes can still produce diagnostics even when promises are caught. |
