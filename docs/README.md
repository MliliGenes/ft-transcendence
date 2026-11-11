# Nook documentation

One document per service, and one per place where services meet.

## Services

| Document | Covers |
| --- | --- |
| [User service](services/user-service.md) | Accounts, auth, email verification, OAuth, friends, blocks, images, superadmin |
| [Chat service](services/chat-service.md) | DMs, messages, groups, channels, Socket.IO, presence |
| [Web client](services/client.md) | Next.js structure, routes, data flow, design rules, error and loading pages |
| [Infrastructure](services/infrastructure.md) | Compose, env files, Nginx, TLS, RabbitMQ, MinIO, monitoring |

## Integrations (merging points)

| Document | Between | Covers |
| --- | --- | --- |
| [User and chat](integrations/user-chat.md) | user-service, chat-service | RabbitMQ profile sync, `ChatUser`, HTTP fallback, shared JWT, block checks |
| [Chat and storage](integrations/chat-storage.md) | chat-service, MinIO, Nginx, browser | Presigned uploads and downloads, video, security |
| [Client and backend](integrations/client-backend.md) | client, services | Gateway paths, session lifecycle, realtime |
| [Feed](integrations/feed.md) | user-service, chat-service, client | Global group, auto-join, post UI |

## Reference

| Item | What it is |
| --- | --- |
| [User service OpenAPI](api/user-service.openapi.json) | HTTP contract |
| [Chat service OpenAPI](api/chat-service.openapi.json) | HTTP contract |
| [Product context](project/PROJECT_CONTEXT.md) | Vision, spaces, decisions |
| [Points roadmap](project/POINTS_ROADMAP.md) | Module plan and point targets |
| [Module tracker](requirements/index.html) | ft_transcendence module checklist, open in a browser |
| [Handbook PDF](book/Nook-Book.pdf) | Core product, service, integration, API and code-map reference, including a Code Arena summary and [21-page G06 screenshot proof](evidence/g06-live-demo/screenshots.pdf). Rebuild with `cd docs/book && npm install && npm run build` |
| [UI mockups](client/ui-mockups/) | Reference screens |
| Design tokens | `client/NOOK_DESIGN_SYSTEM.json`, kept next to the code because a test checks it |

## Code Arena and evaluation

| Document | Covers |
| --- | --- |
| [Integration specification](spec/code-arena-integration-spec.md) | Game routes, HTTP/socket contracts, data ownership and demonstration requirements |
| [Chat lifecycle notifications](services/chat-service.md#code-arena-lifecycle-notifications) | Room-owner authorization, Game event publishing, Chat delivery and related tests |
| [G06 demo evidence](evidence/g06-live-demo/README.md) and [screenshot PDF](evidence/g06-live-demo/screenshots.pdf) | Two-client screenshots in one 21-page file, stored message rows and live demonstration limits |
| [Integration decision](adr/0015-code-arena-nook-integration.md) | Service boundaries and accepted decisions |
| [Game engine](../packages/arena-game/src/engine.ts) and [Game service](../services/game/src/game/game.service.ts) | Authoritative gameplay and authenticated API |
| [Complete backup/recovery guide](infra/BACKUP_RECOVERY.md) | User, Chat, Game and MinIO snapshots; restore limitations |
| [Game deployment guide](project/COMPOSE.md) | Game/Judge environment and Compose setup |
| [Official subject](../ft_trans_subject.pdf) | ft_transcendence v21.2 requirements |
| [Privacy Policy](../client/app/(legal)/privacy/page.tsx) and [Terms](../client/app/(legal)/terms/page.tsx) | Current public user notices |
| [Integration plan](superpowers/plans/2026-11-11-nook-arena-platform-integration.md) | Branch reconciliation decisions, checks and remaining operator actions |

## Engineering checks

[Repeatable verification](project/VERIFICATION.md) is the entry point for the full gate, disposable services, secret hooks and CI.

The committed code graph lives in `../graphify-out/` and can be refreshed with `graphify update .`. Code extraction is deterministic and local; optional community names use an LLM. The 2026-11-11 missing-label pass used Ollama with local `qwen3.5:4b`, preserved 47 existing labels, and manually clarified two duplicate Docker labels. The Understand-Anything snapshot in `../.ua/` records its source commit in `meta.json`; the handbook flags it as stale when that commit no longer matches `HEAD`.
