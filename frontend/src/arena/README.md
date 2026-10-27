# Arena clients

Documented 2026-10-27 from Aimane source `67fc6b0`; this is a bounded source review, not a passing test report.

## Overview

Browser-side Arena and Lobby state, Team chat, collaborative editing, and React subscriptions live here. Server state supplies the authoritative gameplay view; explicit development fixtures provide mock behavior.

## Interface

- [`types.ts`](./types.ts) defines `ArenaSnapshot` and lifecycle/view contracts; [`useArena.ts`](./useArena.ts) owns the React subscription.
- [`TeamChatClient`](./chat.ts) handles messages, quick pings, and token renewal.
- [`CollabClient`](./collab.ts) manages Yjs document updates, awareness, acknowledgements, and recovery state.
- [`LobbyClient`](./lobby.ts) performs Lobby reads and commands; [`LobbySession`](./lobby-session.ts) coordinates the active Lobby view and socket hints.
- [`MockArenaTransport`](./mock.ts) and [`fixture.ts`](./fixture.ts) support explicit development scenarios. They do not establish production authentication behavior.

- [`ArenaTransport` and `TransportSession`](./transport.ts) define Match
  commands, snapshots, connection state and subscriptions.
  [`SocketArenaTransport`](./socket.ts) implements the production HTTP/socket
  path; [`sidecars.ts`](./sidecars.ts) owns collaboration and Team chat clients.

## Invariants

- Server snapshots are authoritative and revision ordered. Lobby hints and mutations converge through `getActive`, with stale-result and lifetime guards in the sampled implementation.
- Sampled Lobby reads may renew once after HTTP 401; mutations are not automatically replayed. Query identity is restricted to development code in the sampled Lobby path.
- Team chat authorizes before reporting a connected state, deduplicates IDs, and preserves IDs for uncertain retries.
- Collaboration suppresses remote update echoes and tracks acknowledgements. Its shared document and recovery state must remain scoped to the active session.
- Production identity comes from shared browser authentication; mock authority and development identity are fixture boundaries.

### Match transport and command recovery

- A transport-level socket connection is insufficient: a server snapshot
  baseline enables commands. Snapshots apply in revision order.
- Same-session renewal keeps the transport/client instances but uses fresh
  sockets and baselines. Renewal or HTTP 401 never replays a mutation.
- An uncertain Submit retains its Submission/Evaluation IDs for the same
  Round, source, language and document revision. A changed request gets new IDs.
- A confirmed command remains accepted if its following state refresh fails.
  The UI reports the recovery failure and reconnects; it must not describe this
  as a rejected command or blindly send it again.

### Shared document lifetime

- Rejected or unconfirmed edits keep a scoped recovery copy. The next sync
  replaces that uncertain document with the authoritative state; copying text
  back is a deliberate manual action, not automatic update replay.
- Disconnect preserves the current Round document. Disposal destroys the Yjs
  document and awareness resources. The sidecar owner replaces collaboration
  on a Round change, keeps Team chat across Rounds in the same scope, and
  retires both on Match/session replacement.

## Side Effects

- Clients issue HTTP and Socket.IO requests and manage subscribers, listeners, and timers.
- Collaboration changes Yjs/awareness state and stores scoped recovery data in `localStorage`; React subscriptions update view state.
- Development fixtures mutate mock authority rather than production Game state.

## Verification

From the repository root with Node 22, after `npm ci` and `npm run build:packages`:

```sh
npm test --workspace arena-frontend
npm run typecheck --workspace arena-frontend
```

The unit target excludes `e2e`. Browser checks require an explicitly selected fixture and independently started server; follow [manual game testing](../../../docs/manual-game-testing.md).

The initial scout read 47,669 bytes, with capped collaboration/Lobby reads.
The transport, sidecar and recovery rules above were added after static source
review. `mock-authority.ts` remains outside this production contract. This is
not a new browser, expiry or full cleanup test result.
