# Chat schema draft

Start with [schema.prisma](../../chat-service/prisma/schema.prisma). It targets Prisma 7, matching User service's installed tooling. Chat's Prisma dependencies, configuration and migrations are not installed or wired by this draft.

## How group conversations work

- A DM conversation has two user IDs and no group.
- A channel conversation has a group ID and no DM user IDs.
- Every channel gets its members through `GroupMember`, so a group can have any number of members. There is no two-user limit on a group.
- All conversations share `Message` and `Reaction`, so message-saving logic needs only one destination ID.

## User data

`ChatUser` is a local public-profile copy. Populate it from authenticated User-service calls/events before referencing a user. Keep the same user ID. Names are nullable for deletion/anonymization and deliberately not unique here: asynchronously copied names must not create identity conflicts during renames. Store a stable avatar URL, not an expiring signed URL.

Update profile data only when the source update is newer. Handle deletion through a trusted account-lifecycle contract; a profile timestamp is not a revocation mechanism. Clear public fields on deletion and retain the ID tombstone if required by the agreed retention policy. Never resurrect a deleted identity from an old profile response. The schema restricts physical user deletion to avoid silently cascading away conversations/history; actual erasure requests need an explicit cleanup policy.

Do not use this copy to authorize accounts, blocks or friendships. Those remain User-service decisions. Group roles are authoritative in Chat's `GroupMember` table. Online status is live connection state, not a persisted user boolean.

## Constraints before migration

Append [constraints.sql](constraints.sql) to the initial generated migration after table creation. It enforces the two conversation shapes, canonical distinct DM participants, nonblank names/content, tombstone shape and positive message versions. The schema alone does not enforce those checks. No database migration has been generated or applied.

## Rules the service must enforce

- Check current conversation access on every read/write/subscription. Derive author/user IDs from verified authentication.
- Create a group, its first admin, and its general channel atomically. Serialize role/removal operations for each group so concurrent requests cannot remove the last admin.
- Normalize UUIDs and sort the DM pair before insertion. Handle the unique conflict by returning the existing conversation.
- Hash a canonical representation of conversation ID and original normalized content on the server. On a repeated author/request ID, check access and compare that hash before returning the existing message; reject a mismatched payload. Never accept a client-provided hash as authority. The fingerprint is retained data and should follow the message retention policy.
- A message edit/deletion/reaction change increments `version` atomically. Broadcast a snapshot with that version so clients can ignore older snapshots.
- Serialize reaction changes against message deletion. Deleting a message clears content and removes reactions in the same transaction; deleted messages cannot receive reactions.
- Group/channel deletion cascades to owned messages/reactions. Removing a membership does not delete the user's authored messages, but must revoke HTTP and live access.
- Validate trimmed text and bounds in the API too. History uses a bounded `(createdAt, id)` cursor within an authorized conversation; this orders rows but is not a guaranteed commit-order event log. Reconnect reloads current state as described in the plan.

Validation of Prisma syntax is not a database/security test. Before applying the first migration, test valid/invalid conversation shapes and concurrent DM, last-admin, reaction/delete and retry cases against an isolated PostgreSQL database.
