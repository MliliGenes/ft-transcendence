-- Draft additions to append AFTER table creation in the initial migration.
-- Prisma 7 does not express these CHECK constraints in schema.prisma.
-- This file is not automatically applied. No migration has been run.

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_valid_shape" CHECK (
  (
    "kind" = 'DM'
    AND "dmUserAId" IS NOT NULL AND "dmUserBId" IS NOT NULL
    AND "dmUserAId" < "dmUserBId"
    AND "groupId" IS NULL AND "name" IS NULL AND "topic" IS NULL
  )
  OR
  (
    "kind" = 'CHANNEL'
    AND "dmUserAId" IS NULL AND "dmUserBId" IS NULL
    AND "groupId" IS NOT NULL AND "name" IS NOT NULL
    AND length(btrim("name")) > 0
  )
);

ALTER TABLE "Group"
ADD CONSTRAINT "Group_nonempty_name" CHECK (length(btrim("name")) > 0);

ALTER TABLE "Message"
ADD CONSTRAINT "Message_content_or_tombstone" CHECK (
  ("deletedAt" IS NULL AND "content" IS NOT NULL AND length(btrim("content")) > 0)
  OR ("deletedAt" IS NOT NULL AND "content" IS NULL)
),
ADD CONSTRAINT "Message_positive_version" CHECK ("version" >= 1),
ADD CONSTRAINT "Message_request_hash_format" CHECK ("requestHash" ~ '^[0-9a-f]{64}$');
