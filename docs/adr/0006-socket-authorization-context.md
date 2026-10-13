# Centralize Socket.IO authorization context

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

The Game service had four Socket.IO gateways: Arena game, collaboration,
team chat, and lobby. Each gateway parsed `DEV_PRINCIPAL` handshake fields on
its own, and match-scoped handlers read raw `client.data.userId` and
`client.data.matchId`. The repeated parser made it easy for a namespace to
drift in precedence, missing-field handling, or cleanup behavior.

## Decision

- Add one `socket-auth.ts` module that reads the current trusted-principal
  handshake seam, rejects disabled or incomplete authentication, and fails
  closed when auth and query identity disagree.
- Attach the verified `SocketPrincipal` to the Socket.IO session once. Message
  handlers read it through `requireSocketPrincipal`; disconnect cleanup uses the
  non-throwing `socketPrincipal` reader.
- Require a Match id for game, collaboration, and team-chat namespaces. The
  lobby namespace authenticates a user first, then authorizes each requested
  private room through `GameService.roomForMember`.
- Keep namespace-specific membership and capability checks in `GameService`:
  game snapshots/presence, collaboration sync, team-chat context, and lobby
  room membership remain separate authorization decisions.
- Keep room identity server-derived. The client cannot select a Match, team,
  or collaboration room by writing socket data or sending a room name.
- Preserve the existing `DEV_PRINCIPAL` contract. Replacing it with the real
  auth principal remains a single seam in this module and does not change the
  Game domain methods.

## Consequences

- All namespaces share one identity parser, precedence rule, and missing-field
  behavior.
- Gateways no longer trust duplicated raw identity fields; they consume the
  verified principal context.
- Namespace-specific authorization remains visible at the point where the
  required Match capability is known instead of being hidden in a generic
  gateway guard.
- The socket context is still process-local. Sticky sessions or shared pub/sub
  remain required before horizontal realtime fan-out and rate limits scale out.

## Follow-up

Replace `DEV_PRINCIPAL` with the authenticated Core principal and narrow CORS
origins before production auth integration. Keep the same `SocketPrincipal`
interface so the gateways and Game service do not need another identity
refactor.

## Addendum (2026-10-13, auth-game integration)

The follow-up above is done; the seam now carries the verified auth principal:

- **Verify, don't parse**: handshake `auth: { accessToken, matchId? }` is
  verified per connection via `AuthPrincipalClient.verify` against private
  `user-service:3000` (`GET /auth/principal` → `{ userId, expiresAt }`, 2s
  budget, in-flight dedup). Every message re-verifies the stored token; failure
  disconnects and suppresses the ack. Renewal is reconnect-with-new-token.
- The old `DEV_PRINCIPAL` handshake parsing (`auth.userId`/query/`?user=`,
  `x-dev-user-id`) survives only as an explicit dev-suite seam behind
  `DEV_PRINCIPAL=true`; production (`false`) fails closed.
- **Architecture**: user-service (Node 24, own `user_db`) and game (Node 22,
  own `game_db`) are separate Compose services on separate volumes; only the
  static nginx gateway (1.27-alpine, prebuilt Arena `/play/` + auth `/`
  SPAs) publishes ports. Routing: `/api/lobby/` + `/api/matches/` → game is
  canonical (the Arena's single `apiBase` addresses game HTTP as
  `/api/lobby|matches/*`); `/api/game/` + legacy roots → game; rest of
  `/api/` → user-service; `/socket.io/` → game. `AuthPrincipalClient`
  registration is owned by `GameModule` (factory provider); tests share the
  single `createTestAppWithVerifier` helper. Full contract:
  `docs/auth-game-contract.md`.
