# Chat Service Plan (merged)

Status: proposed scope, not implemented or earned points. Updated: 2026-10-16.

A small Discord-like chat: **private 1-to-1 DMs, private groups with text channels, admin/member permissions, persistent messages, emoji reactions, and friend presence.** A plain test frontend first; the full Next.js frontend later.

**How to use this file:** read sections 1-4 once for the scope, keep section 5 (architecture) open while coding, and treat section 8 (build phases) as your checklist. If you get lost, go back to section 1.

---

## 1. Mental model (read this when confused)

Chat is a normal backend: **Postgres + REST API + WebSocket server**. The only microservice rule on top:

> Chat cannot read the User service's database. It keeps a small copy (`ChatUser`) and asks the User service for anything it doesn't have.

| Layer | Used for |
|---|---|
| **REST** | everything a user *does* (send, edit, react, manage groups) and service-to-service lookups |
| **WebSocket** | live push to connected browsers (new message, updates, membership changes, presence) |
| **MQ** | async User → Chat change notifications that must survive downtime (never on the send path) |

| User service owns | Chat service owns |
|---|---|
| identity, login/refresh, profiles, avatars, friendships, blocks | groups, memberships, roles, conversations, messages, reactions, live presence |

**Rules that never change**
- Identity comes from the verified JWT `sub`. Never trust a sender ID, role, conversation ID or group ID from the browser.
- Chat never creates identities. `ChatUser.id` is always the User-service UUID.
- Authentication answers "who are you?"; membership and role checks answer "may you do this here?". Enforce both on the backend, including list/history/search queries and socket subscriptions.
- Save to the database **before** notifying clients. A failed write must never appear as a sent message.
- REST and the database are the source of truth. The socket is only a hint, and clients recover by refetching.
- Privacy decisions fail closed: if the User service can't answer a block/friendship/status question, deny.

---

## 2. Points worth targeting

Based on the local [module tracker](../requirements/index.html) (subject v21.2). This is a planning interpretation; verify against your team's official subject before claiming modules. A completed backend alone does not finish modules that need a working user interface.

| Module | Points | What this plan contributes | What must also be demonstrated |
| --- | ---: | --- | --- |
| W05: User interaction | 2 | Send and receive DMs; open the sender's profile | Existing profile viewing, adding/removing friends, and friends list work in the final app |
| W04: Realtime features | 2 | Live messages, edits/deletions, reactions, membership changes; targeted delivery; disconnect/reconnect handling | Two separate clients stay consistent, including after interruptions |
| U05: Organization system | 2 | A group is the organization: create/view/edit/delete, add/remove members, channels inside it | Real group management screens and isolation between groups; a group-chat title alone is insufficient |
| D03: Backend microservices | 2 | Independently running Chat backend next to User backend; separate data ownership; explicit service interfaces | Working deployment and service communication; containers for databases/brokers alone do not establish this module |
| U01: Standard user management | 2 | Live online/offline status for friends | All existing profile, avatar/default-avatar, friendship and authentication requirements also pass |
| W13: Advanced search (follow-up) | 1 | Search accessible messages with filters, sorting, pagination | A usable search UI exposing all three, with no private-message leaks |

**Main target: 8 points from W05 + W04 + U05 + D03.** Presence can help complete U01 (+2); search can add 1. These are conditional values, not automatic points. Count each module once across the whole project. D03 can be demonstrated with User + Chat; Feed is not a prerequisite.

**Do not count automatically**
- **U04:** two chat roles alone don't meet its full user CRUD and role-management requirements.
- **G06 (advanced chat):** needs blocking, game invitations, game/tournament notifications, profile access, history, typing indicators **and** read receipts. Game integration belongs to your teammate; defer until the whole module works.
- **W08:** socket delivery is not the complete notification system. Plan it separately across creation/update/deletion actions.
- **W10:** needs real SSR for performance/SEO in the Next.js app. A public Feed page is a better candidate than private chat history.
- Reactions and multiple channels have no separate point value; they're included because you want them.

---

## 3. First-release behavior

### DMs
- [ ] An authenticated user can open a DM with another existing, active user. Friendship is not required (proposed default).
- [ ] Exactly one conversation exists per pair, even if both users open it simultaneously. No self-DMs.
- [ ] Only the two participants can list/read/send messages or receive live updates.
- [ ] Either person's block prevents new DM messages and reactions in **both** directions. Existing history stays readable; unblocking permits communication again.
- [ ] Users can open each other's existing public profile.
- [ ] DM list and message history are paginated and survive restarts.

