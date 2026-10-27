# Game database initialization

## Overview

This directory contains the PostgreSQL initialization hook used by the Compose
stack. The Game-facing boundary creates missing database resources and grants
access; it does not migrate existing credentials on every container restart.

## Interface

- [init-db.sh](./init-db.sh) uses `POSTGRES_USER` for its administrative `psql`
  connection and conditionally consumes `GAME_DB_USER`, `GAME_DB_NAME` and
  `GAME_DB_PASSWORD` for Game resources.
- `USER_DB_*` is a separate conditional namespace in the shared hook. Its
  service implementation is outside this Game documentation scope.
- The [Compose declaration](../../docker-compose.yml) wires initialization;
  the [infrastructure overview](../README.md) describes surrounding boundaries.

## Invariants

- The PostgreSQL image runs initialization hooks when creating a fresh data
  directory. Reusing an initialized volume does not rerun this hook merely
  because settings changed or a service restarted.
- Existing role passwords and attributes are preserved. Existing database
  ownership is preserved rather than reassigned.
- New login roles and databases are created only when their configured
  resources are absent; configured roles receive database privileges.
- `set -eu` and `psql`'s `ON_ERROR_STOP` stop the script on failures.
- Initialization environment values are trusted configuration interpolated
  into SQL. They are not an arbitrary user-input interface.

## Side Effects

- Connects as the configured PostgreSQL administrator.
- Can create login roles and databases and grant database privileges.
- Earlier successful SQL statements can survive a later failure; the hook
  does not promise an all-or-nothing transaction across initialization.

## Verification

The non-executing syntax check, from the repository root, is:

```sh
sh -n infra/postgres/init-db.sh
```

Database behavior requires an explicitly disposable fresh database environment;
follow the [manual guide](../../docs/manual-game-testing.md). Do not execute the
hook against an existing application database to validate documentation.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. The complete script was
sampled. No database initialization or new runtime tests were executed here.
