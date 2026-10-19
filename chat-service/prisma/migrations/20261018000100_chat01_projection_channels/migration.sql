-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('DM', 'CHANNEL');

-- AlterTable
ALTER TABLE "ChatUser" ADD COLUMN     "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "groupId" UUID,
ADD COLUMN     "kind" "ConversationKind" NOT NULL DEFAULT 'DM',
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "name" VARCHAR(80),
ADD COLUMN     "topic" VARCHAR(500),
ALTER COLUMN "dmUserAId" DROP NOT NULL,
ALTER COLUMN "dmUserBId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "rules" VARCHAR(4000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateIndex
CREATE INDEX "GroupMember_userId_joinedAt_groupId_idx" ON "GroupMember"("userId", "joinedAt", "groupId");

-- CreateIndex
CREATE INDEX "Conversation_groupId_createdAt_id_idx" ON "Conversation"("groupId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Conversation_dmUserAId_lastMessageAt_id_idx" ON "Conversation"("dmUserAId", "lastMessageAt", "id");

-- CreateIndex
CREATE INDEX "Conversation_dmUserBId_lastMessageAt_id_idx" ON "Conversation"("dmUserBId", "lastMessageAt", "id");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ChatUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing projections must refresh on their next use.
UPDATE "ChatUser" SET "syncedAt" = '1970-01-01 00:00:00';
UPDATE "Conversation" AS c SET "lastMessageAt" = (
  SELECT max(m."createdAt") FROM "Message" AS m WHERE m."conversationId" = c.id
);
ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_valid_shape" CHECK (
  ("kind" = 'DM' AND "dmUserAId" IS NOT NULL AND "dmUserBId" IS NOT NULL
    AND "dmUserAId" < "dmUserBId"
    AND "groupId" IS NULL AND "name" IS NULL AND "topic" IS NULL)
  OR
  ("kind" = 'CHANNEL' AND "dmUserAId" IS NULL AND "dmUserBId" IS NULL
    AND "groupId" IS NOT NULL AND "name" IS NOT NULL AND length(btrim("name")) > 0)
);
ALTER TABLE "Group" ADD CONSTRAINT "Group_nonempty_name" CHECK (length(btrim("name")) > 0);
