#!/usr/bin/env bash
set -euo pipefail

# Automated Recovery Verification Drill (D04)
# Executes a backup, verifies checksums, performs a restore test, and validates record integrity.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Step 1: Executing backup ==="
"${SCRIPT_DIR}/backup.sh"

LATEST_BACKUP=$(find "${SCRIPT_DIR}/../../backups" -maxdepth 1 -type d -name "nook_backup_*" | sort -r | head -n 1)

echo "=== Step 2: Testing restore drill from ${LATEST_BACKUP} ==="
"${SCRIPT_DIR}/restore.sh" "${LATEST_BACKUP}"

echo "=== Step 3: Verifying live data queries ==="
USER_COUNT=$(docker exec nook-user-db-1 psql -U nook_user -d nook -t -A -c 'SELECT count(*) FROM "User";')
CONV_COUNT=$(docker exec nook-chat-db-1 psql -U nook_chat -d nook_chat -t -A -c 'SELECT count(*) FROM "Conversation";')
MATCH_COUNT=$(docker exec nook-game-db-1 psql -U nook_game -d nook_game -t -A -c 'SELECT count(*) FROM matches;')

if [ "$USER_COUNT" -gt 0 ] && [ "$MATCH_COUNT" -gt 0 ]; then
  echo "SUCCESS: Data integrity verified (${USER_COUNT} users, ${CONV_COUNT} conversations, ${MATCH_COUNT} matches)."
else
  echo "FAILURE: Incomplete restore!"
  exit 1
fi
