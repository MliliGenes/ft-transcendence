# MinIO message attachments plan

## Goal

Allow an authenticated chat user to attach files to a message. Keep file bytes in the existing MinIO container and keep only object metadata in Chat's PostgreSQL database. The browser should upload directly to MinIO using a short-lived presigned URL, so large file bodies do not pass through the chat service.

## Current project state

- `compose.yaml` already runs a `minio` service on the Compose network, with ports published only on localhost.
- `chat-service` does not currently depend on MinIO or an S3 client package.
- `Message.content` is nullable and up to 2,000 characters. Messages have client request IDs and a server-computed retry hash.
- Message creation and conversation membership checks live in `chat-service/src/chat/chat.service.ts`.
- The browser currently sends JSON through `auth-profile-web/src/lib/chat.js`.

## Storage model

Prefer a related `MessageAttachment` table over `attachments: string[]` on `Message`. Each row should contain:

- UUID `id` and UUID `messageId` (foreign key with cascade on message deletion)
- server-generated MinIO `objectKey` (unique; never accept it as authoritative input from the client)
- `originalName`, validated `contentType`, and `sizeBytes`
- `createdAt`

Keep the bucket private. The database stores object keys, not public or presigned URLs; presigned URLs expire and should be generated when needed. A relation also lets the API return useful metadata without packing it into a string array.

## Upload flow (presigned PUT)

1. The client requests an upload slot from Chat with the conversation ID, filename, claimed content type, and size.
2. Chat authenticates the user and checks DM/channel membership using the same rules as message access. Validate a small allowlist of types, maximum size, and filename length; generate a random object key on the server. Do not use the supplied filename as a path.
3. Chat uses the MinIO SDK to sign a short-lived `PUT` URL for that one key. Return the URL, required headers, and an opaque upload ID/key reference. Keep credentials server-side.
4. The browser PUTs the raw file bytes directly to MinIO using the returned URL and headers. Configure bucket CORS only for the application origin and required method/headers if the browser reaches MinIO directly.
5. The client asks Chat to finalize the upload and associate it with a message. Chat rechecks authorization, verifies the object exists and its actual size (and content where practical), then records attachment metadata. Do not trust client-reported size/type alone.
6. On message history, return attachment metadata. When a member requests a download, authorize them against the message's conversation and issue a short-lived presigned `GET` URL.

For a first version, prefer uploading before sending the message, then include the resulting upload IDs with the message request. Define cleanup for uploads that are never attached (for example, a scheduled age-based sweep); do not let arbitrary clients choose object keys to finalize.

## Implementation steps

1. Add MinIO endpoint, bucket, and credentials to `envs/chat-service.env.example` and local configuration; inject them into `chat-service` in `compose.yaml`. Use the Compose hostname `minio` and internal port `9000`, not `localhost`. Make Chat wait for MinIO health.
2. Add the MinIO JavaScript SDK to `chat-service` and wrap it in a small storage provider for presigned PUT/GET, stat, and delete operations. Create/ensure the private bucket through deployment/bootstrap configuration or idempotent startup.
3. Add the `MessageAttachment` Prisma model and migration, then regenerate the Prisma client.
4. Add authenticated endpoints for requesting an upload, finalizing/attaching it to a message, and requesting a download URL. Reuse the existing conversation authorization logic and avoid accepting a client-selected storage key.
5. Extend message creation to accept attachment references, persist them transactionally with the message, and include them in REST/socket responses. Update retry hashing to cover the canonical attachment IDs as well as content.
6. Update the browser flow to request a URL, PUT the file to MinIO, then send/finalize the message. Add progress/error handling as needed.
7. Apply upload limits and checks: count per message, total bytes, allowlisted formats, generated keys, URL expiry, private bucket, and safe download content disposition. Consider malware scanning before enabling risky file types.
8. Handle deletion and abandoned uploads: delete stored objects when attachments/messages are removed, or use a cleanup job/outbox pattern if reliable cross-system deletion is needed. MinIO and PostgreSQL cannot share one transaction.

## Decisions to make during implementation

- Allowed formats, maximum file size, and maximum attachments per message.
- Whether attachment-only messages are allowed (current `content` DTO requires non-empty text).
- Whether to start with a small allowlist such as images and PDFs, or support arbitrary files with download-only disposition.
- Bucket CORS origin and whether MinIO is browser-reachable through a public/proxied endpoint in the target deployment.
- Cleanup policy for uploads that were granted but never finalized.

## Verification checklist

- Authorized conversation member can upload, attach, list, and download an object.
- Non-member cannot obtain upload/download URLs or attach an object to another conversation.
- Expired URL, oversized object, mismatched metadata, invalid type, duplicate finalize, and unknown upload ID are rejected safely.
- Message retry with the same request ID and same attachment set is idempotent; a different set conflicts.
- Message history and websocket payloads contain metadata only, never MinIO credentials or long-lived URLs.
- Compose networking works using the `minio` service name; bucket remains private and browser CORS is narrowly scoped.
