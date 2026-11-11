# G06 live two-client demonstration

Evidence for the G06 acceptance check: the Code Arena **game notifications** in
chat, shown live in two independent browser sessions against a real stack.

Run date: **2026-11-11**. Branch: `integration/nook-arena-platform`, commit
`c462ece` (the repair under review) plus this evidence commit.

## What was demonstrated

Two disposable accounts (`g06_owner_1794394411485` and
`g06_rival_1794394411485`, both `@example.invalid`) in **two separate
browser contexts** — two independent sessions, two independent users — with
one direct conversation between them.

| Step | What happened | Owner saw | Second account saw |
|---|---|---|---|
| 1 | Owner challenged the other account to a duel from the public profile | `Code Arena · 1v1 Duel` invitation card, status `Open` | the same invitation card with `Accept & Join` |
| 2 | Second account accepted and joined the room (`/play/lobby/N9ZDV3`) | — | lobby with both players |
| 3 | Both marked ready, owner started the match | `Code Arena · Match started` | `Code Arena · Match started` |
| 4 | Second account forfeited from the match arena | `Code Arena · Match result` (`won by forfeit`) | `Code Arena · Match result` (`won by forfeit`) |
| 5 | Owner withdrew a second challenge from the lobby | `Code Arena · Challenge cancelled` (`withdrawn before it started`) | the same cancellation notice |
| 6 | A third challenge expired in the Game service's own sweep | `Code Arena · Challenge cancelled` (`expired before it started`) | the same cancellation notice |
| 7 | Both clients reloaded the conversation | 5 cards, unchanged | 5 cards, unchanged |

Every notification reached **both** clients live, over the real Socket.IO
gateway, and was persisted in the conversation.

## Exact notification texts (from the database)

```
USER   |  1 copy | 🎮 Code Arena challenge ~  ~ [Accept & Join](/play/lobby/N9ZDV3)
USER   |  1 copy | 🎮 Code Arena challenge ~  ~ [Accept & Join](/play/lobby/ZD3X56)
USER   |  1 copy | 🎮 Code Arena challenge ~  ~ [Accept & Join](/play/lobby/JW2UTV)
SYSTEM |  1 copy | 🎮 Code Arena ~ match-started · 1v1 duel started: g06_owner_1794394411485 vs g06_rival_1794394411485 ~ [View match](/play/match/2ede07ca-a6c6-415e-8568-0a30ff877f66)
SYSTEM |  1 copy | 🎮 Code Arena ~ match-result · g06_owner_1794394411485 won by forfeit (g06_rival_1794394411485 left the match) ~ [View match](/play/match/2ede07ca-a6c6-415e-8568-0a30ff877f66)
SYSTEM |  1 copy | 🎮 Code Arena ~ challenge-cancelled · the duel challenge was withdrawn before it started
SYSTEM |  1 copy | 🎮 Code Arena ~ challenge-cancelled · the duel challenge expired before it started
```

`copies` and `distinct request ids` are both `1` for every row: each
notification is stored exactly once, and each one has its own deterministic
request id. The raw query output is in `chat-messages.txt`.

The challenge bindings the Chat service wrote for that conversation:

```
 roomCode | has_match
----------+-----------
 N9ZDV3   | t
 ZD3X56   | f
 JW2UTV   | f
```

`N9ZDV3` is the room that started a match; the other two were withdrawn or
expired before one started. One binding per room code, one conversation.

## No duplicates on reload and reconnect

Immediately before and after a full reload of both clients (which reconnects
the chat socket and re-fetches the transcript from the server):

```
before = { owner: 5 cards, rival: 5 cards }
after  = { owner: 5 cards, rival: 5 cards }
```

The same five cards, no duplicates. The database agrees: seven rows in that
conversation, three `USER` invitations and four `SYSTEM` notifications, each
with a distinct request id.

## How it was run

A disposable Compose project (`nook-g06-demo`), separate from the running
Nook stack:

- its own network, its own volumes and its own host ports
  (`https://localhost:8443`, RabbitMQ management on `15673`, MinIO console on
  `9002`), so the live stack and its user data were never touched;
