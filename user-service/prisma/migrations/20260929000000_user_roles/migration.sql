BEGIN;

CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPERADMIN');

-- Existing users and future inserts without a role receive USER.
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

COMMIT;
