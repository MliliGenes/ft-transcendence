-- Code Arena lifecycle notifications: link a challenge (private-room invite
-- code) to the conversation that carries the invitation, and mark messages
-- that the Chat service writes itself.
-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "GameChallenge" (
    "roomCode" VARCHAR(6) NOT NULL,
    "conversationId" UUID NOT NULL,
    "matchId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameChallenge_pkey" PRIMARY KEY ("roomCode")
);

-- CreateIndex
CREATE INDEX "GameChallenge_conversationId_idx" ON "GameChallenge"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "GameChallenge_matchId_key" ON "GameChallenge"("matchId");

-- AddForeignKey
ALTER TABLE "GameChallenge" ADD CONSTRAINT "GameChallenge_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
