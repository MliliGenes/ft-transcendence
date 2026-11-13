# EGM Drift Report — 2026-11-12

> This report records the findings at the start of the 2026-11-12 audit. The source-document findings were corrected during the same work session. Evidence review also corrected the earlier claim that the four-client 2v2 run completed a match. The full project check then passed. Follow-up: source changes were committed as `1b8ad5f`; Graphify and Understand were refreshed from that commit, and the handbook was rebuilt from those current maps on 2026-11-13. The findings below preserve the audit's initial observations and are not a list of current open defects.

## README.md
- The architecture diagram and summary describe User events travelling through RabbitMQ to Chat and Game, but omit the current Game-to-Chat `game.events` path used for Code Arena invitation and match lifecycle notifications. Add that link so the overview matches the G06 implementation described later in the README.

## CONTEXT.md
- The glossary says every 2v2 submission needs both teammates marked Ready. The current rule lets the remaining teammate approve and submit alone after an explicit teammate departure, or once the 90-second reconnect window expires. The detailed integration specification has the current rule.

## docs/README.md
- No drift detected.

## client/AGENTS.md
- No drift detected. Its Next.js-generated guidance matches the current client configuration.

## graphify-out/GRAPH_REPORT.md
- The report says it was built from commit `3fe061a1`; the current `HEAD` is `348a844`, and the worktree also has uncommitted changes. Refresh the graph before presenting it as a map of the current code.

## docs/services/client.md
- The route table lists `/play/arena/[matchId]`. The current match page is `/play/match/[id]`.

## docs/services/infrastructure.md
- The environment-file table omits the Game database, Game service and Judge Worker files. It also says the shared runtime and RabbitMQ settings are used by “both backends,” although Compose passes them to User, Chat and Game.
- The non-destructive restore example covers User and Chat only; there is no equivalent Game database example even though the guide lists a Game backup container and the complete recovery guide asks operators to verify all three databases.

## docs/services/chat-service.md
- The socket event list omits `typing:changed` and `read:updated`. Its limitations section says read state reaches other clients only after refetching, but the current gateway broadcasts read-state changes live.
- The same limitations section says a self-DM causes HTTP 500. The current service rejects it with HTTP 400.

## docs/services/user-service.md
- No drift detected.

## envs/README.md
- No drift detected.

## client/README.md
- The scaffold text says the project loads Geist as its font. The current layout uses Inter for the main interface and Geist Mono for code.

## docs/spec/code-arena-integration-spec.md
- After recording the completed four-client 2v2 run on 2026-11-12, the final paragraph still says a four-client demonstration must be done. Clarify that the local run is complete and identify only the remaining evaluator or separate-computer checks; G02 still requires separate computers.

## docs/spec/code-arena-gameplay-review.md
- No drift detected. The report identifies the local four-client run and keeps separate-computer and production checks open.

## docs/archive/client-plan.md
- The archived plan links to `PROFILE_DESIGN_SPEC.md`, which is not present at that location. The document is explicitly archived, so its old feature-status entries are historical rather than current implementation claims.

## chat-service/README.md
- No drift detected.

## docs/evidence/g06-live-demo/README.md
- No drift detected. This is a dated record of the 2026-11-11 run and describes its limits.

## docs/adr/0016-one-game-service-instance.md
- No drift detected.

## docs/adr/0015-code-arena-nook-integration.md
- No drift detected.

## docs/infra/BACKUP_RECOVERY.md
- The guide asks readers to validate restored User, Chat and Game databases, but its linked non-destructive restore instructions provide examples for User and Chat only. Add the Game equivalent so the documented three-database recovery check can be followed end to end.

## docs/superpowers/plans/2026-11-11-verification-guardrails.md
- No drift detected. This is a dated, completed implementation plan and its verification results are explicitly recorded as historical evidence.

## docs/superpowers/plans/2026-11-11-nook-arena-platform-integration.md
- No drift detected. This is a dated, completed integration plan; its remaining actions are recorded as actions that were open at that time.

## docs/integrations/feed.md
- No drift detected.

## docs/integrations/user-chat.md
- The opening calls this the “full RabbitMQ guide,” but it describes the User-to-Chat `user.events` flow only. RabbitMQ also carries Game-to-Chat `game.events` and User deletion events to Game. Narrow that description or link the other broker flows.

## docs/integrations/client-backend.md
- The browser-path table lists User, Chat and MinIO but not the current Game HTTP route `/api/game/` or Game Socket.IO route `/api/game/socket.io/`. Add both so this integration map covers all browser-facing services.

## docs/integrations/chat-storage.md
- The upload and verification walkthrough describes an image/PDF-only 10 MiB limit. The current service also accepts MP4, WebM and MOV videos up to 50 MiB; the opening summary already mentions the larger video limit, so the detailed steps contradict it.
- The retry-hash explanation omits `gameChallengeRoomCode`. The current hash includes that value as well as the conversation, message text and attachments.

## docs/project/COMPOSE.md
- The directory tree omits `volumes/chat-db/`, which Compose mounts for the Chat database.
- The text says RabbitMQ is shared by User and Chat, but Game also loads the broker settings. It describes User events reaching Chat without mentioning Game’s lifecycle events reaching Chat.
- The link text says `docs/archive/auth-profile-web.md`, but its target is `docs/services/client.md`.

## docs/project/VERIFICATION.md
- No drift detected. The live demonstration and verification statements are dated and scoped to the checks they record.

## docs/project/INTEGRATION_STATUS.md
- No drift detected as a dated 2026-11-11 verification snapshot. The results should not be read as a new verification of later worktree changes.

## docs/project/PROJECT_CONTEXT.md
- The confirmed-decision table says the first game and first-release game count are still open. This repository now identifies Code Arena as its first playable game and its current release contains that one game; future games remain a separate possibility.

## docs/project/POINTS_ROADMAP.md
- Phase 1 still marks the core group and channel backend as unfinished and says to complete it before starting the main UI. The Chat service now has secured group, membership, channel and message routes, and the main Next.js UI is already in place. The opening caveat says those old checklists were not re-audited, but the roadmap still needs the implemented work and remaining acceptance checks separated.

## user-service/README.md
- The link label says `postgres/README.md`, but its destination is the general infrastructure guide. Rename the link text so readers know what it opens.

## user-service/test/README.md
- No drift detected.

## docs/api/chat-service.openapi.json
- `SendMessageRequest` does not describe the current optional `gameChallenge: { roomCode }` field, and the response `Message` schema omits the current `kind` field used to distinguish normal messages from Game system notices.
- The retry description says the conflict check compares only conversation and content; the current canonical hash also includes attachments and the Game challenge room code.
- The Socket.IO appendix lists only `message:created`; the current gateway also uses presence, typing and read-state events.

## docs/api/user-service.openapi.json
- The account-update description broadly says email verification is not implemented. Registration verification and the verification endpoint are implemented. When an account changes its email, the service clears the verified flag but does not send a new verification link, and login is still allowed; document that specific limitation instead.

## docs/requirements/index.html
- No drift detected. The tracker is a requirements reference, starts with no modules certified, and points back to the supplied subject.

## docs/book/Nook-Book.pdf
- The generated handbook repeats stale content from its source guides: it lists `/play/arena/[matchId]` instead of `/play/match/[id]`, says read-state changes require refetching, and says self-DMs return HTTP 500. Its architecture overview also omits the Game-to-Chat lifecycle-event path. Rebuild it after correcting the source documents.
- The handbook explicitly labels its code graph and knowledge graph as coming from the older `3fe061a1` snapshot, so those pages are transparent about their age; refresh those graphs before regenerating if the book is meant to map the current code.
