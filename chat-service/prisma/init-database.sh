#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=chat_password="$CHAT_DB_PASSWORD" <<'SQL'
CREATE ROLE nook_chat LOGIN PASSWORD :'chat_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE nook_chat OWNER nook_chat;
SQL
