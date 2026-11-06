# Chat Service API

Base URL: `http://localhost:3000`

Request bodies use JSON. The global validation pipe transforms supported query
values, removes no declared fields, rejects unknown body fields, and returns
`400 Bad Request` for invalid input.

This document describes the current source behavior. Routes marked as current
limitations are not yet part of the usable MVP contract.

## Authentication

Protected HTTP endpoints require an RS256 access token issued by User service:

```http
Authorization: Bearer <accessToken>
```

Chat verifies the JWT signature and requires:

- `alg`: `RS256`
- `iss`: `user-service`
- `aud`: `ft-transcendence-api`
- `sub`: a UUID identifying the User-service account
- `exp`: a numeric expiration claim

Chat does not issue or refresh tokens. Missing, invalid, or expired tokens return
`401 Unauthorized`.

All `/chat/groups` endpoints also run `EnsureActiveUserGuard` after JWT
authentication. The caller must still be an active user in User service; group
membership and admin permissions are checked separately for each operation.

## Endpoints

### Service root

`GET /`

Public health-style placeholder route.

Response (`200 OK`):

```json
{
  "message": "AM I THE BEST CAUSE I AM SAAD OR AM I SAD CAUSE I AM THE BEST?"
}
```

### Create or get a direct conversation

`POST /chat/conversations/dm`

Requires an access token. The authenticated user comes from the JWT; only the
other participant is supplied by the client.

Request:

```json
{
  "userId": "4a13e0f8-8632-489a-b85a-552d886b41ea"
}
```

Validation:

- `userId`: UUID
- unknown body fields are rejected
- both users must exist in User service and must not be locally deleted

If either user is missing from Chat's local profile copy, Chat fetches the public
profile from User service and creates the local `ChatUser` before creating the
DM. This is a lazy bootstrap path; RabbitMQ remains responsible for later profile
updates and deletion synchronization.

The two participant UUIDs are sorted before lookup, so both users resolve to the
same DM row. An existing conversation is returned; otherwise it is created.

Responses:

- `201 Created`: existing or newly created conversation
- `400 Bad Request`: invalid body
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: either user is missing or locally deleted
- `503 Service Unavailable`: User service could not bootstrap a missing profile
- `500 Internal Server Error`: current self-DM rejection uses a generic error

### List direct conversations

`GET /chat/conversations`

Requires an access token. Returns conversations where the authenticated user is
`dmUserAId` or `dmUserBId`.

Response (`200 OK`):

```json
[
  {
    "id": "1ee9b51b-c93d-45da-ab9d-03eb1a76302d",
    "kind": "DM",
    "createdAt": "2026-10-31T05:20:00.000Z",
    "updatedAt": "2026-10-31T05:20:00.000Z",
    "dmUserAId": "4a13e0f8-8632-489a-b85a-552d886b41ea",
    "dmUserBId": "90299aa4-f556-4337-9c98-74e4d215fa29",
    "groupId": null,
    "name": null,
    "topic": null,
    "dmUserA": {
      "id": "4a13e0f8-8632-489a-b85a-552d886b41ea",
      "username": "alice",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "dmUserB": {
      "id": "90299aa4-f556-4337-9c98-74e4d215fa29",
      "username": "student42",
      "displayName": "Student",
      "avatarUrl": null
    },
    "lastReadMessageId": "4d0d1050-9c8d-4ae6-b734-5d2f33e0750b",
    "unreadCount": 3
  }
]
```

`lastReadMessageId` is `null` until the caller marks a message as read.
`unreadCount` counts non-deleted messages from other users after that marker,
using `(createdAt, id)` as the stable message order. Without a marker, every
non-deleted message from another user is unread.
Each DM also includes `dmUserA` and `dmUserB` public profile summaries with
`id`, `username`, `displayName`, and `avatarUrl`, so the frontend can display
the other participant without using their UUID as the label.

The current implementation does not include group channels, latest-message
summaries, or guaranteed ordering in this response.

Responses:

