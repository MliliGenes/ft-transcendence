BEGIN;

CREATE TABLE "OAuthState" (
    "tokenHash" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

COMMIT;
