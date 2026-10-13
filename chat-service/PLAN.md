# Chat service implementation plan

Status: proposed scope, not implemented or earned points. Updated: 2026-10-12.

Build a small Discord-like chat: **private 1-to-1 DMs, private groups with text channels, admin/member permissions, persistent messages, and emoji reactions.** Use a basic testing frontend now. Build the complete Next.js frontend later.

Read sections 1–3 for the scope. Use section 7 as your implementation checklist.

## 1. Points worth targeting

Based on the local [module tracker](../requirements/index.html), which describes subject v21.2. This is a planning interpretation; verify against your team's official subject before claiming modules. A completed backend alone does not finish modules that need a working user interface.

| Module | Points | What this plan contributes | What must also be demonstrated |
| --- | ---: | --- | --- |
| W05 — User interaction | 2 | Send and receive DMs; open the sender's profile | Existing profile viewing, adding/removing friends, and friends list must work in the final app |
| W04 — Realtime features | 2 | Live messages, edits/deletions, reactions, membership changes; targeted delivery; disconnect/reconnect handling | Two separate clients stay consistent, including after interruptions |
| U05 — Organization system | 2 | A group is the organization: create/view/edit/delete it, add/remove members; create/read/update channels inside it | Real group management screens and isolation between groups; a group-chat title alone is insufficient |
| D03 — Backend microservices | 2 | Independently running Chat backend alongside User backend; separate data ownership; explicit service interfaces | Working deployment and service communication; containers for databases/brokers alone do not establish this module |
| U01 — Standard user management | 2 | Live online/offline status for friends | All existing profile, avatar/default-avatar, friendship, and authentication requirements must also pass |
| W13 — Advanced search (small follow-up) | 1 | Search accessible messages with filters, sorting, and pagination | A usable search interface exposing all three, with no private-message leaks |

**Main target: support 8 module points through W05 + W04 + U05 + D03.** Presence can help complete U01 for another 2; search can add 1. These are conditional module values, not 11 automatically earned new points. Count each module once across the whole project, including anything already in your tally. D03 can be demonstrated with User + Chat; Feed is not a prerequisite.

Do not count these automatically:

- **U04:** two chat roles alone do not meet its full user CRUD and role-management requirements. Existing admin work must stand on its own.
- **G06, advanced chat:** requires blocking, game invitations, game/tournament notifications, profile access, history, typing indicators **and** read receipts. Game integration belongs to your teammate; defer this point until the whole module works.
- **W08:** socket message delivery is not the complete notification system. Plan that separately across creation/update/deletion actions.
- **W10:** your later Next.js frontend must actually demonstrate SSR for performance and SEO. Installing Next.js earns no point by itself; a public Feed page is a more useful candidate than private chat history.
- Reactions and multiple channels have no separate automatic point value. They are included because you want them.

## 2. Exact first-release behavior

These are proposed defaults to give you a concrete implementation target. They narrow the broader wishlist in [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md).

### DMs

- [ ] An authenticated user can open a DM with another existing, active user. Friendship is not required in this proposed default.
- [ ] Exactly one conversation exists per pair, even if both users open it simultaneously. No self-DMs.
- [ ] Only those two participants can list/read/send messages or receive live updates.
- [ ] Either person's block prevents new DM messages and reactions in both directions. Existing history remains readable; unblocking permits communication again.
- [ ] Users can open each other's existing public profile.
- [ ] The DM list and message history are paginated and survive restarts.

### Groups and channels

- [ ] Any authenticated user can create a private group with a name, optional description, and plain-text rules.
- [ ] Creation makes the creator an **ADMIN**, and creates a `general` text channel in one transaction.
- [ ] Members can list their groups, view group details/rules, and view the member list.
- [ ] Admins can edit/delete the group and add/remove existing users. Start with direct addition; invitation links and invitation acceptance are deferred.
- [ ] Admins can create, rename/update the topic of, and delete text channels.
- [ ] Every member can access every channel in their group, including its previous history. No private-channel permissions in v1.
- [ ] Members can leave. Admins can promote/demote members, but an existing group must always have at least one admin.
- [ ] The last admin must promote someone before leaving, or delete the group. Prevent simultaneous changes from removing the last admins.
- [ ] A removed member immediately loses reads, writes, subscriptions, and future live delivery in every channel, across all their tabs.
- [ ] Deleting a group/channel removes its messages and reactions and closes its live views. Require confirmation in the UI.

