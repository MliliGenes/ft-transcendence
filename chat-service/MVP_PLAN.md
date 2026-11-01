# Chat service MVP — our working plan

Status: active working plan, updated 2026-10-31. Persistent DM features are in progress; live delivery is next.

## How we work

We plan one feature at a time. You describe your approach and write the code; I help with specific blockers, explain the tradeoffs, and review it with you. Before moving on, we check the happy path and the important failure cases. This document tracks our agreement, not a promise to build everything at once.

## The first usable milestone

Two existing User-service accounts can authenticate, open a direct conversation, send text messages, load history, and receive live messages. Chat keeps the public profile information it needs synchronized with User service and handles deleted accounts deliberately.

First milestone: DMs, text messages, bounded history, live delivery, reconnect recovery, and user synchronization. One Chat instance initially; HTTP handles writes and reads, sockets deliver notifications. No second socket-based message-writing API is planned for the MVP.

Message edit, soft delete, read markers, and derived unread counts have been added to the current DM implementation. After live message delivery works, the next feature is groups, channels, and group roles. Reactions, heartbeat/activity, and last seen remain later marathon features. Attachments, typing indicators, and multi-instance presence are outside this initial scope.

## Current implementation snapshot

Implemented in the current codebase:

- JWT-protected Chat HTTP endpoints and an authenticated Socket.IO `/chat` namespace.
- Create or return one canonical DM for a sorted user pair.
- List the caller's DM conversations with `lastReadMessageId` and a derived `unreadCount`.
- Send idempotent text messages, load message history, edit messages, and soft-delete messages.
- Upsert a caller's last-read message for a DM.
- Emit `message:created` to both DM participants after a successful insert; retries do not emit again.
- Lazily bootstrap missing public `ChatUser` profiles from User service during DM creation.
- Run Chat and its dedicated PostgreSQL database through root Compose, with Nginx routes for REST and Socket.IO.
- Exercise DMs and live messages from the authenticated `/chat-test` frontend.
- API reference files in `API.md` and `openAPI.json`.

Still incomplete or awaiting stronger verification:

- Message pagination still needs a finished response envelope and next cursor.
- Read markers can currently move backward.
- Two-participant socket isolation, socket token expiry, profile reconciliation, block eligibility, and full end-to-end integration remain unfinished. RabbitMQ profile consumption is running, but the repair path for a missed publication still remains.

## What User service actually provides

### Authentication contract

| Item | Current contract |
| --- | --- |
| Signing | User service holds the private RSA key and signs access tokens with `RS256`. Chat only needs the matching public key. |
| Issuer / audience | `iss = user-service`; `aud = ft-transcendence-api`. |
| Identity | `sub` is the User-service UUID. Signing supplies `sub`; the configured JWT library adds time and issuer/audience claims. No role, profile, session ID, or account-state claim is supplied. |
| Lifetime | Access token: 900 seconds. Refresh token: 7 days. |
| HTTP | `Authorization: Bearer <accessToken>`. User's guard verifies the token and requires a UUID `sub` and numeric `exp`. |
| Browser session | Login/register/refresh return the public session, including `accessToken`, `tokenType`, and `expiresIn`. The refresh secret stays in an HttpOnly `auth-refresh` cookie, scoped to `/auth/`, SameSite Lax, Secure for production/HTTPS configuration. |
| Refresh/logout | User service rotates refresh tokens and revokes refresh sessions on logout. Chat does not issue or refresh tokens. |
| Revocation limitation | Logout does not revoke an already-issued access JWT. There is no access-token session identifier or logout event for Chat to consume. A locally verified JWT can remain valid until expiry. |

Sources: [auth module](../user-service/src/auth/auth.module.ts), [guard](../user-service/src/auth/guards/access-token.guard.ts), [token lifetimes](../user-service/src/auth/token.constants.ts), [session cookies](../user-service/src/auth/session-cookie.ts), [auth controller](../user-service/src/auth/auth.controller.ts), [token creation and refresh/logout](../user-service/src/auth/auth.service.ts).

Chat's [auth module](src/auth/auth.module.ts) already matches the algorithm, issuer, and audience. Differences to address:

- User normalizes literal `\\n` in PEM environment values; Chat currently does not. Support the same key representation.
- Chat has an [AuthGuard](src/auth/auth.guard.ts), but it is not currently registered globally or attached to the chat controller. Defining a guard does not protect endpoints.
- The [gateway](src/chat/gateway/chat.gateway.ts) verifies `handshake.auth.token` at connection time and joins `user:<sub>`. It has no expiry timer or deleted-account check. The guard's alternate WebSocket token fallback is not the gateway's actual handshake contract.
- Choose one identity shape for HTTP/socket handlers. The gateway currently uses `socket.data.userId`; the guard's WebSocket branch uses `socket.data.user.sub`.

