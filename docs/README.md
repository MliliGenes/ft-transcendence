# Nook documentation

All project documentation lives here. Service folders keep only a short `README.md` that points back to this directory.

The project map for the whole repository is in [`../graphify-out/`](../graphify-out/GRAPH_REPORT.md). Open `graph.html` in that folder for the interactive view, and run `graphify update .` from the repository root after code changes.

## Project

| Document | What it covers |
|---|---|
| [Project context](project/PROJECT_CONTEXT.md) | Product vision, spaces (Feed, Chat, Play, Profile), confirmed decisions |
| [Points roadmap](project/POINTS_ROADMAP.md) | Module plan and point targets |
| [Module tracker](requirements/index.html) | ft_transcendence v21.2 module checklist (open in a browser) |
| [Local Compose setup](project/COMPOSE.md) | Running the stack, env files, HTTPS, OAuth callbacks |
| [Application book (PDF)](book/Nook-Book.pdf) | Whole-app reference built from these docs, both OpenAPI specs, graphify and Understand-Anything. Rebuild with `cd docs/book && npm install && npm run build` |
| [Public API adapter plan](project/PUBLIC_API_ADAPTER_PLAN.md) | Plan for the W06 public API module |

## Client (Next.js)

| Document | What it covers |
|---|---|
| [Client plan](client/PLAN.md) | Frontend build plan and progress |
| [Profile design spec](client/PROFILE_DESIGN_SPEC.md) | Profile and user settings design |
| [Search and social plan](client/SEARCH_SOCIAL_PLAN.md) | Search, friend requests, social flows |
| [Chat design proposal](client/CHAT_DESIGN_PROPOSAL.toon) | Chat UI proposal |
| [Chat integration plan](client/CHAT_INTEGRATION_PLAN.toon) | Wiring the client to chat-service |
| [Chat demo](client/NOOK_CHAT_DEMO.html) | Static chat UI demo (open in a browser) |
| [UI mockups](client/ui-mockups/) | Reference screens for login, feed, chat, profile, play |
| Design system tokens | Kept in [`client/NOOK_DESIGN_SYSTEM.json`](../client/NOOK_DESIGN_SYSTEM.json) next to the code, because a test checks it against `globals.css` |

## User service

| Document | What it covers |
|---|---|
| [Service guide](user-service/SERVICE.md) | Architecture, configuration, data model |
| [Setup](user-service/SETUP.md) | Local setup |
| [API reference](user-service/API.md) | Endpoints, auth flow, validation |
| [OpenAPI spec](user-service/openapi.json) | OpenAPI 3.1 contract |
| [Profile bio and status plan](user-service/nook-profile-status-plan.md) | Bio and custom status feature |

## Chat service

| Document | What it covers |
|---|---|
| [Overview](chat-service/README.md) | Entry point for chat documentation |
| [Chat MVP overview](chat-service/CHAT_OVERVIEW.md) | Current implementation and service flows |
| [Service plan](chat-service/PLAN.md) | Behavior and architecture reference |
| [MVP plan](chat-service/MVP_PLAN.md) | MVP scope |
| [API reference](chat-service/API.md) and [OpenAPI spec](chat-service/openapi.json) | Endpoints and contracts |
| [MinIO attachments](chat-service/MINIO_ATTACHMENTS.md) and [plan](chat-service/minio-attachments-plan.md) | File attachments |
| [RabbitMQ user sync](chat-service/RABBITMQ_USER_SYNC.md) | User events between services |
| [DM tests](chat-service/DM_TESTS.md) | Direct message test notes |
| [Prisma notes](chat-service/PRISMA_README.md) and [learning notes](chat-service/PRISMA_LEARNING.md) | Database schema and Prisma |

## Infrastructure and archive

| Document | What it covers |
|---|---|
| [MinIO](infra/minio.md) | Object storage setup |
| [Monitoring](infra/monitoring.md) | Grafana, Prometheus, Loki and Alloy: dashboards, alert rules, setup and the D02 mapping |
| [Monitoring plan](infra/MONITORING_PLAN.md) | Original two-phase monitoring plan; phase B (service metrics) still to do |
| [Old Vite test frontend](archive/auth-profile-web.md) | Notes from the removed `auth-profile-web` app; kept for history |