Group roles belong to that group only. An admin in Group A has no authority in Group B. All group admins have equal powers; the creator has no hidden third role. Personal blocking stops DMs and direct group additions between that pair; it does not remove members or hide shared-group conversations in this baseline. Explain that behavior in the UI. Broader shared-group blocking is deferred, so do not claim G06.

### Messages and reactions

- [ ] Send plain text, 1–2,000 characters after trimming; no HTML, uploads, embeds, or Markdown rendering.
- [ ] Show author, server timestamp, text, and an edited marker when applicable.
- [ ] Authors can edit/delete their own messages while they still have conversation access. A group admin can delete channel messages for moderation, but cannot edit another person's words. DM participants cannot delete each other's messages.
- [ ] Deleted messages become a tombstone with their text and reactions removed. Keeping the ID/order makes live updates and history consistent.
- [ ] Use a fixed set of six emoji reactions. Users can add/remove their own reactions; repeated add/remove requests are harmless.
- [ ] Store at most one reaction per `(message, user, emoji)`. Show counts and which reactions the current user selected.
- [ ] Save changes before notifying clients. A failed write must never appear as a successfully sent message.
- [ ] Sending shows pending/sent/failed and a retry action in the test UI. Retrying one logical send creates one message.

### Presence

- [ ] A user is online while at least one authenticated app socket is connected; track connections per user, not a single boolean per tab.
- [ ] Closing one of two tabs keeps the user online. A short disconnect grace period avoids flickering during reconnects.
- [ ] Only authorized friends can query/subscribe to that user's presence. Refresh authorization when friendship/block state changes; do not broadcast presence globally.
- [ ] The final app connects from its shared layout, so online means using the app, not only having the Chat page open.
- [ ] On service interruption, clients show connection status as unknown/reconnecting rather than displaying stale online claims indefinitely.

## 3. Permission baseline

| Action | DM participant | Group member | Group admin | Outsider |
| --- | --- | --- | --- | --- |
| Read/send/react | Own DM, subject to block rules | Own group's channels | Own group's channels | Denied |
| Edit own message | Yes, with current access | Yes | Yes | Denied |
| Delete another user's message | No | No | Within own group's channels | Denied |
| Manage group/channels/members | Not applicable | No; can leave | Yes; preserve at least one admin | Denied |
| View another group's history | No | No | No | Denied |

Authentication answers “who are you?” Membership and role checks answer “may you do this here?” Enforce both on the backend, including list/history/search queries and socket subscriptions. Do not trust sender IDs, role fields, or arbitrary room names supplied by the browser.

## 4. Smallest service design

**User service owns identity, login/refresh, profiles, friendships, and blocks. Chat service owns groups, memberships, conversations, messages, reactions, and live presence.**

- Keep the current NestJS scaffold. Add Prisma/Postgres and a Nest Socket.IO gateway when their build phases begin. Confirm compatible package versions with the existing manifest.
- Give Chat its own database and database credential. It stores user IDs but never queries User service tables directly. A cross-service user ID is not a database foreign key.
- Use explicit authenticated User-service calls for required user-existence, account-status, block, and friendship decisions. Define those small contracts first; they are dependencies, not interfaces already proven to exist.
- For privacy decisions, dependency failure means deny/unavailable, not “assume unblocked.” Bulk profile lookup can degrade to an unavailable-user label without granting extra access.
- For active subscriptions, arrange an authenticated User-to-Chat change notification for blocks, friendships, account disabling/deletion, and explicit session revocation if supported. Re-evaluate affected sockets before further protected delivery. A private Docker network alone does not authenticate the call. Define retries and a resync on reconnect; this integration is part of completion, not an imaginary existing feature.
- Reuse the existing access-token format. Current User service signs RS256 tokens with issuer `user-service` and audience `ft-transcendence-api`. Chat needs the **public verification key only**, with signature, algorithm, issuer, audience, subject, and expiry validation.
- HTTP calls carry the access token as a Bearer token. Socket connections carry it in Socket.IO's authentication payload, never a URL. Keep it in browser memory; refresh remains with User service's HttpOnly-cookie flow.
- Disconnect sockets at token expiry. The client refreshes through User service and reconnects with the new access token. The current HTTP guard cannot be copied unchanged into a socket gateway because its request context differs.
- Start with one Chat process, in-memory socket routing, and in-memory presence. This supports multiple users but not multiple Chat replicas; add a shared adapter/presence store only if deploying replicas.
- Add Chat and its database to Compose, with explicit Nginx API/socket routing and health checks. The inspected Compose file currently does not include Chat.

