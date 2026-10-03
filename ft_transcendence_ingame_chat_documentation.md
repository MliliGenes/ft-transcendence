# ft_transcendence — In-Game Chat Documentation

**Status:** Core mock implementation developed and functionally tested; production integration pending.  
**Frontend:** React  
**Mock backend:** Node.js and `ws` (WebSocket)  
**Development WebSocket URL:** `ws://localhost:9090`

## 1. Purpose and scope

The in-game chat is a temporary, Valorant-inspired communication feature for players currently participating in a match. It provides **Team** and **All** messaging without creating a permanent messaging system. The frontend keeps message history in memory; it is not persisted to a database. The chat is hidden and its local history cleared when a match-end event is received.

This document describes the implementation and tests completed so far, based on the current development code and reported test results. It distinguishes working mock behavior from features that still depend on the team's User Service and Game Service.

## 2. User-facing functionality

### Chat interface
- Dark-themed floating chat widget with a rounded message input and dark chat-history panel.
- A floating button opens and closes the chat without leaving the game.
- Incoming player messages show an unread dot when the chat is closed. Opening the chat clears that dot.
- System announcements appear inline in the history as `(System) ...` and **do not** trigger unread notifications.

### Message channels
- **Team (default):** Sent only to connected teammates in the same match.
- **All:** Type `/all ` before a message to send it to all connected players in the same match, regardless of team.
- Message length is limited to **500 characters** after trimming; empty messages are rejected.
- A message is displayed immediately in the sender's local history after it is sent. This is optimistic rendering, **not** a server delivery acknowledgment.

### Match lifecycle
- Joining a match produces a local welcome announcement: `(System) You have joined the team.`
- Existing teammates receive `(System) <username> has joined the team.`
- A match-end event hides the widget, clears its local messages and unread state, and closes the connection.
- The mock server tracks ended match IDs in memory and rejects subsequent joins to those matches until the server restarts.
- A server-side `endMatch(matchId)` function exists, but is deliberately **not** callable through ordinary player chat messages. It awaits a trusted Game Service integration.

### Disconnections
- Unexpected disconnections trigger reconnection attempts after approximately **3 seconds**.
- Previously displayed messages remain in React memory during a temporary disconnection.
- The client sends a new join request after reconnecting; the server responds with a `join_success` event after registration.
- The frontend will not send chat messages until the WebSocket is open **and** `join_success` has been received.
- Deliberate match-end closure stops reconnection.
- Duplicate-player rejection is treated as a non-retryable error by the current client. Further behavior for refresh races and transient duplicate connections should be evaluated during integration.

## 3. Project components

| File / module | Responsibility |
|---|---|
| `gamechat/src/components/GameChat.jsx` | Chat visibility, message state, unread state, WebSocket lifecycle, reconnection, outgoing message handling, match-end handling. |
| `ChatHistory.jsx` | Displays the current session's messages. |
| `ChatMessage.jsx` | Renders Team, All and inline System messages. |
| `ChatInput.jsx` | Collects player input and invokes the send handler. |
| `gamechat/src/styles/GameChat.css` | Dark chat appearance, floating button, rounded input, message styling. |
| `mock-server/server.js` | WebSocket server, registration, validation, channel routing, connection tracking, match-end handling. |
| `mock-server/players.js` | Temporary mock player identities and match/team assignments. |

The frontend is developed in React; the mock backend uses the Node.js `ws` library and listens on port **9090**.

## 4. Data and communication model

### Mock player data

The current mock player entries include:

| Player | Team | Match |
|---|---|---|
| Eva | A | match-1 |
| Magnus | A | match-1 |
| Hector | B | match-1 |
| Ben300 | B | match-1 |
| Alex | A | match-2 |
| Sam | B | match-2 |

These assignments are for development only. Real identities must come from verified User Service authentication, and real match/team membership must come from the Game Service.

### Client-to-server events

**Join request (mock only):**

```json
{"event":"join","username":"Eva"}
```

**Team message:**

```json
{"id":"client-generated-uuid","type":"team","username":"Eva","message":"Ready?"}
```

**All message:**

```json
{"id":"client-generated-uuid","type":"all","username":"Eva","message":"Good luck!"}
```

The server uses its registered player record, **not** the message's supplied `username`, when forwarding messages. In the hardened forwarding implementation, the server explicitly constructs outgoing message fields and generates the forwarded message ID rather than spreading arbitrary client properties.

**Unauthorized match-end request:** A client-sent `{"event":"end_match"}` is rejected. Match termination must be initiated through trusted server-side integration.

### Server-to-client events

| Event | Meaning |
|---|---|
| `join_success` | The server has registered the connection; outgoing chat is now permitted. |
| `system` | An inline announcement, such as a welcome or teammate join. |
| `error` | A registration or input error. |
| `match_end` | End the chat session, clear local history and stop reconnecting. |
| Message with `type: "team"` or `"all"` | An incoming player chat message. |