- the **current source** for the User, Chat, Game and Client services, built
  as fresh images (`nook-demo-*`), including the Chat migration
  `20261111090000_game_notifications`;
- throwaway credentials generated for the run (a fresh RSA key pair, fresh
  database and broker passwords). No credential was read from `envs/*.env`;
  the tracked `*.env.example` templates were used to shape the configuration;
- a Mailpit SMTP sink so the two accounts completed real email verification
  through the normal `/verify-email` link.

The demonstration was driven by Playwright against Google Chrome, using the
real client UI only: the profile page, the chat workspace, the lobby page and
the match arena. No service was called directly to produce a notification.

Screenshots are in this directory, in the order the run took them:

| File | Shows |
|---|---|
| `01-owner-registered.png` | the owner's account after registration |
| `02-owner-profile.png` | the second account's public profile |
| `03-owner-invitation-sent.png` | the owner after sending the challenge |
| `04-rival-sees-invitation.png` | the second account receiving the invitation |
| `05-rival-joined-lobby.png` | the second account in the lobby |
| `06-owner-in-lobby.png` | the owner in the same lobby |
| `07-both-ready.png` | both players ready |
| `08-owner-after-start.png` | the owner right after starting the match |
| `09-owner-chat-match-started.png` | **owner**: the match-started notice |
| `10-rival-chat-match-started.png` | **second account**: the match-started notice |
| `11-rival-in-match.png` | the second account in the match arena |
| `12-rival-forfeited.png` | the forfeit that ended the match |
| `13-owner-chat-match-result.png` | **owner**: the match-result notice |
| `14-rival-chat-match-result.png` | **second account**: the match-result notice |
| `15-owner-withdrew-challenge.png` | the owner withdrawing the second challenge |
| `16-owner-chat-cancelled.png` | **owner**: the cancellation notice |
| `17-rival-chat-cancelled.png` | **second account**: the cancellation notice |
| `18-owner-after-reload.png` | the owner's transcript after the reload |
| `19-rival-after-reload.png` | the second account's transcript after the reload |
| `20-owner-chat-expired.png` | **owner**: the expiry cancellation notice |
| `21-rival-chat-expired.png` | **second account**: the expiry cancellation notice |

`evidence.json` is the machine-readable record of the run: every step with
its timestamp, the exact card labels and text each client showed, and the
before/after reload counts.

## What this does and does not prove

Proven by this run:

- a challenge invitation from an authenticated owner reaches the other
  account's conversation, and the Game service accepts it as the room owner;
- the second account can accept the invitation and join the room;
- a real match start, a real forfeit and a real challenge withdrawal each
  produce one persisted notice that both clients receive live;
- an expired challenge produces the same cancellation notice through the
  Game service's own expiry sweep;
- reloading and reconnecting neither loses nor duplicates a notice.

Not proven by this run, and still limited:

- **Broker delivery is best effort.** The Game service publishes on the
  `game.events` exchange with a bounded retry and never blocks gameplay on
  the broker. If the broker is unavailable, an event can be lost; only a
  challenge that is still open is retried later by the expiry sweep. The
  evidence above was collected with the broker reachable.
- **A service restart can drop an in-flight event.** The publisher holds no
  outbox, so an event published just before the Game service stops may not
  reach Chat. There is no replay of missed events on restart.
- The demo covered the **1v1** mode. The 2v2 path shares the same event
  contract and the same Chat code.
- The expiry step advanced the **fixture's** clock: the room's `expires_at`
  was moved into the past in the disposable Game database so the production
  sweep (which runs every 30 seconds) would notice it immediately. The
  detection, the publish and the Chat write are all the production path; only
  the wait was shortened.
- The two sessions ran on one machine and one loopback address, so they are
  two clients, not two remote computers. Remote-play latency and recovery
  remain tracked separately under **G02**.

## Cleanup

The disposable project was removed with `docker compose down -v`, which
deletes its containers, network and volumes. The running Nook stack was never
stopped or rebuilt: its Chat database still has the eight tables it had before
the demonstration and no `GameChallenge` table.
