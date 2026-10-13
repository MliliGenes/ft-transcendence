#!/bin/sh
set -eu

: "${POSTGRES_USER:?Set POSTGRES_USER in the root .env}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in the root .env}"
: "${POSTGRES_DB:?Set POSTGRES_DB in the root .env}"

# The official initializer creates POSTGRES_USER with
# POSTGRES_PASSWORD and creates POSTGRES_DB owned by that user, then starts Postgres.
# Compose uses temporary storage, so a stopped test container starts fresh next time.
exec /usr/local/bin/docker-entrypoint.sh "$@"