- `200 OK`: array of direct conversations
- `401 Unauthorized`: missing, invalid, or expired access token

### Send a message

`POST /chat/conversations/:conversationId/messages`

Requires an access token. The authenticated user must be a participant in the DM,
or a current member of the group that owns the channel.

Request:

```json
{
  "content": "Hello from the chat service",
  "clientRequestId": "908a6c18-78fc-45bf-9677-d5c7eb1317d3"
}
```

Validation:

- `content`: trimmed string, 1-2,000 characters
- `clientRequestId`: UUID generated once by the client for one logical send and
  reused if that send is retried
- unknown body fields are rejected

Chat computes a SHA-256 request hash from the conversation ID and content.
Reusing the same `(authorId, clientRequestId)` with different content returns
`409 Conflict` and prevents the second write.
The response and `message:created` event include the author's public profile
summary (`id`, `username`, `displayName`, and `avatarUrl`).

Responses:

- `201 Created`: stored message
- `400 Bad Request`: invalid body
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: conversation is missing or inaccessible to the caller
- `409 Conflict`: client request ID was already used with another payload

An identical retry returns the existing message and does not emit another
socket event. The check and insert are not yet protected against concurrent
requests racing on the database uniqueness constraint.

### Load message history

`GET /chat/conversations/:conversationId/messages?limit=50&before=<messageId>`

Requires an access token. The caller must be a DM participant or a member of the
conversation's group.

Query parameters:

- `limit`: optional integer from 1 to 100; defaults to `50`
- `before`: optional UUID of the message used as the Prisma cursor

The first request omits `before`. For an older page, the client passes a message
ID returned by the previous page.

Current response (`200 OK`) is a raw message array ordered newest first. Each
message includes the author's public profile summary (`id`, `username`,
`displayName`, and `avatarUrl`):

```json
[
  {
    "id": "6681dc8a-eb00-4502-abc4-24706c2fa433",
    "conversationId": "1ee9b51b-c93d-45da-ab9d-03eb1a76302d",
    "authorId": "90299aa4-f556-4337-9c98-74e4d215fa29",
    "author": {
      "id": "90299aa4-f556-4337-9c98-74e4d215fa29",
      "username": "student42",
      "displayName": "Student",
      "avatarUrl": null
    },
    "content": "Newest message",
    "createdAt": "2026-10-31T06:38:49.525Z",
    "editedAt": null,
    "deletedAt": null,
    "clientRequestId": "f5a049b6-82af-49f4-b440-037b12e19a8c",
    "requestHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "version": 1
  }
]
```

Responses:

- `200 OK`: raw message array
- `400 Bad Request`: invalid conversation ID or query parameters
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: conversation is missing or inaccessible to the caller

Current limitation: the database query fetches `limit + 1` records for lookahead,
but the extra record is not removed and no `hasMore` or `nextBefore` metadata is
returned yet. A supplied cursor is not explicitly checked to belong to the same
conversation. The intended envelope will be documented after it is implemented.

### Mark a message as read

`PATCH /chat/conversations/:conversationId/read-state`

Requires an access token. The user ID comes from the JWT.

Request:

```json
{
  "messageId": "6681dc8a-eb00-4502-abc4-24706c2fa433"
}
```

The message must belong to the supplied conversation, and the authenticated
user must be a DM participant or a member of the conversation's group. Chat
upserts one `ConversationReadState` row using the composite key
`(conversationId, userId)`.

Responses:

- `200 OK`: marker saved; current response has no JSON body
- `400 Bad Request`: invalid conversation or message UUID
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: message is not in the conversation, or conversation is missing
  or inaccessible

For group channels, the caller must be a current member of the group that owns
the conversation. `GET /chat/groups/:groupId/channels` returns each channel's
`lastReadMessageId` and `unreadCount` using the same rules as the DM list. The
marker can move backward; monotonic advancement has not yet been implemented.

### Edit a message

`PATCH /chat/messages/:messageId`

Requires an access token. Only the original author can edit a message, and a
soft-deleted message cannot be edited.

Request:

