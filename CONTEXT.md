# Context: Code Arena in Nook

## Overview
Code Arena is a competitive coding game integrated into the Nook platform for `ft_transcendence`. Two players (1v1 duel) or two two-player teams (2v2 collaboration) solve a sequence of programming problems under time pressure. In 2v2, teammates edit code collaboratively in real time via Yjs CRDTs. Solutions are tested locally against visible example cases, then submitted to an isolated sandbox judge worker evaluating a hidden test suite.

The game is hosted inside Nook's web client under the `/play` route and follows the Nook Design System (`NOOK_DESIGN_SYSTEM.json`) and `next-frontend` standards.

---

## Agreed Architectural Decisions (ADR-0015 Summary)

1. **Selective Integration**:
   - Backend services (`services/game`, `services/judge-worker`), core packages (`packages/arena-game`, `packages/arena-model`, `packages/problem-bank`), and documentation are ported selectively into `nook-client` without overwriting root compose or project configurations.
2. **Database Topology**:
   - `game-db`: Dedicated PostgreSQL container (`5432`) on Nook's private network alongside `user-db` and `chat-db`.
   - Judge queueing: The judge worker uses a bounded in-process queue; Postgres stores durable matches and submissions. Redis is not part of the current Code Arena runtime.
3. **Authentication Boundary**:
   - `services/game` is an auth consumer. It validates Nook RS256 access tokens with the public key and trusts only the `sub` UUID as `userId`; public profile names are loaded from User service by the client. The User signing private key is not provided to Game.
4. **Chat & Communication Separation**:
   - In-game team chat runs on `game-service`'s match-scoped WebSocket namespace (`/chat`), styled natively with Nook UI components. Nook platform chat remains in `chat-service`.
5. **Entry Flow**:
   - Entry: Players can enter 1v1 matchmaking, create a private room with a shareable 6-character code, or send a private-room invitation through Nook Chat. 2v2 teams assemble and use mutual readiness before submission.
6. **Editor & Collaboration**:
   - CodeMirror 6 with Yjs CRDT collaborative binding (`y-codemirror.next`), wrapped in dynamic client components (`ssr: false`) and styled to match Nook's pure-black (`#000000`) and surface (`#121212`) palette with Inter and monospace typography.
7. **Supported Languages**:
   - C++, Python, and C, powered by the checked problem bank and sandboxed Docker judge worker. Snippet execution is available for Python only (supporting bank-declared class `Solution` entrypoints and top-level functions); C++ and C use `stdio` driver execution. Incompatible language/driver requests are rejected before judge dispatch with HTTP 400.

---

## Domain Glossary

- **Match**: One timed competition between two sides (1v1 or 2v2) across a sequence of rounds.
- **Round**: A single problem cycle within a match (3 rounds per standard match). Resets editor and test runner state; accumulates match score.
- **Problem**: A coding task with description, input/output specifications, examples, constraints, and starter code per language.
- **Run (Test Check)**: Running the current code against visible examples only. Handled without affecting score or touching the hidden suite.
- **Submission**: Final code sent for evaluation against the sealed hidden test suite. In 2v2, each participating teammate must approve the current shared document. If a teammate explicitly leaves, or remains disconnected past the 90-second reconnect window, the remaining teammate can approve and submit alone.
- **Readiness**: The 2v2 gate. Approvals apply to the current document revision. A returning teammate must approve that revision again; see the [gameplay review](docs/spec/code-arena-gameplay-review.md) for the agreed rules.
- **Hidden Suite**: Sealed evaluation tests evaluated inside `judge-worker`. Breakdown is disclosed only during Score Reveal.
- **Reveal**: Per-round score disclosure (percentages and hidden-group breakdown) shown after evaluation settles.
- **Match Phase**: State machine: `ROUND_INTRO` → `CODING` → (`RUNNING_TESTS` → `CODING`)* → `SUBMITTED` → `EVALUATING` → `SCORE_REVEAL` → next round / match end.
- **Round Coding Deadline**: Server-authoritative 10-minute coding deadline per round, starting at the first `CODING` transition and capped by the overall 30-minute match budget. Persisted in `rounds.coding_deadline_ms`. New submissions are rejected at/after cutoff; pre-cutoff submissions follow bounded 2s evaluation grace. Unsubmitted sides receive 0 points at round deadline. Immediate reveal when both sides score before cutoff is preserved.
- **Match Deadline**: Server-authoritative 30-minute overall match budget. Capped across rounds; submissions accepted before deadline are evaluated within a bounded grace window.
- **Player Status**: One of `coding`, `running`, `submitted`, `evaluating`, `locked in`, `disconnected`. Modeled independently of presence (`online`/`offline`).
