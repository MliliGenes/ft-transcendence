#!/bin/sh
# Creates (or updates) a read-only `monitoring` login with the built-in
# pg_monitor role, used by the Grafana Alloy PostgreSQL exporter.
#
# Runs automatically on a NEW database (mounted in /docker-entrypoint-initdb.d).
# For an existing database, run it once without touching any data:
#   docker compose exec user-db sh /docker-entrypoint-initdb.d/10-monitoring-role.sh
#   docker compose exec chat-db sh /docker-entrypoint-initdb.d/10-monitoring-role.sh
#
# MONITORING_PASSWORD_ENV names the variable holding this database's password
# (set per database in compose.yaml), e.g. USER_DB_MONITOR_PASSWORD.
set -eu

password=$(printenv "${MONITORING_PASSWORD_ENV:-}" 2>/dev/null || true)
if [ -z "$password" ]; then
  echo "monitoring role: ${MONITORING_PASSWORD_ENV:-<unset>} is empty; skipping."
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v pw="$password" <<'SQL'
SELECT format('CREATE ROLE monitoring LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'monitoring') \gexec
SELECT format('ALTER ROLE monitoring WITH LOGIN PASSWORD %L', :'pw') \gexec
GRANT pg_monitor TO monitoring;
SQL

echo "monitoring role: ready."
