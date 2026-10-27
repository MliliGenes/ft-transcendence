# Arena application source

Documented 2026-10-27 from Aimane source `67fc6b0`; this is a bounded source review, not a passing test report.

## Overview

The React entry point selects the Arena's authenticated application path or explicit development live/mock modes, then composes the Lobby and Match experience. Normal play follows Account's Play link and uses the real authenticated profile.

## Interface

- [`main.tsx`](./main.tsx) mounts [`App`](./App.tsx) inside React `StrictMode`; [`index.css`](./index.css) supplies application styling.
- [`arena`](./arena/README.md) contains client state contracts, Lobby/session coordination, Team chat, collaboration, React subscriptions, and development fixtures.
- [`components`](./components/README.md) composes Arena/Lobby screens, the editor, and guarded gameplay controls.
- Workspace package imports must use supported public entry points; deeper package source folders are private under the repository's package boundary rules.

`VITE_API_URL`, trimmed or the current origin when empty, selects the identity
API base. `VITE_GAME_URL`, trimmed or the current origin when empty, selects the
Game HTTP/socket base. Set these to bases supported by the gateway routes.
Development live query identity is restricted to the DEV fixture; it is not
an alternative production sign-in method.

## Invariants

- The real profile supplies production identity. Query identity and mock transports are development fixtures rather than the normal Account Play path.
- A session generation or account replacement retires old clients and Match scope. A token revision within the same session triggers renewal.
- The sampled authentication and connection effects guard against stale completions and dispose their owned resources on cleanup; this does not certify all omitted client paths.
- Child clients and components must preserve authoritative server state, session scope, revision readiness, and explicit command semantics described in their contracts.

## Side Effects

- React mounts and updates the DOM; application effects create HTTP/socket clients and update browser history and debug references.
- Shared browser authentication requires `BroadcastChannel` and Web Locks
  (`navigator.locks`); App constructs the channel/client during setup.
- Child modules manage browser storage, collaboration state, editor lifecycles, and network commands as documented in their contracts.

## Verification

From the repository root with Node 22, after `npm ci` and `npm run build:packages`:

```sh
npm test --workspace arena-frontend
npm run typecheck --workspace arena-frontend
```

The unit target excludes `e2e`. Browser checks require explicit fixture and server selection from [manual game testing](../../docs/manual-game-testing.md).

App URL/browser prerequisites and the child transport/recovery contracts were
expanded after static review. Supporting-component coverage remains bounded
as recorded below. No runtime authentication, expiry or cleanup tests were run
for this documentation.
