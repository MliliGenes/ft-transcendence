BEGIN;
ALTER TABLE "User" ADD COLUMN "bannerUrl" TEXT;
CREATE TYPE "UserImageKind" AS ENUM ('AVATAR', 'BANNER');
CREATE TABLE "UserImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UserImageKind" NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserImage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserImage_userId_kind_key" ON "UserImage"("userId", "kind");
ALTER TABLE "UserImage" ADD CONSTRAINT "UserImage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
