#!/usr/bin/env bash
set -euo pipefail

# Nook Automated Backup Script (D04)
# Backs up User DB, Chat DB, Game DB, and MinIO attachments.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_ROOT="${ROOT_DIR}/backups"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_DIR="${BACKUP_ROOT}/nook_backup_${TIMESTAMP}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"

echo "=========================================="
echo "Nook Disaster Recovery Backup"
echo "Timestamp: ${TIMESTAMP}"
echo "Target directory: ${BACKUP_DIR}"
echo "=========================================="

mkdir -p "${BACKUP_DIR}"

# 1. Back up User PostgreSQL database
echo "--> Backing up User database..."
docker exec nook-user-db-1 pg_dump -U nook_user -d nook --clean --if-exists | gzip -c > "${BACKUP_DIR}/user-db.sql.gz"
echo "    User DB backed up: $(du -h "${BACKUP_DIR}/user-db.sql.gz" | cut -f1)"

# 2. Back up Chat PostgreSQL database
echo "--> Backing up Chat database..."
docker exec nook-chat-db-1 pg_dump -U nook_chat -d nook_chat --clean --if-exists | gzip -c > "${BACKUP_DIR}/chat-db.sql.gz"
echo "    Chat DB backed up: $(du -h "${BACKUP_DIR}/chat-db.sql.gz" | cut -f1)"

# 3. Back up Game PostgreSQL database
echo "--> Backing up Game database..."
docker exec nook-game-db-1 pg_dump -U nook_game -d nook_game --clean --if-exists | gzip -c > "${BACKUP_DIR}/game-db.sql.gz"
echo "    Game DB backed up: $(du -h "${BACKUP_DIR}/game-db.sql.gz" | cut -f1)"

# 4. Back up MinIO chat attachments
echo "--> Backing up MinIO chat attachments..."
docker exec nook-minio-1 tar czf - -C /data chat-attachments > "${BACKUP_DIR}/minio-attachments.tar.gz"
echo "    MinIO attachments backed up: $(du -h "${BACKUP_DIR}/minio-attachments.tar.gz" | cut -f1)"

# 5. Compute SHA256 checksums
echo "--> Generating SHA-256 checksums..."
cd "${BACKUP_DIR}"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum *.gz > SHA256SUMS
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 *.gz > SHA256SUMS
fi

# 6. Write manifest metadata
cat <<EOF > manifest.json
{
  "timestamp": "${TIMESTAMP}",
  "version": "1.0",
  "services": ["user-db", "chat-db", "game-db", "minio"],
  "files": [
    "user-db.sql.gz",
    "chat-db.sql.gz",
    "game-db.sql.gz",
    "minio-attachments.tar.gz"
  ]
}
EOF

# 7. Apply retention policy (keep last N backups)
echo "--> Applying retention policy (keeping last ${RETENTION_COUNT} backups)..."
BACKUP_LIST=$(find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "nook_backup_*" | sort -r)
COUNT=0
for DIR in $BACKUP_LIST; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -gt "$RETENTION_COUNT" ]; then
    echo "    Removing expired backup: ${DIR}"
    rm -rf "${DIR}"
  fi
done

echo "=========================================="
echo "Backup successfully completed at ${BACKUP_DIR}"
echo "=========================================="