```json
{
  "content": "Updated message content"
}
```

Validation:

- `messageId`: UUID v4
- `content`: trimmed string, 1-2,000 characters
- unknown body fields are rejected

A successful edit replaces `content`, sets `editedAt` to the current time, and
atomically increments `version` by one.

Responses:

- `200 OK`: updated message
- `400 Bad Request`: invalid message ID or body
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: message is missing, deleted, or owned by another user

### Delete a message

`DELETE /chat/messages/:messageId`

Requires an access token. Only the original author can delete a message.
Deletion is soft: Chat clears `content`, sets `deletedAt`, and atomically
increments `version`. The message row remains available so history ordering and
read markers stay stable.

Responses:

- `204 No Content`: message deleted
- `400 Bad Request`: invalid message UUID
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: message is missing, already deleted, or owned by another user

## Groups and channels

All routes below require an access token and an active caller. The caller's
identity is taken from the verified JWT. Group and channel IDs must be UUIDs.
Membership is required to read a group's details, member list, or channels.
Only group admins can edit/delete the group, add/remove other members, change
member roles, and create/edit/delete channels. A member who is not in the group
receives `404 Not Found`; a regular member attempting an admin action receives
`403 Forbidden`.

### Create a group

`POST /chat/groups`

Request:

```json
{
  "name": "Study group",
  "description": "Study notes",
  "rules": "Be respectful"
}
```

`name` is required and is trimmed to 1–100 characters. `description` and
`rules` are optional nullable strings of up to 1,000 and 4,000 characters.
Creation makes the caller an `ADMIN` and creates a `general` channel as part of
the same database write. The response includes the group and its initial
channel summary.

### List groups

`GET /chat/groups`

Returns the caller's groups, the caller's role in each group, and channel
summaries. It does not expose groups the caller has not joined.

### Get, edit, or delete a group

- `GET /chat/groups/:groupId` returns group details and channel summaries to a
  member.
- `PATCH /chat/groups/:groupId` lets an admin update `name`, `description`, or
  `rules`. Only supplied fields change; nullable description/rules can be set to
  `null` to clear them.
- `DELETE /chat/groups/:groupId` lets an admin delete the group. The response is
  `204 No Content`; related channels and messages are removed through database
  cascades.

Unknown fields are rejected.

### List and manage members

- `GET /chat/groups/:groupId/members` returns `role`, `joinedAt`, and public
  profile fields (`id`, `username`, `displayName`, `avatarUrl`) for each member.
- `POST /chat/groups/:groupId/members` lets an admin add an existing active
  user by `userId`:

  ```json
  { "userId": "4a13e0f8-8632-489a-b85a-552d886b41ea" }
  ```

  New members receive the `MEMBER` role. Adding an existing member returns
  `409 Conflict`; an unavailable User service returns `503`.
- `PATCH /chat/groups/:groupId/members/:userId/role` lets an admin set the role
  to `ADMIN` or `MEMBER`:

  ```json
  { "role": "ADMIN" }
  ```

- `DELETE /chat/groups/:groupId/members/me` lets the caller leave.
- `DELETE /chat/groups/:groupId/members/:userId` lets an admin remove a member.

The last admin cannot leave, be removed, or be demoted. These operations return
`409 Conflict` until another member is promoted or the group is deleted.
Invitations are not implemented; admins add users directly.

### List and manage channels

- `GET /chat/groups/:groupId/channels` returns channels in creation order with
  the caller's `lastReadMessageId` and `unreadCount`.
- `GET /chat/groups/:groupId/channels/:channelId` returns one channel belonging
  to the group.
- `POST /chat/groups/:groupId/channels` lets an admin create a text channel:

  ```json
  { "name": "announcements", "topic": "Group updates" }
  ```

  `name` is required and trimmed to 1–80 characters; `topic` is an optional
  nullable string up to 500 characters.
- `PATCH /chat/groups/:groupId/channels/:channelId` lets an admin update the
  channel name and/or topic. Omitted values stay unchanged; `topic: null`
  clears the topic.
