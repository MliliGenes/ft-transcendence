# CHAT-02: persistent direct messages

Status: Chat-side implementation, verified against isolated PostgreSQL and a
strict temporary User-service HTTP fixture. Real teammate integration remains
pending CHAT-01 credentials/endpoints. No User-service code or actual .env was
changed. No Socket.IO, frontend or group management API is added in this phase.

## What each piece means

- `src/conversations/conversations.controller.ts` is the HTTP entrance: it checks
  request fields and calls the service. A controller connects a URL to a function.
- `src/conversations/conversations.service.ts` contains the rules and database work.
  It reads the caller ID supplied by the JWT guard, never a submitted author ID.
- `src/conversations/pagination.ts` reads bounded page options. A cursor marks
  where the previous page ended; clients pass it back to get the next page.
- `ConversationsModule` registers these classes with Nest, like connecting a
  compiled component to the application. `AppModule` imports it.
- `UserServiceClient.assertUnblocked` asks the identity owner about privacy.
  It does not query the User database or store a block cache.

A transaction saves the message and updates conversation activity together. If
one operation fails, PostgreSQL rolls the transaction back. A unique constraint
allows only one DM per sorted pair and one message per author/request UUID.
These database rules also hold when simultaneous HTTP requests arrive.

## HTTP contract

All routes require `Authorization: Bearer <accessToken>` and return JSON.
Through the shared gateway prepend `/api` to the paths below.

| Method | Path | Input | Result |
| --- | --- | --- | --- |
| POST | `/chat/dms` | `{ "userId": "other-user-uuid" }` | 201, existing or newly created conversation |
| GET | `/chat/conversations` | optional `limit`, `cursor` | 200, `{ items, nextCursor }` |
| GET | `/chat/conversations/:id/messages` | optional `limit`, `cursor` | 200, `{ items, nextCursor }` |
| POST | `/chat/conversations/:id/messages` | `{ "content": "Hello", "clientRequestId": "new-uuid" }` | 201, saved message |

Bodies accept only those fields. Text is trimmed and must contain 1–2,000 Unicode
code points, without NUL. Text is data: future UI must render it as text, never
HTML. Missing/expired/invalid credentials return 401; malformed input returns 400.
An inaccessible or nonexistent conversation returns the same 404.

Both participants must exist and be active to open a DM. UUIDs are normalized to
lowercase and sorted, so opening Alice→Bob and Bob→Alice returns the same DM.
Friendship is not required. History remains readable after a personal block.
Channel access uses current group membership; management endpoints are later work.

## Retry behavior

Generate one `clientRequestId` for a logical send (eventually the browser uses
`crypto.randomUUID()`). Reuse that ID when retrying that send. Chat hashes the
conversation ID and trimmed content and scopes uniqueness to the signed author.

- Same author, ID and normalized payload: return the existing message, same ID.
- Same author and ID, different conversation or text: 409 Conflict, no extra row.
- Another author may independently use the same request UUID.
- A duplicate cannot move `lastMessageAt` backwards. Internal hashes are not returned.

## Pagination and limits

Default page size is 30, maximum 100. Message history is newest first, with UUID
as a tie-breaker for equal timestamps. Conversations sort by `lastMessageAt`
newest first, then UUID; empty conversations come last. Cursors are opaque,
validated and bound to the conversation/list scope; they grant no access.
Activity can change conversation ordering between pages, so refresh the first
page after a send. History keyset pagination remains stable for new messages.

This single-process baseline limits each user to 60 open/send attempts per minute,
then returns 429. The in-memory limiter has a bounded number of entries. It is
not shared across replicas and resets on restart. Nginx's separate per-IP limit
still applies and needs real multi-user deployment testing before acceptance.

## Teammate-owned integration dependency

Alongside the CHAT-01 profile endpoint, User service must provide:

```text
GET /internal/blocks/check?a=<uuid>&b=<uuid>
x-internal-key: <shared INTERNAL_API_SECRET>
```

The JSON response must contain `{ "blocked": true }` if either user blocks the
other, or `{ "blocked": false }` if neither does. This exact response is an
integration contract to confirm with the teammate, not an implemented User API
in this branch. Checks are live before opening/sending; blocked is 403, missing,
invalid, timed-out or unavailable privacy data is 503. No bypass is provided.
The usual distributed-service limitation applies: a privacy change immediately
after a successful check is not atomic with Chat's later database commit.

## Run the checks

From the `chat-service` directory in WSL, with Docker running:

```sh
npm run lint
npm test
npm run test:e2e
npm run build
npm run test:postgres
```

The PostgreSQL suite creates and removes its own database container and uses
short-lived test signing keys. Its temporary HTTP service represents the User
contract; it does not prove the teammate's actual endpoint works. It covers
simultaneous DM opens, concurrent retry deduplication, conflicting retry reuse,
outsider denial, block/privacy failures, message validation, history pagination,
server restart persistence and membership removal.

No new migration is required for CHAT-02: CHAT-01 already created its storage.
The earlier `test:foundation` full-stack test remains pending a compatible User
service and freshly built images; old cached images are not integration proof.

## Verification recorded 2026-10-19

- Unit tests: 55 passed, including live block-response validation and per-user limits.
- Authentication HTTP tests: 19 passed.
- Isolated PostgreSQL suite: 20 TAP tests passed (including parent tests and eleven
  CHAT-02 HTTP scenarios). It rebuilt and restarted the real Chat application.
- TypeScript/Nest build and lint passed; Git whitespace check passed.
- Existing User-service source and actual .env files were unchanged. No commits
  or pushes were made. The real teammate login/privacy journey is still pending.

## Debug and optimization follow-up (2026-10-19)

A regression test first reproduced a delayed send overwriting a newer updatedAt.
The send transaction now preserves the metadata read after taking its row lock.
Duplicate retries skip the unnecessary activity update. Cursor dates are limited
to canonical UTC timestamps in years 0001–9999; unsupported dates are rejected
before passing them to the database.

The guard already checked the caller, so DM creation refreshes only the recipient.
Recipient status and privacy requests run concurrently; both must succeed. The
write limiter checks the current user's window directly and scans other expired
entries only when its bounded map needs capacity. No privacy caching was added.

All 55 unit tests, 19 HTTP authentication tests and 20 PostgreSQL TAP tests pass,
as do build, lint and whitespace checks. The teammate's real integration is
still pending; source/config ownership is unchanged.
