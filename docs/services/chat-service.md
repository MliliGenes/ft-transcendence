# Chat service

NestJS, Prisma, PostgreSQL and Socket.IO service that owns conversations, messages, read state, groups, channels, presence and attachment authorization. Inside Compose it listens on `chat-service:3000`. Browsers reach it at `https://localhost/api/chat/`.

Related documents: [user-chat integration](../integrations/user-chat.md) (identity, RabbitMQ, HTTP fallback), [chat-storage integration](../integrations/chat-storage.md) (MinIO), [feed integration](../integrations/feed.md), and the [OpenAPI spec](../api/chat-service.openapi.json).

## Source map

| Source | Responsibility |
| --- | --- |
| `src/main.ts`, `src/app.module.ts` | Bootstrap, global validation, module wiring |
| `src/auth/` | JWT verification and `AuthGuard` |
| `src/chat/chat.controller.ts`, `chat.service.ts` | DMs, messages, read state, attachment URLs |
| `src/chat/ensure-active-user.guard.ts` | Makes sure the caller has an active `ChatUser` row |
| `src/chat/user-profiles.service.ts` | Profile fallback and block checks over HTTP |
| `src/chat/groups/` | Groups, members, roles, channels |
| `src/chat/gateway/chat.gateway.ts` | Socket.IO connection, rooms, broadcasts |
| `src/chat/presence/` | In-memory online status and its audience |
| `src/chat/game-notifications.service.ts` | Code Arena lifecycle notifications written from game events |
| `src/chat/game-rooms.client.ts` | Checks Code Arena room membership with the Game service |
| `src/events/` | RabbitMQ consumers for user events and game events |
| `src/feed/` | Global feed group, membership, per-user posts |
| `src/minio/` | MinIO clients, signed URLs, object checks |
| `prisma/schema.prisma` | Data model |

## Data model

| Model | Purpose |
| --- | --- |
| `ChatUser` | Local copy of a public profile. `id` is the user-service UUID. Holds `sourceUpdatedAt` and `deletedAt`. |
| `Group` | Name, description, rules |
| `GroupMember` | Membership with a per-group `ADMIN` or `MEMBER` role |
| `Conversation` | `DM` (two sorted user IDs) or `CHANNEL` (`groupId`, `name`, `topic`) |
| `Message` | Content up to 2000 characters, `attachments String[]`, `createdAt`, `editedAt`, `deletedAt`, `clientRequestId`, `requestHash`, `version`, and `kind` (`USER` or `SYSTEM`) |
| `ConversationReadState` | One row per conversation and user, with `lastReadMessageId` |
| `GameChallenge` | Links a Code Arena room code to the conversation that carries the invitation, plus the match it started |
| `Reaction` | Schema only, no API yet |

There are no foreign keys across databases. `ChatUser` is the boundary with user-service.

## Authentication

Protected HTTP endpoints require an RS256 access token issued by user-service:

```http
Authorization: Bearer <accessToken>
```

Chat verifies the signature with the public key and requires:

- `alg`: `RS256`
- `iss`: `user-service`
- `aud`: `ft-transcendence-api`
- `sub`: a UUID identifying the user-service account
- `exp`: a numeric expiration claim

Chat does not issue or refresh tokens. Missing, invalid or expired tokens return `401 Unauthorized`. Every `/chat` route also runs `EnsureActiveUserGuard`, which rejects users that are unknown or marked deleted.

## HTTP routes

Paths are as the service sees them. Through the gateway, `/chat/...` becomes `/api/chat/...`.

| Route | Result |
| --- | --- |
| `POST /chat/conversations/dm` | Existing or new DM with `userId` |
| `GET /chat/conversations` | Caller's DMs with `lastReadMessageId` and `unreadCount` |
| `POST /chat/conversations/:id/messages` | Send, with `content`, `clientRequestId`, optional `attachments` (max 5) and optional `gameChallenge: { roomCode }` |
| `GET /chat/conversations/:id/messages` | History, newest first, `limit` 1-100 (default 50), `before` |
| `PATCH /chat/conversations/:id/read-state` | Save the read marker |
| `PATCH /chat/messages/:id` | Edit own message |
| `DELETE /chat/messages/:id` | Soft-delete own message |
| `POST /chat/conversations/:id/attachments/upload-url` | Signed upload policy |
| `GET /chat/conversations/:id/attachments/preview-url`, `/download-url` | Signed read URLs |
| `GET /chat/feed` | Feed `groupId` and `channelId`, joins the caller |
| `GET /chat/feed/users/:userId/posts` | One author's feed posts |
| `POST`, `GET /chat/groups` | Create, list own groups |
| `GET`, `PATCH`, `DELETE /chat/groups/:groupId` | Read, edit, delete |
| `GET`, `POST /chat/groups/:groupId/members` | List, add |
| `PATCH /chat/groups/:groupId/members/:userId/role` | Change role |
| `DELETE /chat/groups/:groupId/members/me`, `/:userId` | Leave, remove |
| `POST`, `GET /chat/groups/:groupId/channels` | Create, list with unread counts |
| `GET`, `PATCH`, `DELETE /chat/groups/:groupId/channels/:channelId` | Read, edit, delete |

