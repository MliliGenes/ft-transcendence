# Game HTTP and socket adapters

## Overview

This directory connects Nest HTTP and four Socket.IO namespaces to GameService
and the Arena engine. It adapts transport, verified principals and runtime
availability; the engine retains Match membership, phase and scoring authority.

## Interface

- [game.module.ts](./game.module.ts) wires the adapters and exports `GameService`;
  [game.service.ts](./game.service.ts) composes the engine, storage and Judge.
- [game.controller.ts](./game.controller.ts) exposes Match creation fixtures,
  snapshots, start/begin, Run, readiness, language, Submit, advance, Leave,
  final results and Team chat authorization.
- [lobby.controller.ts](./lobby.controller.ts) exposes queue and private-room
  operations. [lobby.gateway.ts](./lobby.gateway.ts) supplies Lobby socket wiring.
- [game.gateway.ts](./game.gateway.ts), [collab.gateway.ts](./collab.gateway.ts)
  and [team-chat.gateway.ts](./team-chat.gateway.ts) adapt Match actions,
  collaboration updates/cursors and Team chat respectively.
- [runtime-availability.interceptor.ts](./runtime-availability.interceptor.ts)
  applies runtime gates; [judge-factory.ts](./judge-factory.ts) selects a Judge.
- Dependencies use the engine's supported
  [entry points](../../../../packages/README.md). See also the
  [principal client](../auth/README.md) and [process lifecycle](../README.md).

### Socket protocol

| Namespace | Handshake and inbound message family |
| --- | --- |
| `/` | Token plus `matchId`; `run`, `submit`, `setReady`, `leave`; authoritative `snapshot` baseline. |
| `/lobby` | Token and authorized Lobby context; `lobby:join_room`, `lobby:leave_room`; room/active-state hints. |
| `/collab` | Token plus `matchId`; `update` and `cursor`; authorized shared-document sync. |
| `/chat` | Token plus `matchId`; `message` and `ping`; authorized Team history/live delivery. |

The handshake token supplies the verified principal; Match membership and side
come from Game. See [socket-auth.ts](./socket-auth.ts) for shared admission and
message authorization. The explicit development fixture is separate.

### HTTP invocation

Paths below are Game-internal; the gateway exposes them under `/api`.
Production calls carry Bearer authentication. Reads still require membership.

| Route | Body or result contract |
| --- | --- |
| `POST /matches` | DEV-only creation: mode, participants, problem-version IDs; disabled in production. |
| `GET /matches/:id/snapshot` | Authorized caller's Match snapshot. |
| `POST /matches/:id/start`, `/begin`, `/advance`, `/leave` | Match lifecycle commands; no caller-selected identity. |
| `POST /matches/:id/run` | `code`, `language`; visible-test result. |
| `POST /matches/:id/ready` | Boolean `ready`, optional `documentRevision`. |
| `POST /matches/:id/language` | `language`. |
| `POST /matches/:id/submit` | `code`, `language`, optional `submissionId`, `evaluationId`, `documentRevision`; receipt. |
| `GET /matches/:id/final`, `/team-chat-auth` | Final result or authorized Team chat context. |
| `POST /lobby/queue`, `/queue/cancel`; `GET /lobby/queue/status` | Join with `mode`, cancel, or read queue status. |
| `POST /lobby/rooms`, `/rooms/join`; `GET /lobby/rooms/:id` | Create with `mode`, join with `code`, or read the room. |
| `POST /lobby/rooms/:id/side`, `/ready`, `/leave`, `/start` | `sideId` (`left`/`right`), boolean `ready`, or room lifecycle command. |
| `GET /lobby/active` | `{ ok: true, queue, room }` admission state. |

Run/Submit source is capped at 65,536 JavaScript code units and language at
32 characters. A room code must be nonempty after trimming and at most 32
characters. Team Submit uses revision-bound readiness and immutable attempt IDs
as specified in the [engine contract](../../../../packages/arena-game/src/lib/README.md#invariants).

## Invariants

- Production requests use principal-derived identity and runtime guards.
  Direct Match creation is available only with `DEV_PRINCIPAL=true`.
- Runtime readiness requires ready state, a live shutdown signal and active
  storage. The interceptor checks availability before and after calls; socket
  output is suppressed when the runtime is unavailable.
- PostgreSQL startup obtains Game runtime ownership before schema setup and
  recovery. One active Game process may own a Game database at a time.
- Memory storage requires the explicit development fixture. Development mode
  never bypasses PostgreSQL runtime ownership when a database is configured.
- Judge selection is explicit; an infrastructure failure does not choose a
  fallback Judge. The [private worker](../../../judge-worker/README.md) is a
  separate execution boundary.
- Socket disconnect tracks Presence. It is distinct from an explicit Leave,
  which follows the engine's Match rules.

Socket authorization checks every inbound message and disconnects an idle
socket when its verified token expires. Renewal requires a fresh authorized
socket/baseline. Outbound delivery is checked per recipient: expired recipients
do not receive late acknowledgements or broadcasts. An already accepted
evaluation may finish and persist even when its caller can no longer receive
an acknowledgement; use its existing IDs when reconciling.

Missing/rejected identity returns HTTP 401; an unavailable verification service
returns 503. The error filter maps engine codes 400, 403, 404, 409, 410, 429 and
503; unknown faults become a generic 500. Some legacy controller validation
branches return an `{ error }` object without throwing, so an HTTP success
status alone is insufficient. Successful Lobby operations use an `ok: true`
envelope; inspect the operation's returned fields as well as its status.

## Side Effects

- Calls the engine, emits socket events, joins/leaves rooms and returns HTTP
  responses. Storage composition acquires ownership and performs SQL recovery.
- Schedules Match deadline, Reveal, Presence and Lobby work. Runtime loss stops
  admission/output and initiates cleanup, local aborts and store closure.
- Can request remote judging; closing a local wait does not guarantee a remote
  execution has stopped.

After a successful Submit, GameService asynchronously checks whether every
side has a counted result, then publishes Reveal with a 1,500 ms grace window.
Publication failure does not reject that accepted Submission. Pending Reveal
work retries on the one-second deadline sweep; the separate ten-second timer
sweeps Presence grace and retries matchmaking.

## Verification

From the repository root with Node 22:

```sh
npm run typecheck --workspace arena-game
npm test --workspace arena-game
```

Build package dependencies first and follow the
[manual guide](../../../../docs/manual-game-testing.md) for disposable database
and Docker fixtures. Test commands can mutate their selected fixture databases.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. The initial scout read
49,332 bytes. HTTP/socket contracts and service timers above were expanded after
static source review. This does not certify every implementation or establish a
new HTTP, socket, authentication or runtime test result.
