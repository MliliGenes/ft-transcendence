.DEFAULT_GOAL := all

COMPOSE ?= docker compose
SERVICE ?=

.PHONY: help config build up start stop down restart rebuild ps logs format backup-up backup-down clean destroy prune

all: build up

help:
	@echo "Nook project commands:"
	@echo "  make config       Validate Compose configuration"
	@echo "  make build        Build service images"
	@echo "  make up           Build and start the project"
	@echo "  make down         Stop and remove containers (keeps data)"
	@echo "  make destroy      Remove project containers and networks (keeps data)"
	@echo "  make restart      Restart existing containers"
	@echo "  make rebuild      Rebuild and recreate the project"
	@echo "  make ps           Show service status"
	@echo "  make logs [SERVICE=client]  Follow project or service logs"
	@echo "  make format       Format supported repository files"
	@echo "  make backup-up    Start optional database backup services"
	@echo "  make backup-down  Stop optional database backup services"
	@echo "  make clean        Alias for make down"
	@echo "  make prune        Remove unused Docker images/cache engine-wide (keeps volumes)"

config:
	$(COMPOSE) config --quiet

build: config
	$(COMPOSE) build

up: config
	$(COMPOSE) up --build -d

start: config
	$(COMPOSE) start

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down --remove-orphans

destroy: down

clean: down

prune:
	$(COMPOSE) down --remove-orphans
	docker system prune --all

restart:
	$(COMPOSE) restart

rebuild:
	$(COMPOSE) down --remove-orphans && $(COMPOSE) up --build -d

ps:
	$(COMPOSE) ps --all

logs:
	$(COMPOSE) logs --follow $(SERVICE)

format:
	npm run format

backup-up:
	$(COMPOSE) --profile database-only-backups up -d user-db-backup chat-db-backup game-db-backup

backup-down:
	$(COMPOSE) --profile database-only-backups stop user-db-backup chat-db-backup game-db-backup