## Messages

### Sending and retries

The client generates one `clientRequestId` per logical send. The server computes `requestHash` as the SHA-256 of `[conversationId, content, attachments, gameChallengeRoomCode]`.

| Request | Result |
| --- | --- |
| New `(authorId, clientRequestId)` | Save and broadcast `message:created` |
| Same identity and same hash | Return the stored message, no new broadcast |
| Same identity, different hash | `409 Conflict` |

### History

Results are ordered by `createdAt` then `id`, descending. `before` is a message UUID used as a cursor. The response is a raw array of up to `limit + 1` rows, and the client treats the extra row as "there is more".

### Editing and deleting

Only the author can edit or delete, and edits need 1 to 2000 characters. An edit sets `editedAt` and increments `version`. A delete clears `content`, sets `deletedAt` and increments `version`. The row stays, and its `attachments` array is kept, but the files can no longer be opened through the API.

### Read state and unread counts

The read marker is an upsert on `ConversationReadState`. Unread means messages from someone else, not deleted, after the marker in `(createdAt, id)` order. The count is calculated on each request.

## Direct messages

The two user IDs are lowercased and sorted, so A-B and B-A are the same conversation. Before creating or using a DM, chat asks user-service whether either user has blocked the other. See [user-chat integration](../integrations/user-chat.md).

## Code Arena lifecycle notifications

Game events are announced in the conversation that carries the Code Arena challenge. The Game service owns match state and never writes to the Chat database: it publishes authoritative events on the `game.events` exchange and Chat turns them into ordinary messages.

### Linking a challenge to a conversation

A Code Arena invitation is a normal chat message. The client sends the private-room invite code with it:

```json
{
  "content": "🎮 Code Arena challenge\n\n[Accept & Join](/play/lobby/AB12CD)",
  "clientRequestId": "uuid-v4",
  "gameChallenge": { "roomCode": "AB12CD" }
}
```

`roomCode` must match `^[A-Z0-9]{6}$`; anything else is rejected with `400`.

The code alone does not authorize anything. Before Chat writes the message it asks the **Game service**, which owns rooms and their membership:

1. `GET {GAME_SERVICE_URL}/lobby/rooms/lookup/:code` resolves the invite code to a room.
2. `GET {GAME_SERVICE_URL}/lobby/rooms/:id` is read with the **caller's own access token**. The Game service refuses a non-member with `403`, so membership is decided by the service that owns the room, not by the browser and not to Chat. The answer is `{ ok, room: { id, code, ownerUserId, ... }, members: [...] }`, so the owner is read from `room.ownerUserId`.
3. The room record the Game service returns names its owner. Only that account may announce the room, because only that account created the challenge; the client always creates the room it announces.

An account that is not in the room, or that is in the room but did not create it, gets `403` and the request writes **nothing**: no message and no `GameChallenge` row. A room code that another conversation already owns gets `409`, and the message is rolled back with it: the binding is checked inside the same transaction that writes the message, so two conversations claiming one code at once leave exactly one message and one binding. The first invitation for a room code owns the link; a later post cannot move it.

An idempotent replay returns the stored message and writes nothing: it never recreates a missing binding, because a binding is only written together with the message it belongs to and only after the room was checked.

If the Game service cannot answer, the request fails with `503` and nothing is written: an unknown answer is never treated as a permission.

### Events that Chat consumes

| Event | Routing key | Meaning |
| --- | --- | --- |
| Match started | `game.match.started` | The room started a match. Carries `matchId`, `mode`, `roomCode` and the participants. |
| Match ended | `game.match.ended` | The match reached a result. Carries per-participant `outcome` and public `score`, plus the forfeit record when there is one. |
| Challenge cancelled | `game.challenge.cancelled` | The challenge will not produce a match: the owner withdrew the room, or the invite window closed. |

Chat validates every payload (`src/events/game-event.ts`); anything that does not match the contract is discarded. The payload never contains source code, editor state or hidden test data.

### What is written

A notification is an ordinary `Message` with `kind = SYSTEM`, written by the system account `0000a11e-0000-4000-8000-000000000000` (`Code Arena`). It is stored in the conversation, counts as unread and is broadcast live like any other message. The content has three lines:

```
🎮 Code Arena
match-result · alice won 300 – 225
[View match](/play/match/2f1c9d0e-6b3a-4f2e-9a7d-8c5b1e4a2f30)
```

The client parses this shape (`client/lib/arena/game-notifications.ts`) and renders a card with a link to the match. A user message can never be rendered as a notification, because only `kind = SYSTEM` messages are parsed that way.

### Correlation checks

Before anything is written, Chat re-checks the link:

| Check | Result when it fails |
| --- | --- |
| The room code or match id is linked to a conversation | The event is ignored; no message is written |
| Every participant of the event is a member of that conversation | The event is rejected; no message is written |
| The link does not already point at a different match | The event is rejected |

