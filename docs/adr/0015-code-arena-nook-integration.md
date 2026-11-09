# 0015. Code Arena Integration into Nook Platform

Date: 2026-11-09
Status: Accepted

## Context
Nook requires a complete, multi-player, web-based game for `ft_transcendence` with remote play, synchronization, real-time collaboration, and microservice compliance. Branch `integration/code-arena` contains a tested, baseline implementation of Code Arena (NestJS game service, sandboxed judge worker, problem bank, and collaborative editor).

We need to integrate this baseline into `nook-client` while conforming to Nook's multi-container Compose topology, existing authentication mechanisms, and the Nook Design System (`NOOK_DESIGN_SYSTEM.json`) using Next.js App Router and Tailwind v4.

## Decisions

1. **Selective Integration over Blind Git Merge**:
   - Backend services (`services/game`, `services/judge-worker`), core packages (`packages/arena-game`, `packages/arena-model`, `packages/problem-bank`), and authoritative documentation are imported selectively.
   - We avoid clobbering Nook's existing `compose.yaml`, `package.json`, and Next.js client configurations.

2. **Microservice & Database Topology**:
   - `game-db`: Dedicated PostgreSQL container running on the internal docker network, matching the existing `user-db` and `chat-db` pattern.
   - `redis`: Deployed as a dedicated service in `compose.yaml` for evaluation job queues and distributed locking.
   - `judge-worker`: Isolated worker container communicating over the internal network for code execution.

3. **Authentication Boundary**:
   - `game-service` strictly consumes trusted identity (`userId`, `username`) from `user-service` tokens/headers per `docs/auth-game-contract.md`. No user credential or hashing logic is duplicated inside the game service.

4. **In-Game Chat vs Platform Chat**:
   - Match-scoped team chat runs directly on `game-service`'s `/chat` WebSocket namespace during active matches to preserve sub-second latency and match-phase encapsulation.
   - Visual presentation will use Nook message components and design tokens.

5. **Entry Flow**:
   - The first release uses Private Lobbies with 6-character invite codes and direct in-chat invitations, deferring global public matchmaking.

6. **Frontend Integration & Editor**:
   - Code Arena UI will be built under `/play` in Nook's Next.js client (`client/app/play`).
   - The verified CodeMirror 6 + Yjs CRDT collaborative binding is retained and encapsulated in client-only components (`"use client"`, `ssr: false`).
   - All components adhere strictly to `NOOK_DESIGN_SYSTEM.json`: square corners, `#000000` canvas, `#121212` surfaces, `#F16B3A` orange primary accents, and `@tabler/icons-react`.

## Consequences
- Clean separation of concerns between game logic, platform chat, and authentication.
- Zero throwaway UI code: new components are written directly in Nook's design system over verified headless hooks.
- Microservice requirements for `ft_transcendence` are fully met.
