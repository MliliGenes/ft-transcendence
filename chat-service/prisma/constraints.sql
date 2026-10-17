-- Included in the initial migration, after Prisma creates the tables.
ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_canonical_pair" CHECK ("dmUserAId" < "dmUserBId");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_content_or_tombstone" CHECK (
  ("deletedAt" IS NULL AND "content" IS NOT NULL AND length(btrim("content")) > 0)
  OR ("deletedAt" IS NOT NULL AND "content" IS NULL)
),
ADD CONSTRAINT "Message_positive_version" CHECK ("version" >= 1),
ADD CONSTRAINT "Message_request_hash_format" CHECK ("requestHash" ~ '^[0-9a-f]{64}$');
