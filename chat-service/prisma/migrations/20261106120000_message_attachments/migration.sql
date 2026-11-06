-- Store MinIO object keys for attachments; file bytes remain in MinIO.
ALTER TABLE "Message"
ADD COLUMN "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
