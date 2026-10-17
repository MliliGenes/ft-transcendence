-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ChatUser" (
    "id" UUID NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dmUserAId" UUID NOT NULL,
    "dmUserBId" UUID NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientRequestId" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_dmUserAId_createdAt_id_idx" ON "Conversation"("dmUserAId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Conversation_dmUserBId_createdAt_id_idx" ON "Conversation"("dmUserBId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_dmUserAId_dmUserBId_key" ON "Conversation"("dmUserAId", "dmUserBId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Message_authorId_clientRequestId_key" ON "Message"("authorId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dmUserAId_fkey" FOREIGN KEY ("dmUserAId") REFERENCES "ChatUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dmUserBId_fkey" FOREIGN KEY ("dmUserBId") REFERENCES "ChatUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "ChatUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


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
