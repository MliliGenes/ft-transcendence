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
| [Handbook PDF](book/Nook-Book.pdf) | Everything above in one book. Rebuild with `cd docs/book && npm install && npm run build` |
| [UI mockups](client/ui-mockups/) | Reference screens |
| Design tokens | `client/NOOK_DESIGN_SYSTEM.json`, kept next to the code because a test checks it |