### REST writes, sockets for live updates

1. Browser sends a REST request to create/edit/delete a message or change a reaction.
2. Chat validates input, identity, membership, and relevant block/role rules.
3. Chat commits the database change and returns the saved result.
4. Chat pushes the change only to currently authorized subscribers.
5. Other clients update by message ID; the sender also merges by ID so its HTTP response and socket event do not duplicate the message.

Use the same pattern for group/channel/member changes. The socket gateway handles authentication and authorized subscriptions; there is no second socket-based message-saving implementation.

Use server-controlled rooms for conversation delivery and per-user updates. [Socket.IO rooms](https://socket.io/docs/v4/rooms/) support targeting subsets of clients; they do not replace your permission checks. Serialize membership removal against channel mutations/delivery so a stale subscription cannot leak later messages.

On reconnect: authenticate again, recheck permissions, subscribe and buffer incoming updates, reload authorized conversation metadata and the current history page, then merge buffered events by ID/version. Invalidate older cached pages so edits/deletions while offline are reflected when reopened. History remains available through pagination. [Socket.IO does not automatically replay missed server events](https://socket.io/docs/v4/delivery-guarantees/), so the database is the recovery source. A database commit followed by a missed broadcast is recoverable through refetch; v1 does not promise durable live-event delivery.

## 5. Data you need

This is a conceptual model to turn into your own Prisma schema, not a finished schema.

| Record | Minimum information / invariant |
| --- | --- |
| Group | ID, name, description/rules, timestamps |
| GroupMember | Group ID, user ID, `ADMIN` or `MEMBER`, joined time; unique group/user pair |
| Conversation | Kind `DM` or `CHANNEL`; a DM has two sorted, distinct user IDs and a unique pair; a channel has group ID, name, optional topic |
| Message | ID, conversation ID, author ID, text, created/edited/deleted times, client request ID; unique author/request ID for safe retries |
| Reaction | Message ID, user ID, allowed emoji; unique message/user/emoji combination |

DM participants are the two IDs on its conversation. Channel access comes from GroupMember. This avoids storing the same membership twice. Enforce valid DM/channel field combinations, foreign keys within Chat, and concurrency-sensitive uniqueness in the database. Preserve last-admin rules with a transaction that locks/serializes changes for the group.

Index message history by conversation and stable order, such as `(createdAt, id)`. History uses bounded cursor pagination: default 30, maximum 100. Bind retry keys to the original conversation/content; reject reuse for a different send. Use a version or equivalent ordering check so stale events cannot overwrite newer edits or resurrect deleted messages.

## 6. Security and integration completion checks

- [ ] Validate all HTTP/socket inputs and bound message length, page size, group/channel counts, subscriptions, and connections per user.
- [ ] Use allowlisted browser origins for HTTP and socket handshakes, TLS externally, and escaped text rendering. Refresh cookies never reach Chat.
- [ ] Reject missing/expired credentials and attempts to spoof authors, roles, conversation IDs, or group IDs.
- [ ] Recheck access for every mutation, history/search request, and subscription; remove stale delivery access on leave/kick/delete/block/account changes.
- [ ] Apply per-user write limits in Chat and connection/subscription limits to sockets. Nginx request limits do not police each message on an established WebSocket.
- [ ] Verify effective Nginx limits on the new routes. The current API setting is 67 requests/minute per IP with burst 10; normal Chat traffic and multiple users behind one IP must remain usable. Treat the number as configuration to test, not an ideal chat limit.
- [ ] Test two simultaneous sends/DM creations, duplicate reaction requests, send retries, and concurrent last-admin changes.
- [ ] Log useful errors and IDs without access tokens, refresh cookies, or message bodies. Keep storage/broker/admin surfaces private.
- [ ] Document account deletion/disable behavior: stop access, remove memberships safely, and apply an explicit retention/anonymization policy to authored history. Resolve a departing last admin by transferring administration or deleting that group.

## 7. Build order and evidence

Finish one phase against its check before moving on. Keep the testing frontend functional and plain.

| Phase | Implement | Proof that it works |
| --- | --- | --- |
| 1. Foundation | Chat database, verified identity, User-service contracts, Compose/Nginx routing | Existing login reaches protected Chat; invalid/expired token fails; Chat cannot access User database |
| 2. Persistent DMs | Unique pair, send/history, permissions, blocks, retry-safe sends | Two accounts exchange text; reload keeps history; third account cannot read it; blocked send fails |
| 3. Realtime + test UI | Authenticated sockets, authorized subscriptions, delivery, reconnection, pending/error states | Two browser sessions update immediately; disconnect/reconnect restores state without duplicate messages |
| 4. Groups and roles | Group CRUD, member management, channels, admin rules, immediate removal from subscriptions | Admin creates/edits/deletes a group and channels; member permissions differ; kicked user's open tab stops receiving data |
| 5. Message actions | Edit/delete and fixed emoji reactions in DMs/channels | All permitted clients update; unauthorized edits fail; retrying reactions leaves correct counts |
| 6. Presence | Connection counting, friend-only presence, integration with existing friends list | Two tabs count as one online user; last disconnect updates friends; unauthorized watchers get no status |
| 7. Optional search (+1 candidate) | Text search scoped to an accessible conversation; author/date filters, oldest/newest sort, bounded pagination | UI demonstrates every option; outsiders cannot retrieve text or counts; membership loss revokes search |
| 8. Final frontend | Move proven contracts into the full Next.js app; finish profile/friend links, group controls, accessible responsive states | Full module journeys work without test-only buttons or manual API calls |

Use the existing test tooling for focused integration tests: authorized success, outsider/member denial, malformed input, concurrent invariants, and reconnect behavior. Browser demonstrations supplement those tests. A passing build alone does not prove the feature works.

**First concrete milestone:** Alice and Bob can log in, open one persistent DM, exchange messages live, and reload its history; Charlie cannot access it. Build this before groups.

## 8. Deliberately later

- Full notification inbox: build after Chat and Feed actions are defined. Inventory message/group/channel/member/reaction changes for that integration; live delivery alone is not notification persistence. Add reliable event publishing and duplicate handling when the notification consumer exists.
- Advanced-chat point: coordinate a game-invite/event contract with the game teammate, then add the complete missing set including typing/read receipts. No game implementation is assigned to you here.
- Uploads/voice notes, live calls, threads, pinned messages, custom emoji, channel-specific permissions, bots, nicknames, custom roles, invite links, and public group discovery.
- Redis, multiple Chat replicas, a search engine, a generic permission framework, and event-sourcing infrastructure.

**Stop expanding Chat once DMs, groups/channels, roles, reactions, realtime recovery, and presence pass their checks.** Search is the small optional points-focused addition. Then move to Feed and notifications; finish the production frontend after the service contracts are exercised.

## Inspection basis

- [Local module tracker](../requirements/index.html): module names, values, and completion criteria; original subject still governs evaluation.
- [Product context](../PROJECT_CONTEXT.md): broader product wishlist, narrowed above by your current request.
- [Chat scaffold](src/app.module.ts) and [manifest](package.json): currently starter NestJS code, not a working chat implementation.
- [Compose](../compose.yaml): existing deployment boundaries; Chat integration remains to be added.
- [Token configuration](../user-service/src/auth/auth.module.ts) and [HTTP guard](../user-service/src/auth/guards/access-token.guard.ts): existing authentication contract, verified directly after consulting the code graph.
- [Social service](../user-service/src/social/social.controller.ts): existing friendship and block operations to integrate rather than duplicate.
- [Nginx configuration](../nginx/default.conf): current request limits and routing to revisit when Chat is connected.
