# Code Arena integration specification

**Status:** Integrated; automated verification and live demonstration evidence are tracked separately.
**Updated:** 2026-11-10
**Decision:** [ADR-0015](../adr/0015-code-arena-nook-integration.md)

## Product behavior

Code Arena is Nook's first playable game. Signed-in users can find a 1v1 match, create or join a six-character private room, challenge another user from a direct conversation or profile, or form a 2v2 team. A match has three timed coding rounds, automated hidden-test evaluation, score reveals and a final result. Default problems are selected from three seeded problem versions without repetition.

The 2v2 mode gives each team a shared CodeMirror/Yjs editor, readiness gates and match-scoped team chat. Match recovery and socket presence are owned by the Game service. The profile Games tab displays recent completed matches, a played/wins/win-rate summary, player progression (level, XP, rank title), and six unlockable achievement badges; `/play/leaderboard` ranks players by wins, then win rate and matches played, with level indicators.

Direct-message invitations are ordinary persistent Chat messages with a recognized Code Arena card. Opening a card routes to the room; the card queries `GET /api/game/lobby/rooms/lookup/:code` to render a live status badge (`Open`, `In Match`, or `Expired`), links directly to active matches, or disables expired rooms.

Game lifecycle notifications are separate from the invitation card. The Game service publishes authoritative match events on the `game.events` RabbitMQ exchange; the Chat service consumes them and writes ordinary system messages (`kind = SYSTEM`) into the conversation that carries the challenge: one message when the match starts, one when it ends (win, draw, forfeit or deadline) and one when a challenge is cancelled before it starts. The invitation message carries the private-room code so the Chat service can link the challenge to its conversation. See [the Chat service notes](../services/chat-service.md#code-arena-lifecycle-notifications).

## Service boundaries

```mermaid
flowchart LR
  Browser[Browser · Next.js] --> Nginx[Nginx · HTTPS]
  Nginx -->|app routes| Client[Next.js client]
  Nginx -->|/api/*| User[User service]
  Nginx -->|/api/chat/* and Socket.IO| Chat[Chat service]
  Nginx -->|/api/game/* and Socket.IO| Game[Game service]
  User --> UserDB[(User PostgreSQL)]
  Chat --> ChatDB[(Chat PostgreSQL)]
  User --> Events[RabbitMQ · user events]
  Events --> Chat
  Game --> GameEvents[RabbitMQ · game events]
  GameEvents --> Chat
  Chat --> MinIO[MinIO · attachment objects]
  Game --> GameDB[(Game PostgreSQL)]
  Game -->|private judge network| Judge[Judge worker]
  Judge --> Sandbox[resource-limited, no-network containers]
```

Nginx maps `/api/game/` to the Game HTTP service and `/api/game/socket.io/` to its Socket.IO transport. The legacy `/socket.io/` location continues to route to Chat, so the lobby and game clients must provide the canonical Game socket path. The Game service validates User-issued RS256 JWTs and uses `sub` as the stable user ID. Public usernames and avatars are hydrated from the User API in the client.

The Game service persists state in its own PostgreSQL database using atomic match snapshots and associated round, submission and collaboration records. Judge execution uses a bounded in-process queue and the isolated worker. Redis is not a runtime dependency in the current implementation.

## HTTP and realtime contracts

- `/api/game/lobby/*`: authenticated matchmaking, private-room creation/joining, readiness and room state.
- `/api/game/matches/*`: authenticated match snapshots, coding actions, runs, submissions, readiness and leaving.
- `/api/game/users/:userId/matches`: authenticated, sanitized completed-match summaries for profile display.
- `/api/game/users/:userId/stats`: authenticated win/loss/draw and win-rate aggregates.
- `/api/game/leaderboard`: authenticated top-player summaries, limited to 50 players.
- `/api/game/socket.io/`: the shared Engine.IO transport path. The authenticated Socket.IO namespaces are the default `/` namespace for match state and `/collab`, `/chat`, and `/lobby` for Yjs collaboration, team chat, and room events.
- `/api/chat/*`: persisted direct conversations, including Code Arena invitation messages (`POST /api/chat/conversations/:id/messages` accepts `gameChallenge: { roomCode }` to link the challenge to its conversation) and the game lifecycle notifications written back into it.

The history response contains up to 25 recent matches, each with its ID, mode, outcome, opponents, score, and `playedAt` completion timestamp. Stats and leaderboard responses contain aggregate counts and win rate; leaderboard entries also contain rank. These responses do not contain source code, editor snapshots, or hidden tests. Game HTTP requests use same-origin paths and the authenticated access token; Socket.IO clients send the token in their authenticated handshake. The API returns no rating because this build has no rating system.

## Persistence and privacy boundary

The `game-db` owns match snapshots, private rooms, rounds, submissions, reveals and collaborative documents. Submitted source and editor snapshots may contain personal data and can be read by the instance operator. The durable `game.user-events` queue consumes `user.deleted` events from the User service. Game stores only a SHA-256 hash of the deleted account identifier for 20 minutes so unexpired access tokens are rejected across Game instances; an automatic sweep removes the hash within one additional minute. Authenticated HTTP and WebSocket handlers check this block, per-instance fanout disconnects existing sockets, and a 15-second socket sweep catches instances that missed live fanout during a broker interruption.

Erasure removes the account's matchmaking rows and private-room membership. If it owns a room, ownership transfers to the earliest remaining member; an empty room is deleted. Each affected active match ends by forfeit. The match result remains, but the participant identifier is replaced by a random anonymous identifier and marked `anonymized`; match snapshots expose `null` for that member ID, profile history omits anonymous opponent IDs and the leaderboard omits anonymous players. Game deletes all submitted source, run output, judge diagnostics and collaborative documents for the affected side, and removes that account's messages from the in-memory team-chat history. In 2v2, editor state and submissions are side-shared, so the entire side's code is removed even when the teammate contributed it. This deletion covers the live Game database; backups and copied volumes follow the instance operator's separate retention policy. See the [Privacy Policy](../../client/app/(legal)/privacy/page.tsx) and [Terms of Service](../../client/app/(legal)/terms/page.tsx).

## Verification

Automated checks are run from the repository root or `client/` as described in the [root README](../../README.md). In the default no-`DATABASE_URL` test setup, the Game HTTP integration tests cover principal-protected history, stats, and leaderboard responses with the development principal fixture and in-memory store. Account-erasure tests cover forfeit/anonymization, source and collaboration deletion, lobby cleanup, token-block expiry, and access denial on existing sockets. A separate unit test checks that default matchmaking selects three distinct problem IDs. The PostgreSQL persistence contract, including atomic source deletion, requires `TEST_PG_URL` to point to a disposable test database. Do not point tests at a database containing user data.

Game lifecycle notifications are covered at both sides of the contract. `services/game/src/game/game-events.test.ts` proves that the Game service publishes a match start (with the room code), a forfeit result, a withdrawn challenge and an expired challenge, and that no event carries source, editor or hidden test data. `chat-service/test/game-notifications.spec.ts` and `chat-service/test/game-notifications.postgres.test.mjs` prove that Chat validates the event, checks the conversation correlation, writes one persisted system message, ignores a replayed event, rejects participants who are not conversation members, and receives the event over RabbitMQ in the disposable integration environment. `client/tests/arena-game-notifications.test.mjs` proves that only system messages are rendered as notification cards and that an invitation links its room code to the conversation.

Before claiming G02, demonstrate two clients on separate computers completing a match and recovering from a disconnection. For the project's full 2v2 demonstration and stronger G03 evidence, demonstrate four synchronized clients; the local tracker sets G03's minimum at three simultaneous players. Live evaluator demonstrations are not replaced by unit tests or a successful container build.
