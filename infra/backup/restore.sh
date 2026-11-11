#!/usr/bin/env bash
set -euo pipefail

# Nook Disaster Recovery Restore Script (D04)
# Restores User DB, Chat DB, Game DB, and MinIO attachments from a backup archive.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
COMPOSE=(docker compose --project-directory "${ROOT_DIR}" -f "${ROOT_DIR}/compose.yaml")

# This overwrites live data. Routine verification must use isolated databases.
if [ "${ALLOW_LIVE_RESTORE:-}" != "1" ]; then
  echo "ERROR: Live restore requires ALLOW_LIVE_RESTORE=1 during an approved maintenance window." >&2
  exit 1
fi

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

TARGET_DIR="$(cd "${TARGET_DIR}" && pwd)"

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
else
  echo "ERROR: SHA-256 tool required." >&2
  exit 1
fi
echo "    Checksum verification passed."

# Restore each database using its running configuration; stop on any SQL error.
for SERVICE in user-db chat-db game-db; do
  echo "--> Restoring ${SERVICE}..."
  gunzip -c "${TARGET_DIR}/${SERVICE}.sql.gz" | "${COMPOSE[@]}" exec -T "${SERVICE}" sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --single-transaction --quiet' >/dev/null
  echo "    ${SERVICE} SQL restore completed."
done

# 5. Restore MinIO attachments
echo "--> Restoring MinIO attachments..."
"${COMPOSE[@]}" exec -T minio tar xzf - -C /data < "${TARGET_DIR}/minio-attachments.tar.gz"
echo "    MinIO chat attachments restored."

echo "=========================================="
echo "Restore commands completed; verify application behavior before reopening access."
echo "=========================================="
