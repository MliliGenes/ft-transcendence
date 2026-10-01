CREATE TYPE "OAuthPurpose" AS ENUM ('LOGIN', 'LINK');

ALTER TABLE "OAuthState"
ADD COLUMN "purpose" "OAuthPurpose" NOT NULL DEFAULT 'LOGIN',
ADD COLUMN "userId" TEXT;

ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_link_owner_check"
CHECK (("purpose" = 'LINK' AND "userId" IS NOT NULL)
    OR ("purpose" = 'LOGIN' AND "userId" IS NULL));

CREATE INDEX "OAuthState_userId_idx" ON "OAuthState"("userId");
CREATE UNIQUE INDEX "AuthProvider_userId_provider_key" ON "AuthProvider"("userId", "provider");