- `DELETE /chat/groups/:groupId/channels/:channelId` lets an admin delete the
  channel and its related messages. It returns `204 No Content`.

Group membership is checked before channel reads, and mutations are scoped to
the requested group and channel pair. Channel unread counts include non-deleted
messages from other members after the caller's marker.

## Socket.IO

Chat exposes the Socket.IO namespace `/chat`. Connect with the User-service JWT
in the handshake auth object:

```js
const socket = io("http://localhost:3000/chat", {
  auth: { token: accessToken }
});
```

The gateway verifies the same RS256 issuer/audience contract as HTTP and joins
the socket to the private room `user:<sub>`. Missing or invalid tokens reject the
connection with `Unauthorized`.

After a new message is stored successfully, the server emits `message:created`
to the private user rooms of both DM participants, or to each current member of
the group that owns the channel. This includes the sender so their other tabs
and devices update. The payload is the complete stored `Message` object
returned by the send endpoint.

An idempotent retry returns the existing message and does not emit another
event. Socket delivery is best effort: after reconnecting, clients reload
authoritative message history through HTTP and deduplicate by `id` or
`clientRequestId`.

### Presence events

Clients may emit `presence:activity` with no payload after visible user activity.
The authenticated socket identity determines the user; the server ignores
client-supplied user IDs. Clients should throttle events (the test frontend sends
at most one every 30 seconds).

On connect, the server emits `presence:snapshot` to that user's private room with
the current statuses of the user, their DM partners, and members of their groups:

```json
{ "users": [{ "userId": "...", "status": "ONLINE" }] }
```

When a status changes, `presence:changed` with
`{ "userId": "...", "status": "ONLINE" }` is sent to the user's private
room and the private rooms of their DM partners and group members. Status is
`ONLINE` while any connected socket has activity in the last five minutes,
`AWAY` when sockets remain connected without recent activity, and `OFFLINE`
after the final socket disconnects. The server checks for idle transitions every
15 seconds. Socket.IO ping/pong detects a lost connection; it does not count as
user activity.

Presence is held in memory and resets when Chat restarts. Audience membership is
read from Chat's DM and group records when a user connects or their status
changes.

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

## Example flow

```bash
# Create or retrieve a DM.
curl -X POST http://localhost:3000/chat/conversations/dm \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"4a13e0f8-8632-489a-b85a-552d886b41ea"}'

# Send one logical message. Reuse clientRequestId only when retrying this send.
curl -X POST http://localhost:3000/chat/conversations/<conversationId>/messages \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello","clientRequestId":"908a6c18-78fc-45bf-9677-d5c7eb1317d3"}'

# Load the newest page.
curl "http://localhost:3000/chat/conversations/<conversationId>/messages?limit=50" \
  -H "Authorization: Bearer <accessToken>"

# Save the last message actually read by the user.
curl -X PATCH http://localhost:3000/chat/conversations/<conversationId>/read-state \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"6681dc8a-eb00-4502-abc4-24706c2fa433"}'

# Edit one of your own messages.
curl -X PATCH http://localhost:3000/chat/messages/<messageId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Updated message content"}'

# Soft-delete one of your own messages.
curl -X DELETE http://localhost:3000/chat/messages/<messageId> \
  -H "Authorization: Bearer <accessToken>"
```

## Current limitations

- Chat consumes `user.created`, `user.updated`, and `user.deleted` from the
  durable `chat.user-events` RabbitMQ queue. It applies only events newer than
  the local `sourceUpdatedAt`, clears profile fields on deletion, and keeps a
  tombstone for deleted IDs. DM creation retains lazy public-profile bootstrap
  for users that predate the queue or whose creation event was missed.
- Message pagination does not return a finished cursor envelope.
- Read markers are not monotonic yet.
- Reactions, presence, and heartbeat/activity behavior are not implemented.
- Group channels are not included in `/chat/conversations`; use the group's
  channel list for channel read markers and unread counts.
- Live delivery passed a sender-room smoke test but not yet a two-participant
  browser isolation test.
