# Chat service MVP — our working plan

Status: proposed scope, based on source inspection on 2026-10-29. No feature implementation is included in this step.

## How we work

We plan one feature at a time. You describe your approach and write the code; I help with specific blockers, explain the tradeoffs, and review it with you. Before moving on, we check the happy path and the important failure cases. This document tracks our agreement, not a promise to build everything at once.

## The first usable milestone

Two existing User-service accounts can authenticate, open a direct conversation, send text messages, load history, and receive live messages. Chat keeps the public profile information it needs synchronized with User service and handles deleted accounts deliberately.

Proposed first milestone: DMs, text messages, bounded history, live delivery, reconnect recovery, and user synchronization. One Chat instance initially; HTTP handles writes and reads, sockets deliver notifications. No second socket-based message-writing API yet.

Later marathon features: message edit/delete, groups/channels and roles, reactions, heartbeat/activity and last seen. These remain on the roadmap; their presence in the Prisma schema does not make all of them prerequisites for the first DM flow. Attachments, typing indicators, read receipts, and multi-instance presence are outside this initial scope.

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

No extra event bus, Redis, shared database, or generalized synchronization framework is planned for the first milestone.

## Feature checkpoints

| Order | Feature we plan together | Done when |
| --- | --- | --- |
| 1 | Authentication and runnable foundation | A real User-service token reaches protected Chat HTTP/socket paths; invalid/expired/wrong issuer/audience tokens fail; socket expiry works; database migration and required constraints are verified. |
| 2 | User event consumer | Create/update/delete populate `ChatUser`; duplicate, stale, delete-before-create, malformed payload, and DB-failure cases behave correctly. RabbitMQ reconnect resumes consumption. |
| 3 | Recovery and eligibility contracts | An older user can be bootstrapped; a missed profile/deletion event can be repaired; both block directions are checked; dependency failure does not grant access. Requires agreed User-service changes. |
| 4 | Create/get a DM and list conversations | Concurrent creation gives one canonical pair; self-DM is rejected; only participants see their conversations. |
| 5 | Send and load text messages | Author comes from verified identity; membership/eligibility is checked; text bounds and history cursors are validated; retries with one request ID do not duplicate messages; changed retry payloads are rejected. |
| 6 | Live delivery and reconnect | Notify participants after persistence, never unrelated users; reconnect reloads authoritative state through HTTP. A missed socket notification does not lose the stored message. |
| 7 | MVP integration check | The full flow works through the gateway with real User service, RabbitMQ, and PostgreSQL; endpoint/event documentation matches behavior and the client knows error/retry handling. |

For every row: agree on behavior and failure cases, you outline your approach, you implement, then we review and run targeted checks. We only expand the next row when the current one is understood.

## Deployment work needed for the usable MVP

The inspected [Compose file](../compose.yaml) includes User service and RabbitMQ, but no Chat service. The inspected [Nginx configuration](../nginx/default.conf) forwards `/api/` to User service and has no Chat route.

Plan Chat's container/database configuration, public verification key, broker credentials, HTTP routing, and Socket.IO transport routing. The `/chat` socket namespace is not itself the transport URL; choose and document the transport path with the client/proxy configuration. Verify the Socket.IO adapter dependency when making the gateway runnable. Never copy User's private signing key into Chat.

## Heartbeat/activity note

Keep this as a later feature checkpoint. First distinguish a live connection from actual user activity. Start with online/offline based on authenticated live connections and disconnect timeouts; all tabs/devices must disconnect before a user becomes offline. Add idle/last-seen semantics only after we agree what activity means and who may see it. It can move earlier without changing the identity or profile-event contracts.

## First discussion before coding

1. Agree on the DM-first milestone and whether friends are required.
2. Agree on the small User-service snapshot/eligibility contracts and service authentication.
3. Start checkpoint 1 with your approach to applying the HTTP guard and handling socket token expiry.

## Verification status

This plan comes from current source inspection, not a running integration test or a full security audit. No application code, secrets, dependencies, migrations, or sibling-service files were changed for this plan. Existing working-tree edits were left in place. Runtime connectivity, deployment configuration values, and broker permissions remain unverified.