## 5. Message routing

The server keeps a `Map` of active WebSocket connections to registered player records. For every outgoing message, it:

1. Confirms that the sender is registered.
2. Validates the message's channel, text type and trimmed length.
3. Compares the sender's match ID with each recipient's match ID.
4. For Team messages, additionally requires the same team; for All messages, allows both teams within that match.
5. Forwards only to eligible, open recipient sockets. The sender's own React client displays its outgoing message locally.

The current mock server rejects a second registration on the same socket and rejects a second active socket claiming the same mock player ID.

## 6. Validation and security implemented

- Malformed JSON is caught rather than crashing the server.
- Parsed values that are `null`, arrays, numbers or other non-object structures are rejected.
- Unregistered sockets cannot send chat messages.
- Chat messages must use `team` or `all`, contain string text and have 1–500 trimmed characters.
- The frontend also rejects empty or over-500-character outgoing messages.
- A registered connection cannot switch identity by sending another `join` request.
- The mock server rejects simultaneous duplicate connections for the same mock player ID.
- Forwarded chat messages use the server's registered username, not a username forged inside the chat payload.
- Ordinary player sockets cannot trigger `endMatch()`.
- Ended matches reject new joins while their IDs remain in the server's in-memory `Set`.

**Important security boundary:** These protections do **not** authenticate a new join request. Until User Service integration, a new connection can still claim any mock username that is not already connected. Match IDs and team assignments are also mock data, not authoritative game state.

## 7. Tests completed

The following checks were reported as passed during development:

- Team messaging between teammates and All messaging across teams in the same match.
- Isolation between different matches.
- System join announcements and no unread dot for system messages.
- Unread dot for incoming player messages when the chat is closed.
- Match-end handling, rejection of joins to ended matches and continued operation of a different match.
- Rejection of duplicate registration on one socket and duplicate active player connections.
- Rejection of unauthorized match-end requests.
- Rejection of malformed JSON and invalid JSON structures without server crashes.
- Automatic reconnection after restarting the mock server, followed by successful messaging.
- Waiting for `join_success` before sending chat messages.
- Frontend message length checks for normal, 500-character and 501-character messages.
- Rejection of an unregistered socket's forged message.
- Forwarding a registered player's message under the server-registered username even when the client payload names another player.

These are manual development tests, not a claim of automated test coverage or production readiness.

## 8. Known limitations and remaining work

### User Service integration
- Replace `sessionStorage` mock usernames and `findPlayerByUsername()` identity lookup with authenticated player identity.
- Agree on the frontend token handoff and refresh lifecycle.
- Verify RS256 JWT access tokens on the chat backend using the User Service's trusted public key and correct issuer/audience settings; never ship private signing keys to the chat or frontend.
- Confirm the User Service's final API contract and browser CORS configuration where required.

### Game Service integration
- Obtain authoritative `matchId` and team assignments for authenticated player UUIDs.
- Verify match membership before admitting a player to chat.
- Receive trusted match-start/match-end lifecycle events and call `endMatch(matchId)` through an authenticated internal integration, not a player socket.
- Define behavior for rejoining, leaving, switching matches and clearing ended-match state.

### Additional engineering considerations
- The client currently displays sent messages optimistically and does not wait for delivery acknowledgment. Consider a message acknowledgment protocol if required.
- The sender's locally generated ID can differ from the server-generated ID forwarded to other players; agree on canonical IDs if message acknowledgment/deduplication is added.
- Review transient duplicate-connection handling on refresh and reconnect, especially if a previous connection has not yet been released.
- Define behavior for unsuccessful registration and permanently invalid credentials; avoid endless retry loops.
- Consider WebSocket heartbeat/ping handling for half-open network connections.
- Add automated tests for routing, lifecycle events, validation and authentication integration.
- Remove any temporary browser-exposed debug socket (`window.chatTestSocket`) and temporary test-only match-end timer if still present.
- Replace hard-coded localhost URLs with environment-specific configuration before deployment.

## 9. Integration flow (planned, not implemented)

1. Player signs in through the User Service and receives an access token.
2. Frontend opens a chat WebSocket and supplies the token using an agreed secure protocol.
3. Chat backend validates the token and obtains the authenticated user UUID and username.
4. Chat backend checks that player's match and team through the Game Service.
5. Chat backend registers the verified player and sends `join_success`.
6. Team and All messages use verified match/team data for routing.
7. The Game Service signals match termination through a trusted channel; the chat backend broadcasts `match_end` and removes the match's active chat registrations.

## 10. Current status

**Completed:** Working and manually tested React UI, mock WebSocket messaging, channel/match routing, temporary history, system announcements, unread behavior, reconnection, registration confirmation, match-end handling and mock-server validation/hardening.

**Pending:** Real User Service authentication, authoritative Game Service membership and lifecycle events, integration tests, and production-level connection/security hardening.