Members of the linked conversation are the recipients, so the notification lands with the intended participants and with nobody else.

### Replay safety

The notification's `clientRequestId` is derived from the conversation and the event (`match-started:<matchId>`, `match-result:<matchId>`, `challenge-cancelled:<roomCode>`). The unique index on `(authorId, clientRequestId)` therefore turns a redelivered or replayed event into a no-op: the stored message is returned unchanged and nothing is broadcast a second time. Reconnect and re-delivery therefore never produce repeated notifications.

### Boundaries

- Notifications follow the conversation, so a member who blocked the other party still cannot read the conversation: the block check in `getAccessibleConversation` runs for DM reads and sends.
- Matches started from the matchmaking queue have no linked conversation and are not announced in chat; they are announced in the game itself.
- The Game service and Chat service never read each other's database.
- The Game service publishes its events without blocking gameplay and in order, so a broker outage cannot delay a match and a start is never announced after its result. Delivery is **best effort**: the Game service has no transactional outbox, so an event the broker never confirms after the bounded retries is lost, and a Game service restart does not replay past events. Events that *were* published are durable, so the broker keeps them while Chat is down. An expiry the broker did not confirm is not remembered, so the next sweep publishes it again.

## Groups and channels

- Creating a group makes the creator `ADMIN` and creates a `general` channel in one write.
- Adding members is admin-only. There is no self-join path, except the [feed](../integrations/feed.md).
- Group edit, delete, member management and channel management are admin-only.
- Any member can read channels and send messages.
- Non-members get `404`, and members without the admin role get `403`.
- Removing or demoting the last admin returns `409`. Those operations run in a Serializable transaction.

## Socket.IO

The namespace is `/chat`. Browsers connect through the gateway with the transport path `/api/chat/socket.io/` and pass the JWT in the handshake:

```js
const socket = io(`${window.location.origin}/chat`, {
  path: "/api/chat/socket.io/",
  auth: { token: accessToken },
});
```

The gateway applies the same token rules as HTTP and joins the socket to the private room `user:<sub>`. Clients cannot choose a room.

| Event | Direction | Payload |
| --- | --- | --- |
| `message:created` | Server to client | Full stored message with `author` |
| `presence:snapshot` | Server to client | `{ users: [{ userId, status }] }` |
| `presence:changed` | Server to client | `{ userId, status }` |
| `presence:activity` | Client to server | None |

`message:created` goes to both DM participants, or to every member of the channel's group, including the sender so their other tabs update. Delivery is best effort. REST is the only way to write messages, and clients refetch history to catch up.

### Presence

Status is `ONLINE` when a connected socket had activity in the last 5 minutes, `AWAY` when sockets remain connected without recent activity, and `OFFLINE` after the last socket disconnects. Idle transitions are checked every 15 seconds. Presence is held in memory and resets when the service restarts. The audience is the user's DM partners and members of their groups.

## Error shape

Nest errors normally use this JSON shape:

```json
{
  "statusCode": 400,
  "message": ["limit must not be greater than 100"],
  "error": "Bad Request"
}
```

`message` can be a string or an array of validation messages.

## Configuration

| Setting | Meaning |
| --- | --- |
| `PORT` | Listening port, 3000 in Compose |
| `POSTGRES_*` | Chat's own database |
| `JWT_PUBLIC_KEY` | Public half of user-service's signing key |
| `USER_SERVICE_URL` | Internal URL for profile and block checks |
| `GAME_SERVICE_URL` | Internal URL of the Game service, used to check Code Arena room membership |
| `RABBITMQ_*` | Broker connection |
| `MINIO_*`, `MINIO_PUBLIC_*` | Storage. See [chat-storage](../integrations/chat-storage.md). |

## Commands and tests

Run `npm run start:dev`, `npm run build`, `npm run lint` and `npm test` from `chat-service/`. Container startup runs `prisma migrate deploy` before starting Node.

`npm test` runs the Vitest suites, including `test/game-notifications.spec.ts` (event validation, correlation checks, replay safety and the payload privacy rule). `test/dm.postgres.test.mjs` and `test/game-notifications.postgres.test.mjs` need a disposable PostgreSQL database; the project gate runs them in `npm run check`, where the notification suite also proves the RabbitMQ round trip against the disposable broker.

## Current limitations

- Only message creation is broadcast. Edits, deletes and read state reach other clients when they refetch.
- A group has no moderation: nobody can delete another member's message.
- Reactions have a table but no API, and there are no replies.
- A self-DM throws a plain `Error`, which returns `500` instead of `400`.
- Two simultaneous first requests for the same DM, or the same `clientRequestId`, can hit the unique constraint and return `500`.
- Read markers can move backward, because the upsert does not compare positions.
- Message pagination returns a raw array with a look-ahead row rather than a cursor envelope.
- Group channels are not in `/chat/conversations`. Use the group's channel list for their unread counts.
- An already connected socket is not disconnected when its token expires.
- Presence and socket rooms live in one process, so running several chat instances would need a shared adapter.
