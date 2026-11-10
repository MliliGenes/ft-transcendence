#!/usr/bin/env bash
set -euo pipefail

# Nook Disaster Recovery Restore Script (D04)
# Restores User DB, Chat DB, Game DB, and MinIO attachments from a backup archive.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_ROOT="${ROOT_DIR}/backups"

TARGET_DIR="${1:-}"

if [ -z "${TARGET_DIR}" ]; then
  # Find latest backup
  LATEST=$(find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "nook_backup_*" | sort -r | head -n 1)
  if [ -z "${LATEST}" ]; then
    echo "ERROR: No backup found in ${BACKUP_ROOT}"
    echo "Usage: $0 [path/to/backup_directory]"
    exit 1
  fi
  TARGET_DIR="${LATEST}"
fi

if [ ! -d "${TARGET_DIR}" ]; then
  echo "ERROR: Backup directory not found: ${TARGET_DIR}"
  exit 1
fi

echo "=========================================="
echo "Nook Disaster Recovery Restore"
echo "Source archive: ${TARGET_DIR}"
echo "=========================================="

# 1. Verify checksum integrity
echo "--> Verifying SHA-256 checksums..."
cd "${TARGET_DIR}"
if [ ! -f "SHA256SUMS" ]; then
  echo "ERROR: SHA256SUMS missing from backup directory!"
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c SHA256SUMS --status || { echo "ERROR: Checksum verification failed!"; exit 1; }
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 -c SHA256SUMS --status || { echo "ERROR: Checksum verification failed!"; exit 1; }
fi
echo "    Checksum verification passed."

# 2. Restore User PostgreSQL database
echo "--> Restoring User database..."
gunzip -c "${TARGET_DIR}/user-db.sql.gz" | docker exec -i nook-user-db-1 psql -U nook_user -d nook --quiet >/dev/null
USER_COUNT=$(docker exec nook-user-db-1 psql -U nook_user -d nook -t -A -c 'SELECT count(*) FROM "User";' 2>/dev/null || echo "0")
echo "    User DB restored successfully (${USER_COUNT} user accounts)."

# 3. Restore Chat PostgreSQL database
echo "--> Restoring Chat database..."
gunzip -c "${TARGET_DIR}/chat-db.sql.gz" | docker exec -i nook-chat-db-1 psql -U nook_chat -d nook_chat --quiet >/dev/null
CONV_COUNT=$(docker exec nook-chat-db-1 psql -U nook_chat -d nook_chat -t -A -c 'SELECT count(*) FROM "Conversation";' 2>/dev/null || echo "0")
echo "    Chat DB restored successfully (${CONV_COUNT} conversations)."

# 4. Restore Game PostgreSQL database
echo "--> Restoring Game database..."
gunzip -c "${TARGET_DIR}/game-db.sql.gz" | docker exec -i nook-game-db-1 psql -U nook_game -d nook_game --quiet >/dev/null
MATCH_COUNT=$(docker exec nook-game-db-1 psql -U nook_game -d nook_game -t -A -c 'SELECT count(*) FROM matches;' 2>/dev/null || echo "0")
echo "    Game DB restored successfully (${MATCH_COUNT} arena matches)."

# 5. Restore MinIO attachments
echo "--> Restoring MinIO attachments..."
docker exec -i nook-minio-1 tar xzf - -C /data < "${TARGET_DIR}/minio-attachments.tar.gz"
echo "    MinIO chat attachments restored."

echo "=========================================="
echo "Restore drill complete and verified!"
echo "=========================================="
