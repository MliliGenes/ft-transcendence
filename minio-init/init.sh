#!/bin/sh
# Idempotent: safe to run on every `docker compose up`.
# Uses the MinIO root account to create the chat bucket and a bucket-scoped
# service user whose keys match chat-service.env, so a fresh volume just works.
set -eu

: "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}"
: "${MINIO_ACCESS_KEY:?}" "${MINIO_SECRET_KEY:?}" "${MINIO_BUCKET:?}"

ENDPOINT="http://${MINIO_ENDPOINT:-minio}:${MINIO_PORT:-9000}"
POLICY="chat-attachments-rw"

export MC_CONFIG_DIR=/tmp/mc
mc alias set local "$ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

mc mb --ignore-existing "local/${MINIO_BUCKET}"

cat > /tmp/policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::${MINIO_BUCKET}"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::${MINIO_BUCKET}/*"]
    }
  ]
}
EOF

# Re-creating overwrites, so policy changes in this file apply on next up.
mc admin policy create local "$POLICY" /tmp/policy.json
# `user add` on an existing key resets its secret to the current env value.
mc admin user add local "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc admin policy attach local "$POLICY" --user "$MINIO_ACCESS_KEY" 2>&1 \
  | grep -v "already" || true

echo "minio-init: bucket '${MINIO_BUCKET}' and user '${MINIO_ACCESS_KEY}' ready"