### Groups and channels
- [ ] Any authenticated user can create a private group with a name, optional description, and plain-text rules.
- [ ] Creation makes the creator an **ADMIN** and creates a `general` text channel, in one transaction.
- [ ] Members can list their groups, view details/rules, and view the member list.
- [ ] Admins can edit/delete the group and add/remove existing users. Direct addition only for now; invite links/acceptance are deferred.
- [ ] Admins can create, rename/update the topic of, and delete text channels.
- [ ] Every member can access every channel in their group, including previous history. No private-channel permissions in v1.
- [ ] Members can leave. Admins can promote/demote members. A group must **always have at least one admin**; the last admin must promote someone or delete the group. Prevent simultaneous changes from removing the last admins.
- [ ] A removed member immediately loses reads, writes, subscriptions and future live delivery in every channel, across all their tabs.
- [ ] Deleting a group/channel removes its messages and reactions and closes its live views. The UI requires confirmation.

Group roles belong to that group only. All admins have equal powers; the creator has no hidden third role. A personal block stops DMs and direct group additions between that pair; it does not remove members or hide shared-group conversations in this baseline. Explain that in the UI. Broader shared-group blocking is deferred, so don't claim G06.

### Messages and reactions
- [ ] Plain text only, 1-2,000 characters after trimming. No HTML, uploads, embeds or Markdown rendering.
- [ ] Show author, server timestamp, text, and an "edited" marker when applicable.
- [ ] Authors can edit/delete their own messages while they still have conversation access. A group admin can delete channel messages (moderation) but never edit someone else's words. DM participants cannot delete each other's messages.
- [ ] Deleting leaves a tombstone: text **and reactions** removed, ID/order kept so live updates and history stay consistent.
- [ ] Fixed set of six reactions. Users add/remove their own; repeating a request is harmless. At most one row per `(message, user, emoji)`. Show counts and which ones the current user selected.
- [ ] The test UI shows pending / sent / failed and a retry action. Retrying one logical send creates exactly one message.

### Presence
- [ ] A user is online while at least one authenticated app socket is connected; count connections **per user**, not a boolean per tab.
- [ ] Closing one of two tabs keeps the user online. A short disconnect grace period avoids flicker on reconnect.
- [ ] Only authorized friends can query/subscribe to someone's presence. Refresh authorization when friendship/block state changes. Never broadcast presence globally.
- [ ] The final app connects from its shared layout, so "online" means using the app, not just having the Chat page open.
- [ ] On service interruption, clients show unknown/reconnecting instead of stale online claims.

---

## 4. Permission baseline

| Action | DM participant | Group member | Group admin | Outsider |
| --- | --- | --- | --- | --- |
| Read/send/react | Own DM, subject to block rules | Own group's channels | Own group's channels | Denied |
| Edit own message | Yes, with current access | Yes | Yes | Denied |
| Delete another user's message | No | No | Within own group's channels | Denied |
| Manage group/channels/members | n/a | No; can leave | Yes; keep at least one admin | Denied |
| View another group's history | No | No | No | Denied |

---

## 5. Architecture

### Identity and tokens
- The User service signs RS256 tokens with issuer `user-service` and audience `ft-transcendence-api`. Chat gets the **public verification key only** and validates signature, algorithm, issuer, audience, subject and expiry.
- HTTP: Bearer access token. Sockets: Socket.IO `auth` payload (`io(url, { auth: { token } })`), never the URL. Keep the token in browser memory; refresh stays with the User service's HttpOnly-cookie flow, and refresh cookies never reach Chat.
- Disconnect sockets at token expiry; the client refreshes through the User service and reconnects. The current HTTP guard can't be copied unchanged into a socket gateway (different request context).

### Keeping `ChatUser` fresh (the one microservice rule in practice)
`ChatUser` is a **local projection**, not a cross-database relation. The foreign keys in the schema point to this local table, so they're fine; a User-service ID is never a FK into another database.

