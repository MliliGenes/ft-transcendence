# Private chat database foundation

The active schema is now limited to private DMs. The earlier groups/reactions
draft is deferred; add those through later migrations when implementing them.

- `ChatUser` stores a public-profile copy using the existing User-service UUID.
  It stores no password, login session, or signing key. Names are nullable and
  not unique because renames/deletions arrive from the owning service.
- `Conversation` stores two different, sorted user IDs. A unique index prevents
  a second conversation for the same pair. The API must normalize UUIDs and
  sort them before creating a conversation.
- `Message` stores its conversation, author, text, server timestamps, retry key,
  original-payload hash, deletion timestamp, and version. Hashing, retry handling,
  and permission checks still need implementing in the message API.

The initial migration includes `constraints.sql`: canonical DM pairs, nonblank
live messages, tombstone shape, positive versions, and hexadecimal hashes. Edit
future migrations rather than editing an already applied migration.

`DatabaseService` connects at startup and disconnects on shutdown using the
Prisma PostgreSQL adapter. Startup fails if the configured database is unavailable.
The generated client is ignored by Git and regenerated with `npm run build`.

## Boundaries

User service owns identity, current account state, blocks, and public profile
updates. Chat must obtain those decisions through a trusted service contract;
the local profile copy is not an authorization source. Never use the User
service database URL here. No profile synchronization has been implemented yet.

A foreign key confirms that a referenced row exists. It does not prove that a
message author belongs to the conversation; the API must enforce membership.
Restricting user deletion protects stored history until an explicit account
lifecycle and retention policy is implemented. Conversation deletion cascades
its messages. No HTTP deletion endpoint exists in this checkpoint.

## Verify

`npm run test:postgres` requires Docker and `postgres:18-alpine` (pull it first).
It creates its own uniquely named container, random credentials, loopback port,
and normal non-superuser database role. It never uses your database URL for its
test database. It deploys migrations twice, checks constraints and persistence,
starts the built server with an ephemeral test signing key, checks authentication,
then stops that server and removes only its own container.

For local development setup, see checkpoint 3 in `../CHECKPOINTS.md`.
