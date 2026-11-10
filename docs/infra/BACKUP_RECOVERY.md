# Nook Backup, Disaster Recovery, and Retention (Module D04)

This document describes Nook's backup, retention, and disaster recovery procedures for PostgreSQL databases (`user-db`, `chat-db`, `game-db`) and MinIO object storage.

---

## 1. Protected Data & Components

| Component | Container | Persistent Data | Backup Mechanism |
|---|---|---|---|
| **User Service** | `nook-user-db-1` | Accounts, profiles, friendships, auth tokens | `pg_dump -U nook_user -d nook --clean --if-exists` |
| **Chat Service** | `nook-chat-db-1` | Cached profiles, channels, direct messages, read receipts | `pg_dump -U nook_chat -d nook_chat --clean --if-exists` |
| **Game Service** | `nook-game-db-1` | 1v1 and 2v2 matches, rounds, submissions, collaborative revisions | `pg_dump -U nook_game -d nook_game --clean --if-exists` |
| **MinIO Storage** | `nook-minio-1` | Chat attachment files and images (`/data/chat-attachments`) | `tar czf - -C /data chat-attachments` |

---

## 2. Backup Script (`infra/backup/backup.sh`)

The automated script [`infra/backup/backup.sh`](file:///Users/ayousr/orca/workspaces/ft-transcendence/nook-client/infra/backup/backup.sh):
1. Creates a timestamped directory under `backups/nook_backup_YYYYMMDD_HHMMSSZ/`.
2. Dumps and compresses each PostgreSQL database using `gzip`.
3. Streams and compresses the MinIO `chat-attachments` folder into a `.tar.gz` archive.
4. Computes SHA-256 checksums for each archive and writes `SHA256SUMS`.
5. Emits `manifest.json` describing backup metadata.
6. Enforces the automated **retention policy** (default: keeps the last 7 backups, automatically deleting older snapshots).

### Running Manually:
```bash
./infra/backup/backup.sh
```

### Scheduling with Cron:
To run backups daily at 03:00 UTC with log output:
```crontab
0 3 * * * cd /path/to/nook-client && ./infra/backup/backup.sh >> /var/log/nook-backup.log 2>&1
```

---

## 3. Restore Script (`infra/backup/restore.sh`)

The restore script [`infra/backup/restore.sh`](file:///Users/ayousr/orca/workspaces/ft-transcendence/nook-client/infra/backup/restore.sh):
1. Verifies the cryptographic integrity of all archive files against `SHA256SUMS`.
2. Restores each PostgreSQL database via piped `psql` transactions.
3. Unpacks and restores MinIO attachment objects into `/data`.
4. Executes sanity queries asserting table counts (`User`, `Conversation`, `matches`).

### Running a Restore:
```bash
# Restore from the latest available backup:
./infra/backup/restore.sh

# Or specify a target backup directory:
./infra/backup/restore.sh backups/nook_backup_20261110_033419Z
```

---

## 4. Disaster Recovery Drill (`infra/backup/verify-recovery.sh`)

An end-to-end automated verification script is provided at [`infra/backup/verify-recovery.sh`](file:///Users/ayousr/orca/workspaces/ft-transcendence/nook-client/infra/backup/verify-recovery.sh). It executes a live backup, tests checksum validation, performs the restore pass, and checks record integrity in one command:
```bash
./infra/backup/verify-recovery.sh
```
