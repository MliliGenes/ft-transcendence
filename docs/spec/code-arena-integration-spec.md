# Code Arena Integration Specification

**Status:** Ready for Implementation  
**Date:** 2026-11-09  
**Target:** `ft_transcendence` Game Module Integration in Nook  
**References:**
- [CONTEXT.md](file:///Users/ayousr/orca/workspaces/ft-transcendence/nook-client/CONTEXT.md)
- [ADR-0015](file:///Users/ayousr/orca/workspaces/ft-transcendence/nook-client/docs/adr/0015-code-arena-nook-integration.md)
- [NOOK_DESIGN_SYSTEM.json](file:///Users/ayousr/orca/workspaces/ft-transcendence/nook-client/client/NOOK_DESIGN_SYSTEM.json)
- [next-frontend Skill](file:///Users/ayousr/orca/workspaces/ft-transcendence/nook-client/.agents/skills/next-frontend/SKILL.md)

---

## 1. Objectives & Scope

Integrate the Code Arena competitive multiplayer coding game from branch `integration/code-arena` into the current `nook-client` repository.

### Core Capabilities:
- **Modes**: 1v1 duels and 2v2 team collaboration.
- **Realtime Sync**: Yjs CRDT-based synchronized code editing for teammates with CodeMirror 6.
- **Judge Execution**: Sandboxed, multi-language (C++, Python, C) evaluation with test runner.
- **Match Lifecycle**: 3-round sequence with state transitions, deadline enforcement, score reveals, and winner determination.
- **Platform Alignment**: Native look-and-feel inside Nook's Next.js client under the `/play` route.

---

## 2. Architecture & Service Topology

```
                         Browser (Next.js Client)
                                  │
                                  ▼
                        Nginx Reverse Proxy (:8080)
                       /                           \
           (HTTP /api/game)                    (WebSockets /socket.io)
                     │                                     │
                     └─────────────┬───────────────────────┘
                                   ▼
                         game-service (NestJS)
                         ├── Auth Bridge (user-service verification)
                         ├── Match Authority & Lifecycle
                         ├── Socket.IO Gateways (/arena, /chat, /lobby)
                         ├── PostgreSQL Adapter ──► game-db (:5432)
                         └── Evaluation Queue  ──► redis (:6379)
                                                       │
                                                       ▼
                                            judge-worker (Sandbox)
                                            (Docker Container / Isolated Runner)
```

### Services & Containers to Add in `compose.yaml`:
1. `game-db`: PostgreSQL 16 image storing match persistence, submissions, reveals, and rating history.
2. `redis`: Redis Alpine image for BullMQ evaluation jobs and distributed locks.
3. `game-service`: NestJS service built from `services/game/Dockerfile`.
4. `judge-worker`: Isolated code execution container built from `services/judge-worker/Dockerfile`.

---

## 3. Auth & Principal Bridge Contract

Per `docs/auth-game-contract.md`:
- `game-service` does not handle password checks or user records directly.
- **HTTP**: Reads trusted principal from JWT cookie or Authorization header validated with `user-service` secret or verification route.
- **WebSockets**: The initial handshake extracts and validates the token, assigning `socket.data.principal = { userId, username }`.
- Test fixture remains available for standalone game unit/integration suites.

---

## 4. Frontend Architecture in `client/`

### Route Layout:
- `/play`: Game landing, active matches overview, and "Create / Join Lobby" modal.
- `/play/lobby/[code]`: 1v1 and 2v2 lobby assembly, role/side assignment, and readiness toggles.
- `/play/match/[id]`: Active match arena view.

### Component Structure:
- `components/arena/EditorAdapter.tsx`: CodeMirror 6 editor bound to Y.Text with Nook dark theme, marked `"use client"` and dynamically imported (`ssr: false`).
- `components/arena/ProblemPanel.tsx`: Problem description, markdown rendered, examples, constraints.
- `components/arena/DuelScoreboard.tsx`: Tabular countdown clock, round indicator, team readiness badges, scorebars.
- `components/arena/TestResultsPanel.tsx`: Tabbed output for visible test runs and hidden suite evaluation reveals.
- `components/arena/TeamChatPanel.tsx`: Match-scoped in-game team chat styled with Nook message tokens.

### Design Tokens:
- All components use semantic CSS tokens from `NOOK_DESIGN_SYSTEM.json`:
  - Canvas: `bg-background` (`#000000` dark)
  - Surfaces: `bg-card` (`#121212`), `bg-popover` (`#1C1C1C`)
  - Primary actions: `bg-primary` (`#F16B3A`), `text-primary-foreground` (`#000000`)
  - Corners: Square corners / 4px subtle radii (`rounded-none` or `rounded-sm`)
  - Icons: `@tabler/icons-react` only.

---

## 5. Verification Plan

1. **Unit & Integration Suites**:
   - Run Vitest suites in `packages/arena-game`, `packages/arena-model`, `services/game`, and `services/judge-worker`.
2. **Compose Stack Health**:
   - `docker compose up --build` brings up `game-db`, `redis`, `game-service`, and `judge-worker` healthy alongside existing Nook services.
3. **End-to-End Game Flow**:
   - Two browser windows create a 1v1 lobby, ready up, receive the problem, test run code, submit, and see the reveal.
   - Four browser windows create a 2v2 lobby, verify live CRDT typing between teammates, readiness toggle, team submission, and final scoreboard.