MVP proposal: keep the existing token contract, protect every chat operation, disconnect sockets at access-token expiry, and let the client refresh through User service before reconnecting. Disconnect locally on logout. Immediate cross-device access-token revocation is a separate contract change, not something profile events provide.

### RabbitMQ contract

| Item | Current implementation |
| --- | --- |
| Exchange | `user.events`, topic, durable |
| Queue | `chat.user-events`, durable; currently declared by User service |
| Binding | `user.#` |
| Routing key | The event's `eventType` |
| Publishing | Confirm channel, persistent messages, JSON content type, 5-second publish timeout |
| Message properties | `messageId = eventId`; publisher sets AMQP `timestamp` using `Date.now()` |
| Connection | Broker heartbeat 30 seconds; reconnect interval 2 seconds |

The broker heartbeat is connection health between the publisher and RabbitMQ. It is unrelated to a user's online/activity status.

All event bodies contain `eventId`, `eventType`, `version`, `occurredAt`, and `data`:

| Event | `data` | `version` |
| --- | --- | --- |
| `user.created` | `userId`, `username`, nullable `displayName`, nullable `avatarUrl` | User row's `updatedAt`, ISO string |
| `user.updated` | Same full public-profile snapshot | User row's `updatedAt`, ISO string |
| `user.deleted` | `userId` only | Deletion publication time, ISO string; also used as `occurredAt` |

`version` is a source timestamp, not a schema version or sequential event counter. `occurredAt` is publication-envelope creation time. Do not use arrival order as profile order.

Sources: [event types](../user-service/src/events/user-event.types.ts), [publisher and topology](../user-service/src/events/rabbitmq-events.service.ts), [global event module](../user-service/src/events/events.module.ts), [application registration](../user-service/src/app/app.module.ts).

Publication paths inspected:

- Registration, newly created OAuth users, and admin-created users publish `user.created`.
- Profile edits, avatar replacement, admin profile edits, and the existing profile helper publish `user.updated`.
- Self-deletion and admin deletion publish `user.deleted` after deleting the user.
- Friendship/block operations do not publish events. Neither do logout and role changes. The three profile events do not express social permissions or session state.

Sources: [auth service](../user-service/src/auth/auth.service.ts), [accounts service](../user-service/src/accounts/accounts.service.ts), [admin service](../user-service/src/superadmin/superadmin.service.ts), [social controller](../user-service/src/social/social.controller.ts), [blocks](../user-service/src/social/blocks.service.ts), [friendships](../user-service/src/social/friendships.service.ts).

### Synchronization gaps we must account for

1. **Database commit and publication are separate.** The inspected mutation paths commit before awaiting publication; there is no transactional outbox in these paths. A crash between them can lose an event. A publish failure can also make a request fail after its database mutation succeeded.
2. **Events do not bootstrap older users.** Chat needs a trusted way to obtain profiles for users created before the queue/events existed, and to repair missed updates.
3. **Public profile responses omit `updatedAt`.** `/accounts/:id` and the public list return public fields, but not the source version Chat needs. Do not stamp them with Chat's current time and pretend it is the source version. `/accounts/me` includes private account fields and is not a general synchronization API.
4. **Blocks are directional in storage.** `/social/blocks` returns only accounts blocked by the caller. It cannot alone answer whether either participant has blocked the other. There is no dedicated Chat eligibility endpoint in the inspected controllers.
5. **Deletion must win permanently for that UUID.** Chat needs a tombstone even if deletion arrives before creation. A delayed profile event must not resurrect the account. UUID reuse is outside this proposed contract.

For this MVP, “synced” means eventual profile convergence with an explicit repair path, not instantaneous consistency or guaranteed event delivery from the current publisher.

## Proposed integration decisions

These are proposals to agree on before implementing the relevant feature:

- **Ownership:** User owns accounts, public profiles, friendships, and blocks. Chat owns conversations, membership, messages, and later presence. No cross-service database access.
- **DM policy:** recommend allowing DMs between existing accounts unless either has blocked the other. Friends-only remains an open product choice. Do not silently implement either rule.
- **Eligibility:** add a small authenticated internal User-service operation that checks both accounts and both block directions (and friendship if we choose friends-only). Use it before DM creation and sends; fail closed on dependency failure. Service authentication must be defined, not inferred from the Docker network.
- **Block behavior:** recommend blocking new DM creation/sends while retaining participants' existing history. Decide visibility of presence separately. A check before sending is a point-in-time decision; stricter cross-service ordering needs more coordination and is not promised here.
- **Profile recovery:** add a trusted versioned snapshot lookup for a user ID, returning only Chat's public fields and source `updatedAt`, with authoritative not-found semantics. Use it for lazy bootstrap and reconciliation of locally known users. A timeout/5xx must never mean deletion.
- **Reliability:** implement the consumer plus an explicit reconciliation task before calling synchronization complete. A producer outbox is the stronger later improvement; do not assume publisher confirms close the database/publication gap.
- **Deletion enforcement:** on a trusted deletion, clear profile fields, retain the UUID tombstone, deny future operations, and disconnect that user's sockets. Account checks/reconciliation cover missed deletion events; do not claim immediate revocation during outages. Define history retention before implementing deletion cleanup.
- **Consumer behavior:** validate runtime payloads, apply updates atomically only if newer, tolerate duplicates, and acknowledge only after the database transaction commits. Equal timestamps are not a total order; conflicting snapshots need reconciliation. Bound transient retries and isolate malformed/poison messages instead of infinite requeueing. Coordinate queue arguments with the publisher's existing declaration.
- **Live delivery:** REST remains the only message-write path. After a new message commits, emit `message:created` to the existing `user:<userId>` rooms of both DM participants, including the sender so their other tabs update. An idempotent retry returns the stored message without emitting again. Socket delivery is best effort; reconnect recovery always reloads authoritative state through HTTP.

