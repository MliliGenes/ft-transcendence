#!/usr/bin/env bash
set -euo pipefail

# Live maintenance recovery check (D04) - NOT an isolated restore drill.
# Executes a backup, verifies checksums, performs a restore test, and validates record integrity.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${ALLOW_LIVE_RESTORE:-}" != "1" ]; then
  echo "ERROR: This check restores live data. Set ALLOW_LIVE_RESTORE=1 only during an approved maintenance window." >&2
  exit 1
fi
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE=(docker compose --project-directory "${ROOT_DIR}" -f "${ROOT_DIR}/compose.yaml")
BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
export BACKUP_ROOT

echo "=== Step 1: Executing backup ==="
"${SCRIPT_DIR}/backup.sh"

LATEST_BACKUP=$(find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "nook_backup_*" | sort -r | head -n 1)

echo "=== Step 2: Testing restore drill from ${LATEST_BACKUP} ==="
"${SCRIPT_DIR}/restore.sh" "${LATEST_BACKUP}"

echo "=== Step 3: Verifying live data queries ==="
USER_COUNT=$("${COMPOSE[@]}" exec -T user-db sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "$1"' sh 'SELECT count(*) FROM "User";')
CONV_COUNT=$("${COMPOSE[@]}" exec -T chat-db sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "$1"' sh 'SELECT count(*) FROM "Conversation";')
MATCH_COUNT=$("${COMPOSE[@]}" exec -T game-db sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "$1"' sh 'SELECT count(*) FROM matches;')

if [ "$USER_COUNT" -gt 0 ] && [ "$MATCH_COUNT" -gt 0 ]; then
  echo "SUCCESS: Live restore smoke queries completed (${USER_COUNT} users, ${CONV_COUNT} conversations, ${MATCH_COUNT} matches)."
else
  echo "FAILURE: Incomplete restore!"
  exit 1
fi
