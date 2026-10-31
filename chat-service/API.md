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
- the target must already exist as a non-deleted `ChatUser`

The two participant UUIDs are sorted before lookup, so both users resolve to the
same DM row. An existing conversation is returned; otherwise it is created.

Responses:

- `201 Created`: existing or newly created conversation
- `400 Bad Request`: invalid body
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: target user is missing or deleted from Chat's local user copy
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
    "topic": null
  }
]
```

The current implementation does not include group channels, participant
profiles, latest-message summaries, read state, unread counts, or guaranteed
ordering in this response.

Responses:

- `200 OK`: array of direct conversations
- `401 Unauthorized`: missing, invalid, or expired access token

### Send a message

`POST /chat/conversations/:conversationId/messages`

Requires an access token. The authenticated user must be a DM participant.

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

Responses:

- `201 Created`: stored message
- `400 Bad Request`: invalid body
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: conversation is missing or the caller is not a DM participant
- `409 Conflict`: client request ID was already used with another payload

Current limitation: a same-payload retry returns only `{ "requestHash": "..." }`
instead of the original message. The check and insert are also not yet protected
against two concurrent requests racing on the database uniqueness constraint.

### Load message history

`GET /chat/conversations/:conversationId/messages?limit=50&before=<messageId>`

Requires an access token. The caller must be a DM participant or a member of the
conversation's group.

Query parameters:

- `limit`: optional integer from 1 to 100; defaults to `50`
- `before`: optional UUID of the message used as the Prisma cursor

The first request omits `before`. For an older page, the client passes a message
ID returned by the previous page.

Current response (`200 OK`) is a raw message array ordered newest first:

```json
[
  {
    "id": "6681dc8a-eb00-4502-abc4-24706c2fa433",
    "conversationId": "1ee9b51b-c93d-45da-ab9d-03eb1a76302d",
    "authorId": "90299aa4-f556-4337-9c98-74e4d215fa29",
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

The message must belong to the supplied conversation, and the authenticated user
must be a DM participant. Chat upserts one `ConversationReadState` row using the
composite key `(conversationId, userId)`.

Responses:

- `200 OK`: marker saved; current response has no JSON body
- `400 Bad Request`: invalid conversation or message UUID
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: message is not in the conversation, or conversation is missing
  or inaccessible

Current limitation: read-state access currently supports DMs only, even though
message history also recognizes group membership. The marker can move backward;
monotonic advancement has not yet been implemented.

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

No client or server application events are implemented yet. OpenAPI describes
HTTP request/response operations only; add an AsyncAPI document when live chat
events are defined.

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
```

## Current limitations

- User synchronization and RabbitMQ consumption are planned but not implemented.
- Conversation listing has no unread count or last-read marker yet.
- Message pagination does not return a finished cursor envelope.
- Read markers are not monotonic yet.
- Message delete, reactions, group management, live delivery, presence, and
  heartbeat/activity behavior are not implemented.
- The Socket.IO namespace authenticates connections but defines no chat events.
