SHELL := /bin/sh
.DEFAULT_GOAL := up

PROJECT ?= nook-test-postgres
COMPOSE = docker compose -p "$(PROJECT)" --env-file ../.env -f compose.yaml

.PHONY: up build stop down logs status

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up --build -d --wait --wait-timeout 60

stop:
	$(COMPOSE) stop

# This test database is disposable: stopping/removing the container clears its data.
down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f postgres

status:
	$(COMPOSE) ps -a
