#!/bin/sh
# Create the Code Arena database and least-privilege role on first volume init.
set -eu

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
