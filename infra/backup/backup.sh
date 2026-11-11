#!/usr/bin/env bash
set -euo pipefail

# Nook Automated Backup Script (D04)
# Backs up User DB, Chat DB, Game DB, and MinIO attachments.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
COMPOSE=(docker compose --project-directory "${ROOT_DIR}" -f "${ROOT_DIR}/compose.yaml")
mkdir -p -- "${BACKUP_ROOT}"
BACKUP_ROOT="$(cd "${BACKUP_ROOT}" && pwd -P)"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_DIR="${BACKUP_ROOT}/nook_backup_${TIMESTAMP}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"
case "${RETENTION_COUNT}" in
  ''|*[!0-9]*) echo "ERROR: RETENTION_COUNT must be a positive integer." >&2; exit 1 ;;
esac
if [ "${RETENTION_COUNT}" -lt 1 ]; then
  echo "ERROR: RETENTION_COUNT must be a positive integer." >&2
  exit 1
fi

echo "=========================================="
echo "Nook Disaster Recovery Backup"
echo "Timestamp: ${TIMESTAMP}"
echo "Target directory: ${BACKUP_DIR}"
echo "=========================================="

mkdir -p "${BACKUP_DIR}"

# 1. Back up User PostgreSQL database
echo "--> Backing up User database..."
"${COMPOSE[@]}" exec -T user-db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' | gzip -c > "${BACKUP_DIR}/user-db.sql.gz"
echo "    User DB backed up: $(du -h "${BACKUP_DIR}/user-db.sql.gz" | cut -f1)"

# 2. Back up Chat PostgreSQL database
echo "--> Backing up Chat database..."
"${COMPOSE[@]}" exec -T chat-db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' | gzip -c > "${BACKUP_DIR}/chat-db.sql.gz"
echo "    Chat DB backed up: $(du -h "${BACKUP_DIR}/chat-db.sql.gz" | cut -f1)"

# 3. Back up Game PostgreSQL database
echo "--> Backing up Game database..."
"${COMPOSE[@]}" exec -T game-db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' | gzip -c > "${BACKUP_DIR}/game-db.sql.gz"
echo "    Game DB backed up: $(du -h "${BACKUP_DIR}/game-db.sql.gz" | cut -f1)"

# 4. Back up MinIO chat attachments
echo "--> Backing up MinIO chat attachments..."
"${COMPOSE[@]}" exec -T minio tar czf - -C /data chat-attachments > "${BACKUP_DIR}/minio-attachments.tar.gz"
echo "    MinIO attachments backed up: $(du -h "${BACKUP_DIR}/minio-attachments.tar.gz" | cut -f1)"

# 5. Compute SHA256 checksums
echo "--> Generating SHA-256 checksums..."
cd "${BACKUP_DIR}"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum *.gz > SHA256SUMS
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 *.gz > SHA256SUMS
else
  echo "ERROR: SHA-256 tool required." >&2
  exit 1
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
# A glob array preserves complete paths, including spaces/newlines. Timestamp
# names sort oldest first; walk backward and never follow a snapshot symlink.
BACKUP_LIST=("${BACKUP_ROOT}"/nook_backup_*)
COUNT=0
for (( INDEX=${#BACKUP_LIST[@]}-1; INDEX>=0; INDEX-- )); do
  DIR="${BACKUP_LIST[INDEX]}"
  [ -d "${DIR}" ] && [ ! -L "${DIR}" ] || continue
  COUNT=$((COUNT + 1))
  if [ "${COUNT}" -gt "${RETENTION_COUNT}" ]; then
    echo "    Removing expired backup: ${DIR}"
    rm -rf -- "${DIR}"
  fi
done

echo "=========================================="
echo "Backup successfully completed at ${BACKUP_DIR}"
echo "=========================================="
