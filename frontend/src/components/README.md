# Arena components

Documented 2026-10-27 from Aimane source `67fc6b0`; this is a bounded source review, not a passing test report.

## Overview

React components compose the Lobby, Match view, editor, and gameplay controls. They translate the current client snapshot and connection state into available actions; Game remains authoritative for gameplay decisions.

## Interface

- [`ArenaPage`](./ArenaPage.tsx) composes an `ArenaTransport` with authentication signals and Match screens.
- [`ArenaWorkspace`](./ArenaWorkspace.tsx) and [`CodeWorkspace`](./CodeWorkspace.tsx) compose the coding workspace and controlled editor flow.
- [`EditorAdapter`](./EditorAdapter.tsx) hosts CodeMirror and optional shared-document editing.
- [`LobbyPage`](./LobbyPage.tsx) takes a `LobbyClient`, `userId`, `onMatchFound`, and mode to drive Lobby interactions.
- Supporting components render problem, Team, chat, execution, readiness, reveal, and final-result views. The bounded review does not certify every supporting component's implementation.

`EditorAdapterProps` selects language, `code`, read-only state, font size and
`onChange`, with optional `collab`. Local mode is controlled by `code` and
`onChange`. Collaborative mode reads the shared Y.Text, ignores `code` for
content, and still calls `onChange` with converged text. The imperative
`EditorAdapterHandle` exposes `focus`, `getSelection` and `setSelection` using
`EditorSelection` anchor/head offsets. Remount the editor when replacing its
collaboration binding; the CodeWorkspace key supplies that lifetime boundary.

## Invariants

- Editing requires the Coding phase and a player who can code. Shared editing additionally requires a live collaboration client and no recovery copy; a local draft may remain editable offline.
- Run and Submit require a connected, idle, synchronized state. In 2v2, Submit also requires teammate approvals for the current shared revision.
- Readiness is revision bound; editing must not preserve approval of an older document.
- ScoreReveal renders the reveal/advance path. A terminal state without a reveal renders the saved final result; a deadline with a reveal shows that reveal before the final result.
- Leaving a Match is an explicit confirmed command. Socket disconnection is a separate lifecycle event.
- Local draft scopes include transport, Round, problem, and language. A shared document replaces local draft restoration and persistence for that editor path.

## Side Effects

- React and CodeMirror lifecycles create editor state and subscriptions, with event cleanup in sampled paths.
- Local drafts use `localStorage`; collaborative views use sidecar clients and their network state.
- User actions issue client commands and can trigger clipboard access or confirmation prompts.

## Verification

From the repository root with Node 22, after `npm ci` and `npm run build:packages`:

```sh
npm test --workspace arena-frontend
npm run typecheck --workspace arena-frontend
```

The unit target excludes `e2e`. Select the browser fixture, server, and relevant cases using [manual game testing](../../../docs/manual-game-testing.md); browser coverage is a separate result.

The scout read 49,912 bytes across seven files, with at most 300 lines per file. `ArenaPage.tsx` and `LobbyPage.tsx` were partial; ten files, including `MatchResult.tsx`, `TeamChat.tsx`, and `ReadyState.tsx`, were unreviewed. Complete supporting-component and cleanup behavior is outside this sample. No runtime tests were run for this documentation.
