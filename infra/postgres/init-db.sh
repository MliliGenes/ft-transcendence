#!/bin/sh
# Create the Code Arena and user-service databases and least-privilege roles
# on first volume init. Each postgres mounts this script on its own storage
# (pgdata for the game, userpgdata for accounts); env selects which role/DB
# to ensure, so a container only creates its own.
set -eu

if [ -n "${GAME_DB_USER:-}" ] && [ -n "${GAME_DB_NAME:-}" ]; then
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${GAME_DB_USER}') THEN
    CREATE ROLE ${GAME_DB_USER} LOGIN PASSWORD '${GAME_DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${GAME_DB_NAME} OWNER ${GAME_DB_USER}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${GAME_DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${GAME_DB_NAME} TO ${GAME_DB_USER};
EOSQL
fi

if [ -n "${USER_DB_USER:-}" ] && [ -n "${USER_DB_NAME:-}" ]; then
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${USER_DB_USER}') THEN
    CREATE ROLE ${USER_DB_USER} LOGIN PASSWORD '${USER_DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${USER_DB_NAME} OWNER ${USER_DB_USER}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${USER_DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${USER_DB_NAME} TO ${USER_DB_USER};
EOSQL
fi