- **Pull (REST, required, immediate):** `ensureUsers(ids)` finds existing rows, batch-fetches the missing ones from the User service, upserts. Triggered on first request / socket connect, when opening a DM, and when adding a group member. It also checks existence and account status.
- **Staleness:** `ChatUser.syncedAt` + a TTL (10-15 min); batch-refresh older users when loading conversations. If lookup fails, show an "unavailable user" label; it never grants extra access.
- **Guard against old data:** `create`, then `updateMany where sourceUpdatedAt < incoming`. Handle unique-violation races on concurrent inserts.
- **Deleted/disabled user:** set `deletedAt`, null `username` / `displayName` / `avatarUrl`, stop access, remove memberships safely (resolve a departing last admin by transfer or group deletion). Messages stay with an explicit retention/anonymization policy; UI shows "Deleted user". FKs are `Restrict` on purpose, so never hard-delete `ChatUser`.
- **Push (change notifications, User → Chat):** needed so active sockets react to blocks, friendships, account disabling/deletion and session revocation (re-evaluate affected sockets before further protected delivery). The MQ already exists, so use it for these events (`user.updated/deleted/disabled`, `block.changed`, `friendship.changed`). Consumers must be **idempotent**. Define retries, and resync on reconnect/startup by running the pull path. If you prefer, internal REST calls work too. Either way the call must be authenticated: a private Docker network alone is not authentication (use an `x-internal-key` secret header for REST, private broker credentials for MQ).

### Write path: REST writes, sockets for live updates
1. Browser sends a REST request to create/edit/delete a message or change a reaction.
2. Chat validates input, identity, membership, and relevant block/role rules.
3. Chat commits the database change and returns the saved result.
4. Chat pushes the change only to currently authorized subscribers.
5. Other clients update by message ID; the sender also merges by ID so its HTTP response and the socket event don't duplicate the message.

Same pattern for group/channel/member changes. There is no second socket-based "save message" implementation. The MQ is **not** in this path.

**Idempotent send:** the browser generates `clientRequestId` once per logical send and reuses it on retry. The server stores `requestHash = sha256(canonical({ conversationId, content }))`. Unique violation on `(authorId, clientRequestId)`: same hash → return the existing message; different hash → `409`.

**Versioning:** `Message.version` increments atomically on edit, delete and reaction change. Clients apply an update only if `event.version > local.version`, so stale events can't overwrite newer edits or resurrect deleted messages.

