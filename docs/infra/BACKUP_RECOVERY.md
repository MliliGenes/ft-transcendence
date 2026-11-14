# Complete snapshots and recovery (D04)

The complete snapshot workflow covers User, Chat and Game PostgreSQL plus the MinIO `chat-attachments` bucket. Database commands use the running service's `POSTGRES_USER` and `POSTGRES_DB`; they do not assume example names or a fixed container name.

## Snapshot contents

| File                           | Source                                                    |
| ------------------------------ | --------------------------------------------------------- |
| `user-db.sql.gz`               | Account, authentication, profile and social tables        |
| `chat-db.sql.gz`               | Conversations, messages, groups and read receipts         |
| `game-db.sql.gz`               | Matches, submissions, results and collaborative snapshots |
| `minio-attachments.tar.gz`     | MinIO `chat-attachments` data directory                   |
| `SHA256SUMS` / `manifest.json` | Integrity checks and snapshot metadata                    |

The database dumps omit ownership/ACL statements; provision roles and grants separately. These are sequential per-service backups, not one cross-service transaction. Coordinate writes for an application-consistent recovery point. User-service filesystem uploads, other MinIO buckets, TLS keys, environment secrets, broker state, logs and monitoring volumes are outside this snapshot and need their own retention/recovery policy.

## Create and schedule snapshots

From the repository root, with the stack running:

```sh
./infra/backup/backup.sh
```

Snapshots go to `backups/nook_backup_YYYYMMDD_HHMMSSZ/`. `BACKUP_ROOT` can select another absolute destination. `RETENTION_COUNT` defaults to 7 snapshots. Store protected, encrypted off-host copies as well; a local backup does not protect against loss of the host.

Install one host cron entry as the deployment operator. The time below is 03:00 in the cron daemon's timezone; use UTC only if that daemon is configured for UTC:

```crontab
0 3 * * * cd /path/to/nook-client && ./infra/backup/backup.sh >> /path/to/protected/nook-backup.log 2>&1
```

Ordinary Compose startup does not install this schedule. Avoid overlapping manual/scheduled runs. The [database-only Compose profile](../services/infrastructure.md#optional-database-only-backups) is an alternative PostgreSQL scheduler, including Game, with daily/weekly/monthly retention. Do not enable it alongside the complete snapshot schedule unintentionally; it does not include MinIO.

## Restore during maintenance

[`restore.sh`](../../infra/backup/restore.sh) overwrites live database and attachment state. Stop application writes, preserve a pre-restore copy and choose a maintenance window before opting in:

```sh
ALLOW_LIVE_RESTORE=1 ./infra/backup/restore.sh /absolute/path/to/snapshot
```

Without `ALLOW_LIVE_RESTORE=1`, the command refuses before accessing Docker. It checks SHA-256 hashes and runs each SQL restore with `ON_ERROR_STOP=1` in a transaction. This is one transaction per database, not a rollback across all databases and MinIO. A failure can therefore leave a partially restored platform; keep writes stopped until recovery is completed and application behavior is verified.

[`verify-recovery.sh`](../../infra/backup/verify-recovery.sh) is a legacy **live maintenance check**, not a clean-service drill. It backs up, restores into the live services and runs basic row-count checks. It also requires `ALLOW_LIVE_RESTORE=1`. Do not run it as a routine smoke test or treat positive counts as proof of complete recovery.

## Non-destructive verification

The [infrastructure guide](../services/infrastructure.md#restore-into-a-new-database) shows how to restore User, Chat and Game SQL dumps into newly named databases without overwriting the source. Validate all three databases, matching attachment data, schema/migrations and application flows in an isolated deployment before claiming a full disaster-recovery demonstration. This integration does not perform a destructive live restore.

The mocked script regression checks runtime database-name handling, complete snapshot file coverage, checksum validation, SQL error handling and the live-restore opt-in gate:

```sh
node --test infra/backup/backup.test.mjs
```

That test does not replace a real PostgreSQL/object-storage recovery drill.
