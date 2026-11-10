# 0015. Code Arena Integration into Nook

Date: 2026-11-09
Status: Accepted and implemented; final live evaluation remains a team demonstration

## Context

Nook's first game is Code Arena, a timed coding game for 1v1 duels and 2v2 teams. It is integrated into the existing Next.js client and Compose project alongside the User and Chat services. The integration needs one identity across Nook, game persistence isolated from social and chat data, responsive realtime play, safe code evaluation, and links from existing Nook conversations and profiles.

## Decisions

1. **Keep service ownership clear.** User service owns accounts and authentication; Chat owns DMs, groups, messages and attachments; Game owns rooms, matches, rounds, submissions, results and collaborative editor snapshots. No service reads another service's database directly.

2. **Use the Nook account identity.** Game validates the RS256 access token issued by User service and takes the user UUID from its `sub` claim. It does not duplicate account credentials or assume a username is carried in the token. Client lobby and profile history views resolve public names and avatars through the User account API.

3. **Route Game through the existing HTTPS gateway.** Nginx sends `/api/game/` and `/api/game/socket.io/` to Game. Chat continues to use its canonical `/api/chat/` paths; the legacy `/socket.io/` path is reserved for Chat. Browser clients use the same-origin canonical Game paths.

4. **Persist match state in Game PostgreSQL.** Game snapshots, rounds, submissions, reveals and collaborative documents are owned by its database. Submission and judge work use bounded in-process queues; Redis is not part of the current Game runtime and is not included as a Compose dependency.

5. **Keep code evaluation behind a dedicated boundary.** Game sends evaluation requests to the judge worker on a private Compose network. The worker starts resource-limited containers with networking disabled and restricted filesystem/capabilities. Match history, profile summaries and the leaderboard expose result summaries, never source code or hidden test data.

6. **Use both Nook Chat and game team chat for their intended jobs.** Direct-message invitations are persisted by Chat and link to a private Game room. Match-scoped 2v2 team chat runs on Game's `/chat` namespace so it is isolated to the active team's match.

7. **Use the integrated `/play` routes.** `/play` provides matchmaking and private-room entry; `/play/lobby/[code]` assembles participants and readiness; `/play/match/[id]` hosts gameplay; `/play/leaderboard` shows public results. CodeMirror and Yjs stay in client components because the editor needs browser APIs.

8. **Retain the existing Nook design and validation.** New views use the shared Nook tokens and Tabler icons. Match IDs, invitation codes, profile identifiers and API response data are validated at service boundaries.

## Consequences and known limits

- Code Arena provides three seeded problem IDs to a three-round match, avoiding repeats in the default pool.
- The game supports four simultaneous participants in 2v2; separate-client remote play and reconnect behavior must still be demonstrated during evaluation.
- Profile statistics and leaderboard currently use wins, losses, draws and win rate; there is no Elo rating, achievement or progression system.
- The invitation card opens the lobby and the Game service checks joinability, but the chat card does not display a separate live availability status.
- Account deletion propagates to Chat's cached profile but not to Game. Prior match identifiers, code submissions and collaborative snapshots can remain in Game PostgreSQL; see the [Privacy Policy](../../client/app/privacy/page.tsx).
- Module eligibility is not guaranteed by this architecture decision. Use the [local module tracker](../requirements/index.html) and verify each criterion with the team and evaluator.