No extra event bus, Redis, shared database, or generalized synchronization framework is planned for the first milestone.

## Feature checkpoints

| Order | Feature we plan together | Status | Done when |
| --- | --- | --- | --- |
| 1 | Authentication and runnable foundation | In progress | A real User-service token reaches protected Chat HTTP/socket paths; invalid/expired/wrong issuer/audience tokens fail; socket expiry works; database migration and required constraints are verified. |
| 2 | User event consumer | Implemented | `user.created`, `user.updated`, and `user.deleted` populate or tombstone `ChatUser`. Source timestamps reject stale/duplicate deliveries; malformed payloads are discarded; DB failures are requeued; the durable consumer reconnects automatically. |
| 3 | Recovery and eligibility contracts | Not started | An older user can be bootstrapped; a missed profile/deletion event can be repaired; both block directions are checked; dependency failure does not grant access. Requires agreed User-service changes. |
| 4 | Create/get a DM and list conversations | Implemented, verification incomplete | Concurrent creation gives one canonical pair; self-DM is rejected; only participants see their conversations; conversation summaries return the caller's read marker and unread count. |
| 5 | Send, load, edit, delete, and mark messages read | Implemented, verification incomplete | Author comes from verified identity; access is checked; text bounds and history cursors are validated; retries do not duplicate messages; changed retry payloads are rejected; edit/delete ownership and unread calculations are verified. |
| 6 | Live delivery and reconnect | Implemented, integration verification incomplete | A newly committed message emits `message:created` once to both participants; retries do not re-emit; unrelated users receive nothing; reconnect reloads authoritative state through HTTP. |
| 7 | Groups, channels, and roles | After live delivery | A group creator becomes an admin; authorized admins manage members and channels; members can access only their groups; live delivery reaches current members only. |
| 8 | MVP integration check | Not started | The full flow works through the gateway with real User service, RabbitMQ, and PostgreSQL; endpoint/event documentation matches behavior and the client knows error/retry handling. |

For every row: agree on behavior and failure cases, you outline your approach, you implement, then we review and run targeted checks. We only expand the next row when the current one is understood.

## Deployment work needed for the usable MVP

Root Compose now includes `chat-service` and a dedicated `chat-db`. The Chat
container applies Prisma migrations before starting. Nginx preserves `/chat/*`
for REST and proxies `/socket.io/*` with WebSocket upgrade support. Only the User
service's public JWT verification key is copied into Chat's environment.

The existing test frontend exposes `/chat-test` and connects to the `/chat`
Socket.IO namespace through the `/socket.io` transport path. Remaining deployment
work includes production secrets, broker consumption, stronger health/readiness
policy, and deployment outside the local Compose environment.

## Heartbeat/activity note

Keep this as a later feature checkpoint. First distinguish a live connection from actual user activity. Start with online/offline based on authenticated live connections and disconnect timeouts; all tabs/devices must disconnect before a user becomes offline. Add idle/last-seen semantics only after we agree what activity means and who may see it. It can move earlier without changing the identity or profile-event contracts.

## Current next step: verify live delivery, then build groups and channels

1. Connect two authenticated clients and verify that both receive one `message:created` event after a send.
2. Connect a third user and verify that the unrelated socket receives nothing.
3. Retry the same `clientRequestId` and verify that no second event or message is produced.
4. Disconnect and reconnect a participant, then reload authoritative history through HTTP.
5. After this runtime proof, begin group creation, membership, roles, and channels.

The single-client sender-room path has passed through Nginx with a real access
token. The checklist above still requires two participant clients and an
unrelated third client.

## Verification status

This plan reflects source inspection and the work completed so far. Chat and the
frontend build successfully; Compose validates; Chat migrations ran against its
dedicated database; Nginx returned the frontend, protected Chat REST, and
Socket.IO transport correctly. An authenticated smoke test created a DM, sent a
message, and received `message:created` in the sender's socket room. RabbitMQ
consumption, two-participant isolation, reconnect recovery, and several negative
authorization cases remain unverified.