### Sockets
- Server-controlled rooms: `user:{id}` for per-user updates plus one room per conversation. Never let the browser pick arbitrary room names. [Socket.IO rooms](https://socket.io/docs/v4/rooms/) target subsets of clients; they don't replace permission checks.
- Serialize membership removal against channel mutations/delivery so a stale subscription can't leak later messages. On kick/leave/delete/block/account change: remove the sockets from the rooms immediately.
- **Reconnect:** re-authenticate → recheck permissions → subscribe and buffer incoming updates → reload conversation metadata and the current history page → merge buffered events by ID/version → invalidate older cached pages (edits/deletions made offline). [Socket.IO doesn't replay missed events](https://socket.io/docs/v4/delivery-guarantees/), so the database is the recovery source. A commit followed by a missed broadcast is recoverable by refetch; v1 doesn't promise durable live-event delivery.
- Start with **one Chat process**, in-memory rooms and in-memory presence. No Redis adapter unless you deploy replicas.

### Deployment
- Chat gets its own database and credential. Add Chat + its DB to Compose with health checks, and explicit Nginx routing for API and socket paths. Do **not** route `/internal/*` through the gateway. The inspected Compose file doesn't include Chat yet.

---

## 6. Data model

Your Prisma 7 draft stands (ChatUser, Group, GroupMember, Conversation, Message, Reaction, enums). Changes and rules to add:

- [ ] **CHECK constraint** in the first migration (Prisma can't express it):
  ```sql
  ALTER TABLE "Conversation" ADD CONSTRAINT conversation_shape CHECK (
    (kind = 'DM' AND "dmUserAId" IS NOT NULL AND "dmUserBId" IS NOT NULL
       AND "dmUserAId" < "dmUserBId" AND "groupId" IS NULL)
    OR
    (kind = 'CHANNEL' AND "dmUserAId" IS NULL AND "dmUserBId" IS NULL
       AND "groupId" IS NOT NULL)
  );
  ```
- [ ] `ChatUser.syncedAt DateTime` (when *you* last fetched; `sourceUpdatedAt` is the source's timestamp).
- [ ] `Conversation.lastMessageAt DateTime?`, updated in the same transaction as the message insert. `updatedAt` doesn't change on new messages, so it can't order the sidebar.
- [ ] Last-admin rule: do membership changes in a transaction that locks/serializes changes for that group.
- [ ] DM pair: sort the two UUIDs (consistent lowercase string compare), find-or-create on the unique pair; the DB enforces uniqueness for simultaneous opens.
- [ ] Delete message = set `deletedAt`, null `content`, delete its `Reaction` rows, `version + 1`, in one transaction.
- [ ] Group/channel deletion cascades messages and reactions (already in the schema). Capture the member list **before** deleting so you can notify and close rooms.
- [ ] History: index `(conversationId, createdAt, id)`; cursor pagination, default **30**, max **100**. Bind retry keys to the original conversation/content.
- [ ] Search (phase 7): scope to one accessible conversation. Start with Postgres (`ILIKE`, add `pg_trgm` if slow); no separate search engine.
- [ ] Later: read state per member (for read receipts / unread, part of G06).

---

## 7. Contracts

### Public REST (through the gateway)

| Area | Method + path | Purpose |
|---|---|---|
| DMs | `POST /chat/dms` `{ otherUserId }` | find-or-create DM |
| Conversations | `GET /chat/conversations` | my DMs + channels, ordered by `lastMessageAt` |
| Messages | `GET /chat/conversations/:id/messages?cursor=&limit=` | newest first; cursor = `(createdAt, id)` of the last item |
| | `POST /chat/conversations/:id/messages` `{ content, clientRequestId }` | send |
| | `PATCH /chat/messages/:id` | edit (author only) |
| | `DELETE /chat/messages/:id` | soft delete (author, or group admin in channels) |
| Reactions | `PUT / DELETE /chat/messages/:id/reactions/:emoji` | add / remove mine (idempotent) |
| Groups | `POST /chat/groups`, `GET /chat/groups` | create (creator = ADMIN, `general` channel), list mine |
| | `GET / PATCH / DELETE /chat/groups/:id` | details+rules / edit / delete (admin) |
| Members | `GET /chat/groups/:id/members` | list |
| | `POST /chat/groups/:id/members` `{ userId }` | add (admin) |
| | `PATCH /chat/groups/:id/members/:userId` `{ role }` | promote/demote (admin) |
| | `DELETE /chat/groups/:id/members/:userId` | kick (admin) or leave (self) |
| Channels | `POST /chat/groups/:id/channels`; `PATCH / DELETE /chat/channels/:id` | admin only |
| Search | `GET /chat/conversations/:id/messages/search?q=&author=&from=&to=&sort=&cursor=` | phase 7 |
| Presence | `GET /chat/presence` | initial friend presence (friends list from User service) |

Message responses embed the author: `{ id, username, displayName, avatarUrl }`, joined from `ChatUser`.

### Internal (service-to-service, never via the gateway)

| Service | Endpoint / event | Purpose |
|---|---|---|
| User | `GET /internal/users?ids=a,b,c` | `[{ id, username, displayName, avatarUrl, updatedAt, status/deleted }]` |
| User | `GET /internal/blocks/check?a=&b=` | blocked either way? (deny if unavailable) |
| User | `GET /internal/friends?userId=` (or check endpoint) | friend IDs for presence authorization |
| MQ | `user.updated`, `user.deleted/disabled`, `block.changed`, `friendship.changed` | change notifications, idempotent consumers |

Protect REST `/internal/*` with a shared-secret guard.

### Socket events (server → client)

| Event | Payload | When |
|---|---|---|
| `message:created` | full message | after insert |
| `message:updated` | full state + `version` (edit, delete, reactions) | after commit |
| `conversation:created` | conversation | new DM / added to group |
| `group:updated`, `group:deleted` | group / id | group changes |
| `member:added`, `member:updated`, `member:removed` | group + member | membership changes (removal also drops room access) |
| `channel:created`, `channel:updated`, `channel:deleted` | channel / id | channel changes |
| `presence` | `{ userId, online }` | friends only, with grace period |
| `typing` | `{ conversationId, userId }` | optional, ephemeral; part of G06 later |

---

## 8. Build phases

Finish one phase against its check before moving on. Keep the test frontend functional and plain.

### Phase 1: Foundation
- [ ] Chat boots, connects to its own Postgres, runs `prisma migrate` (CHECK constraint included, `syncedAt` and `lastMessageAt` added).
- [ ] JWT guard (RS256, issuer, audience, expiry, public key only) extracts `userId` from `sub`.
- [ ] Internal-secret guard ready.
- [ ] User service exposes `GET /internal/users`; `ensureUsers(ids)` works (including race handling and deleted users).
- [ ] Compose + Nginx routing + health checks for Chat and its DB.

**Proof:** existing login reaches a protected Chat route; invalid/expired token fails; a brand-new user's first request creates their `ChatUser`; Chat cannot access the User database.

### Phase 2: Persistent DMs (REST only)
- [ ] `POST /chat/dms`: sort UUIDs, `ensureUsers`, find-or-create. No self-DMs, active users only.
- [ ] Access helper: DM participant, or group member for channels.
- [ ] Idempotent send, transactional `lastMessageAt` update, cursor history (30/100).
- [ ] Live block check on DM create/send (deny when the User service is unavailable).

**Proof:** two accounts exchange text via Postman; reload keeps history; a third account is denied; blocked send fails; same `clientRequestId` twice → one message; different payload → `409`.

### Phase 3: Realtime + test UI
- [ ] Socket gateway with token handshake, expiry disconnect, server-controlled rooms.
- [ ] Emit `message:created` after commit to authorized subscribers only.
- [ ] User → Chat change notifications for blocks/account status (re-evaluate sockets).
- [ ] Test UI: normalized store (`usersById`, `conversationsById`, `messageIdsByConversation`), one socket in the app shell, optimistic send (`crypto.randomUUID()` per logical send, pending/failed/retry reusing the **same** id), dedupe echo by ID or `clientRequestId`.
- [ ] Reconnect flow as in section 5.

**Proof:** two browser sessions update immediately; disconnect/reconnect restores state without duplicates. **First milestone: Alice and Bob log in, open one persistent DM, exchange messages live, reload history; Charlie can't access it.** Build this before groups.

### Phase 4: Groups and roles
- [ ] Group CRUD (creator = ADMIN + `general` channel in one transaction), member add/remove/leave/promote/demote with last-admin protection, channel CRUD.
- [ ] Join/leave sockets and rooms on membership changes; membership-removal serialization.
- [ ] Group/channel/member socket events.

**Proof:** admin manages group and channels; member permissions differ; a kicked user's open tab stops receiving data; two simultaneous last-admin changes leave at least one admin.

### Phase 5: Message actions
- [ ] Edit, delete (with tombstone + reaction removal), six reactions, `version` increments, `message:updated` events.
- [ ] UI: tombstone, "edited" label, emoji enum → glyph, counts, highlight mine; apply updates only if `version` is newer.

**Proof:** all permitted clients update; unauthorized edits/deletes fail; retrying a reaction leaves correct counts; admin can delete in a channel but not edit.

### Phase 6: Presence (+2 U01 candidate)
- [ ] Per-user connection counting, grace period, friend-only authorization (friends from the User service), `friendship.changed` / `block.changed` refresh, initial state endpoint, unknown state on disconnect.
- [ ] Integrate with the existing friends list.

**Proof:** two tabs = one online user; the last disconnect updates friends; non-friends get nothing.

### Phase 7: Search (optional, +1 W13 candidate)
- [ ] Text search in an accessible conversation, author/date filters, newest/oldest sort, bounded pagination, access rechecked per request.

**Proof:** UI exposes every option; outsiders can't retrieve text or counts; losing membership revokes search.

### Phase 8: Final frontend
- [ ] Move proven contracts into the full Next.js app; profile/friend links, group management screens, accessible responsive states, presence from the shared layout.

**Proof:** full module journeys work without test-only buttons or manual API calls.

---

## 9. Security and integration checks

- [ ] Validate all HTTP/socket input; bound message length, page size, group/channel counts, subscriptions, and connections per user.
- [ ] Allowlisted origins for HTTP and socket handshakes, TLS externally, escaped text rendering.
- [ ] Reject missing/expired credentials and spoofed authors, roles, conversation IDs, group IDs.
- [ ] Recheck access on every mutation, history/search request and subscription; remove stale delivery access on leave/kick/delete/block/account changes.
- [ ] Per-user write limits in Chat, connection/subscription limits on sockets (Nginx limits don't police messages on an open WebSocket).
- [ ] Verify effective Nginx limits on the new routes. The current API setting is 67 req/min per IP with burst 10; normal chat traffic and several users behind one IP must remain usable. Treat it as configuration to test.
- [ ] Log useful errors and IDs without tokens, refresh cookies or message bodies. Keep storage/broker/admin surfaces private.
- [ ] Document account deletion/disable behavior and the retention/anonymization policy for authored history.
- [ ] Don't rely on the DB-commit-then-publish pair for critical events: a crash between them loses the event. The pull/TTL/resync path is the safety net (an outbox table only if you later need hard guarantees).

---

## 10. Testing checklist

Use the existing test tooling for focused integration tests; browser demos supplement them. A passing build alone doesn't prove the feature works.

- [ ] Outsider and non-member denied on read, send, react, search and subscribe.
- [ ] Same `clientRequestId` + same payload → one message; different payload → `409`.
- [ ] Two simultaneous DM creations (A→B and B→A) → one conversation.
- [ ] Two simultaneous sends, duplicate reaction requests, concurrent last-admin changes behave correctly.
- [ ] Blocked pair can't send or react in either direction; unblocking restores it; User service down → deny.
- [ ] Unknown user triggers `ensureUsers`; User service down → known users still work.
- [ ] Deleted user shows as "Deleted user"; old messages remain; memberships cleaned up.
- [ ] Kicked/blocked/disabled user's open tabs stop receiving data immediately.
- [ ] Socket drop + reconnect → no missing or duplicated messages; offline edits/deletes reflected.
- [ ] Lower-`version` event is ignored by the frontend.
- [ ] Expired token → socket disconnects, client refreshes and reconnects.
- [ ] Two tabs count as one online user; non-friends receive no presence.

---

## 11. Deliberately later

- Full notification inbox (W08): build after Chat and Feed actions are defined; inventory message/group/channel/member/reaction changes. Live delivery alone isn't notification persistence. Offline notifications via MQ fit here (`message.created` with IDs only).
- Advanced chat (G06): coordinate a game-invite/event contract with your teammate, then add the missing set including typing and read receipts. No game implementation is assigned to you.
- Uploads/voice notes, live calls, threads, pinned messages, custom emoji, channel-specific permissions, bots, nicknames, custom roles, invite links, public group discovery.
- Redis, multiple Chat replicas, a search engine, a generic permission framework, event-sourcing.

**Stop expanding Chat** once DMs, groups/channels, roles, reactions, realtime recovery and presence pass their checks. Search is the small optional addition. Then move to Feed and notifications, and finish the production frontend after the service contracts are exercised.

---

## 12. Open decisions

- [ ] MQ broker, retry and dead-letter setup, and which User → Chat events to publish first (or use authenticated internal REST for them instead).
- [ ] Exact shape of the friends/presence contract with the User service.
- [ ] Retention/anonymization policy for messages of deleted users.
- [ ] Frontend state library for the final app.
- [ ] Whether to cache block checks (short TTL, invalidated by `block.changed`) or call live every time. Start live; add caching only if it's slow.

---

## 13. Merge notes (what was reconciled)

- Phase order follows your plan (groups before message actions, presence and search after). My earlier order put edits/reactions first.
- Sockets are used for notifications and broadcast; the MQ is only for User → Chat change notifications (and later, offline notifications), never on the send path.
- Your plan said "no cross-service foreign keys"; the Prisma schema's FKs point to the local `ChatUser` table, which is consistent with that rule.
- Group admin rules, block semantics, reaction removal on delete, pagination limits (30/100) and Nginx-limit checks come from your plan; endpoint lists, schema tweaks, the CHECK constraint, `ensureUsers`, and the optimistic-send flow come from the earlier build guide.
- gRPC is not used anywhere; lookups are plain internal REST.

---

## Inspection basis

- [Local module tracker](../requirements/index.html): module names, values and completion criteria; the original subject still governs evaluation.
- [Product context](../PROJECT_CONTEXT.md): broader product wishlist.
- [Chat scaffold](src/app.module.ts) and [manifest](package.json): currently starter NestJS code, not a working chat implementation.
- [Compose](../compose.yaml): existing deployment boundaries; Chat integration remains to be added.
- [Token configuration](../user-service/src/auth/auth.module.ts) and [HTTP guard](../user-service/src/auth/guards/access-token.guard.ts): existing authentication contract.
- [Social service](../user-service/src/social/social.controller.ts): existing friendship and block operations to integrate rather than duplicate.
- [Nginx configuration](../nginx/default.conf): current request limits and routing to revisit when Chat is connected.