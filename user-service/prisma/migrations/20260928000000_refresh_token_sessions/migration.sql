BEGIN;

ALTER TABLE "RefreshToken" ADD COLUMN "sessionId" TEXT;

-- Old rotations have no recorded relationship. Preserve each existing token
-- as its own session; future rotations inherit this value.
UPDATE "RefreshToken" SET "sessionId" = "id";

ALTER TABLE "RefreshToken" ALTER COLUMN "sessionId" SET NOT NULL;
CREATE INDEX "RefreshToken_userId_sessionId_idx"
  ON "RefreshToken"("userId", "sessionId");

COMMIT;
