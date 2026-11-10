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
| `src/events/` | RabbitMQ consumer for user events |
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
| `Message` | Content up to 2000 characters, `attachments String[]`, `createdAt`, `editedAt`, `deletedAt`, `clientRequestId`, `requestHash`, `version` |
| `ConversationReadState` | One row per conversation and user, with `lastReadMessageId` |
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
| `POST /chat/conversations/:id/messages` | Send, with `content`, `clientRequestId`, optional `attachments` (max 5) |
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

The client generates one `clientRequestId` per logical send. The server computes `requestHash` as the SHA-256 of `[conversationId, content, attachments]`.

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
| `RABBITMQ_*` | Broker connection |
| `MINIO_*`, `MINIO_PUBLIC_*` | Storage. See [chat-storage](../integrations/chat-storage.md). |

## Commands and tests

Run `npm run start:dev`, `npm run build`, `npm run lint` and `npm test` from `chat-service/`. Container startup runs `prisma migrate deploy` before starting Node.

`test/dm.postgres.test.mjs` reads `prisma/constraints.sql`, which is no longer in the repository, so that suite needs fixing before it can run. `test/chat.service.spec.ts` has two type errors because `sendMessage` gained a parameter.

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
