# Graph Report - ft-transcendence  (2026-11-14)

## Corpus Check
- 524 files · ~976,298 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 48 file(s) not represented in the graph (top: (none) 25, .example 14, .toml 3)

## Summary
- 5028 nodes · 11344 edges · 250 communities (206 shown, 44 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 352 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c52c1d41`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SubmissionRecord
- ref_node_assert
- AuthenticatedRequest
- SuperadminService
- FriendshipsService
- ref_nestjs_common
- ChatService
- Discord OAuth
- GithubStrategy
- SendMessageDto
- engine.ts
- devDependencies
- Request
- AuthService
- User Bootstrap Scripts
- app/app.module.ts
- superadmin.service.ts
- ArenaTransport
- user-service/package.json
- chat.module.ts
- sidebar.tsx
- MatchRecord
- Chat TypeScript Configuration
- ref_vitest
- User TypeScript Configuration
- chat-service/package.json
- ChatGateway
- arena-editor-collab-lifecycle.test.mjs
- dependencies
- socketPrincipal
- FeedService
- devDependencies
- User Scripts and Commands
- chat-service/tsconfig.build.json
- auth.service.ts
- ArenaEngine
- auth.controller.ts
- Nook — Project Context
- docs/README.md
- useAuth
- chat-workspace.tsx
- ref_class_validator
- socket.ts
- Points Roadmap: Groups First, Frontend Next
- User Lint Configuration
- details-panel.tsx
- Chat Nest Build Setup
- public-profile.tsx
- User Nest Build Setup
- Button
- LobbyClient
- ThemeSelector
- Nginx Entrypoint
- dependencies
- ref_node_test
- search-view.tsx
- SocketArenaTransport
- build-dashboards.mjs
- components.json
- bootstrap-superadmin-env.mjs
- RabbitMqEventsService
- compilerOptions
- build.mjs
- EGM Drift Report — 2026-11-12
- game-notifications.postgres.test.mjs
- minio.service.ts
- client/package.json
- game.service.ts
- AccountSearchDto
- ref_node_fs
- GameDependencies
- evaluation-orchestration.ts
- ref_node_child_process
- dependencies
- User and chat integration
- Local Compose setup
- game-notifications.service.ts
- PostgresStores
- types.ts
- emoji-picker.tsx
- CollabDocs
- user-service/README.md
- SupportedLanguage
- Chess Page
- Database Verification
- http-server.ts
- secrets.mjs
- DatabaseConfigSpecs
- LobbyController
- MatchPersistence
- GameService
- ProfileEditor
- Auth Checks
- judge.ts
- EvaluationOrchestrator
- LobbyError
- user-service/tsconfig.build.json
- ComposeYamlConfig
- PackageJsonMeta
- scripts
- judge0.ts
- Container Configuration
- mail.service.ts
- Arena Dependencies
- generate-jwt-keys.mjs
- client/README.md
- Code Arena gameplay review
- AGENTS.md
- requirePrincipal
- game-events.publisher.ts
- properties
- CollabClient
- System Startup Guide
- MockGame
- BoundedJobQueue
- round-lifecycle.ts
- MatchSocketPresence
- game.module.ts
- auth-storage.test.mjs
- Service Dependencies List
- Chat service
- game/user-events.consumer.ts
- envs/README.md
- team-chat.gateway.ts
- arena-socket-path.test.mjs
- PrismaService
- Judge Worker Package
- InMemoryLobbyStore
- FakeJudge
- Judge0Adapter
- match-statistics.ts
- init.sh
- 10-monitoring-role.sh
- DiscordStrategy
- Docker Build Context
- fixtures.ts
- mock-game.ts
- Arena Harness Package
- TeamChatClient
- JudgeInfraError
- Arena Model Package
- Health Checks
- type
- sidecars.ts
- Git Analytics Config
- properties
- user-service/src/auth/auth.module.ts
- Nook
- GithubStrategy
- Code Stats
- Container Configs
- Env Variables
- Database Volumes
- Docker Options
- Service Health
- providers.tsx
- Docker Networks
- Analytics Flags
- Web client
- Datasource Config
- Alert Rules
- Game TS Config
- Game DB
- User DB
- Monitoring Stack
- User service
- GameJudge
- Legal Pages
- Backup Storage Init Container
- Product Roadmap
- Nook Config
- Build TS Config
- arena-model/src/index.ts
- Model TS Config
- Build Model Config
- Judge Worker
- MatchMode
- Logging Configuration
- Prometheus Settings
- src/lobby.ts
- Minio Init
- Alloy Config
- Nook Arena Integration
- Compiler Options
- Harness Compiler
- book/package.json
- Docker Commands
- Notification Cleanup
- Command Verification
- Verification Plan
- Build Config
- route.ts
- Logging Metrics
- Client console cleanup
- Credential Exposure
- Integration Spec
- verify-recovery.sh script
- Docker Logs
- Architectural Context
- LobbyStore
- accounts.service.ts
- Theme Tokens
- Integration Decision
- Project scan map
- game/team-2v2.test.ts
- Job Queue
- ConfirmPasswordResetDto
- arena/chat.ts
- devDependencies
- provenance
- ArenaSnapshot
- esc
- Dev Cert Gen
- Play Script
- Judge Worker Entrypoint Script
- ChatUser
- UpdateAccountDto
- ArenaWorkspace
- TransportSession
- Nook documentation
- Code Arena lifecycle notifications
- schema.json
- Domain docs
- Issue tracker: Local Markdown
- docChapter
- Complete snapshots and recovery (D04)
- Messages
- starters
- describe
- renderApi
- check.mjs
- tags
- book-build.test.mjs
- memoryLimitMb
- visibleTests
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `MatchRecord` - 125 edges
2. `ArenaEngine` - 92 edges
3. `GameService` - 86 edges
4. `Button()` - 78 edges
5. `useAuth()` - 58 edges
6. `ChatWorkspace()` - 54 edges
7. `next` - 54 edges
8. `react` - 52 edges
9. `SideId` - 51 edges
10. `SubmissionRecord` - 48 edges

## Surprising Connections (you probably didn't know these)
- `Limits` --references--> `PresenceAudienceService`  [INFERRED]
  docs/integrations/feed.md → chat-service/src/chat/presence/presence-audience.service.ts
- `4.3 Consumer contract: `chat-service/src/events/user-event.ts`` --references--> `parseUserEvent()`  [INFERRED]
  docs/integrations/user-chat.md → chat-service/src/events/user-event.ts
- `10. Evaluation Q&A` --references--> `MessageAttachment()`  [INFERRED]
  docs/integrations/chat-storage.md → client/components/app/chat/message-list.tsx
- `Integrations (merging points)` --references--> `ChatUser`  [INFERRED]
  docs/README.md → client/lib/chat/client.ts
- `Social` --references--> `BlocksService`  [INFERRED]
  docs/services/user-service.md → user-service/src/social/blocks.service.ts

## Import Cycles
- None detected.

## Communities (250 total, 44 thin omitted)

### Community 0 - "SubmissionRecord"
Cohesion: 0.06
Nodes (10): InMemoryCollabPersist, StoreBackedMatchPersistence, PostgresSubmissionStore, SubmissionRecord, InMemoryRevealStore, InMemorySubmissionStore, SubmissionStore, persistence() (+2 more)

### Community 1 - "ref_node_assert"
Cohesion: 0.16
Nodes (4): bcrypt, digest(), readSession(), mail

### Community 2 - "AuthenticatedRequest"
Cohesion: 0.19
Nodes (4): AccountsController, accountResponse(), UploadedImage, AuthenticatedRequest

### Community 4 - "FriendshipsService"
Cohesion: 0.09
Nodes (4): BlocksService, FriendshipsService, GetFriendshipsRequest, SocialController

### Community 5 - "ref_nestjs_common"
Cohesion: 0.07
Nodes (18): AuthenticatedRequest, EnsureActiveUserGuard, GameRoomsClient, RoomLookupResponse, RoomResponse, GroupDb, PresenceAudienceService, PresenceChange (+10 more)

### Community 6 - "ChatService"
Cohesion: 0.07
Nodes (6): ChatController, ChatService, isUniqueViolation(), EditMessageDto, GetMessagesQueryDto, Block checks

### Community 10 - "engine.ts"
Cohesion: 0.06
Nodes (37): COLLAB_TEXT_KEY, CollabPersist, CollabRow, EngineOptions, ExpiredError, MATCH_DURATION_MS, RatePolicy, SealedSnapshot (+29 more)

### Community 11 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, dotenv, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier (+11 more)

### Community 12 - "Request"
Cohesion: 0.07
Nodes (7): CreateChannelDto, CreateGroupDto, UpdateChannelDto, GroupsController, GroupsService, Isolation from normal chat, Request

### Community 13 - "AuthService"
Cohesion: 0.16
Nodes (3): AuthService, DiscordProfile, GithubProfile

### Community 14 - "User Bootstrap Scripts"
Cohesion: 0.08
Nodes (26): scripts, bootstrap:superadmin, bootstrap:superadmin:env, build, deploy, format, lint, pretest (+18 more)

### Community 15 - "app/app.module.ts"
Cohesion: 0.09
Nodes (9): AccountsModule, AppController, AppModule, AppService, AuthModule, EventsModule, PrismaModule, SocialModule (+1 more)

### Community 16 - "superadmin.service.ts"
Cohesion: 0.12
Nodes (5): CreateUserDto, UpdateRoleDto, UserQueryDto, SuperadminGuard, adminUserSelect

### Community 17 - "ArenaTransport"
Cohesion: 0.11
Nodes (4): ArenaWorkspaceProps, useArena(), ArenaTransport, ArenaConnectionOptions

### Community 18 - "user-service/package.json"
Cohesion: 0.05
Nodes (40): argon2, sharp, @types/bcrypt, author, description, amqp-connection-manager, amqplib, class-transformer (+32 more)

### Community 19 - "chat.module.ts"
Cohesion: 0.08
Nodes (11): AppController, AppModule, AppService, AuthModule, ChatModule, ChatSharedModule, GroupsModule, PresenceModule (+3 more)

### Community 20 - "sidebar.tsx"
Cohesion: 0.07
Nodes (41): AppLayout(), SavedSidebarShell(), AppNavigation(), AppShell(), navigation, Separator(), Sheet(), SheetContent() (+33 more)

### Community 21 - "MatchRecord"
Cohesion: 0.12
Nodes (13): collabRoomId(), IllegalStateError, MatchRecord, MemberReadiness, Participant, RoundState, SideId, TeamDocState (+5 more)

### Community 22 - "Chat TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 23 - "ref_vitest"
Cohesion: 0.05
Nodes (35): ProblemBank, FileBank, testPrincipal(), InMemoryMatchStore, PG_URL, C_SOLVE, CPP_SOLVE, LIMITS (+27 more)

### Community 24 - "User TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 25 - "chat-service/package.json"
Cohesion: 0.05
Nodes (40): author, description, amqp-connection-manager, amqplib, class-transformer, class-validator, @nestjs/cli, @nestjs/common (+32 more)

### Community 26 - "ChatGateway"
Cohesion: 0.13
Nodes (3): ChatGateway, PresenceService, gatewayWith()

### Community 27 - "arena-editor-collab-lifecycle.test.mjs"
Cohesion: 0.08
Nodes (24): cmState, cmView, { CollabClient }, createCollabModule(), createdClients, createEditorModule(), createHarness(), useEffect() (+16 more)

### Community 28 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, amqp-connection-manager, amqplib, argon2, bcrypt, class-transformer, class-validator, @nestjs/common (+11 more)

### Community 29 - "socketPrincipal"
Cohesion: 0.06
Nodes (17): CollabGateway, GameGateway, roomFor(), LobbyGateway, roomChannel(), userChannel(), attachSocketPrincipal(), chooseHandshakeValue() (+9 more)

### Community 30 - "FeedService"
Cohesion: 0.10
Nodes (13): isDate(), parseUserEvent(), USER_EVENT_TYPES, UserEvent, UserProfileData, UserEventsConsumer, FeedService, Client (+5 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier, source-map-support (+8 more)

### Community 32 - "User Scripts and Commands"
Cohesion: 0.12
Nodes (16): scripts, build, deploy, format, lint, prisma:generate, start, start:debug (+8 more)

### Community 33 - "chat-service/tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 34 - "auth.service.ts"
Cohesion: 0.10
Nodes (8): AUTH_TOKEN_PATTERN, AuthResult, LoginDto, REFRESH_TOKEN_PATTERN, RefreshDto, RegisterDto, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS

### Community 35 - "ArenaEngine"
Cohesion: 0.11
Nodes (10): ArenaEngine, driverFor(), AuthenticatedPrincipal, CollabFixture, setupCollab(), realEngine(), createMatch(), twoEngines() (+2 more)

### Community 36 - "auth.controller.ts"
Cohesion: 0.13
Nodes (12): AuthController, assertTrustedBrowserOrigin(), trustedBrowserOrigins(), RequestEmailVerificationDto, RequestPasswordResetDto, clearRefreshCookie(), publicSession(), readRefreshCookie() (+4 more)

### Community 37 - "Nook — Project Context"
Cohesion: 0.09
Nodes (22): 10. Backlog organization, 11. Design context, 12. Questions to settle next, 13. Source and decision history, 1. Nook in one paragraph, 2. How to interpret this document, 3. Confirmed decisions, 4. Audience and reason to return (+14 more)

### Community 39 - "useAuth"
Cohesion: 0.05
Nodes (67): metadata, metadata, SettingsPage(), ForgotPasswordPage(), metadata, LoginPage(), metadata, metadata (+59 more)

### Community 40 - "chat-workspace.tsx"
Cohesion: 0.07
Nodes (34): ChatContent(), ChatPage(), ChatPageProps, metadata, EmojiPicker(), applyMarkdownFormat(), formats, MarkdownFormat (+26 more)

### Community 41 - "ref_class_validator"
Cohesion: 0.07
Nodes (12): AuthGuard, AccessTokenPayload, CurrentUser, IS_PUBLIC_KEY, ATTACHMENT_CONTENT_TYPES, CreateAttachmentUploadUrlDto, CreateDmDto, MarkReadDto (+4 more)

### Community 42 - "socket.ts"
Cohesion: 0.11
Nodes (15): ArenaHeaderProps, adapt(), adaptFinal(), adaptReveal(), RateLimitError, ServerReveal, shouldApplyUpdate(), SnapshotTrigger (+7 more)

### Community 43 - "Points Roadmap: Groups First, Frontend Next"
Cohesion: 0.12
Nodes (17): Current scoring position, Delivery Roadmap: Nook and Code Arena, Optional: add Chess as a second game, Other module candidates, Phase 1 — Group chat backend implemented; acceptance remains open, Phase 2 — Make presence and activity data usable, Phase 3 — Build the main frontend as feature-sized sessions, Phase 4 — Add two low-scope completion tasks (+9 more)

### Community 44 - "User Lint Configuration"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Community 45 - "details-panel.tsx"
Cohesion: 0.05
Nodes (85): PlayLeaderboardPage(), AccountAvatar(), colors, ChatMarkdown(), components, markdownClass, remarkPlugins, DirectDetails() (+77 more)

### Community 46 - "Chat Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 47 - "public-profile.tsx"
Cohesion: 0.10
Nodes (34): FeedPage(), metadata, instant, metadata, PublicProfilePage(), metadata, ProfilePage(), CodeArenaProfile() (+26 more)

### Community 48 - "User Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 49 - "Button"
Cohesion: 0.16
Nodes (25): StatusPage(), CreateGroupDialog(), ConfirmDialog(), ChannelEditor(), ChannelsTab(), errorMessage(), GroupDetailsEditor(), GroupSettingsView() (+17 more)

### Community 50 - "LobbyClient"
Cohesion: 0.06
Nodes (31): instant, LobbyRoomPage(), metadata, PlayPage(), LobbyView(), handleCopy(), handleLeave(), handleStart() (+23 more)

### Community 51 - "ThemeSelector"
Cohesion: 0.07
Nodes (41): AppError(), AppLoading(), AppNotFound(), metadata, AuthLayout(), RootError(), LegalLayout(), Loading() (+33 more)

### Community 54 - "dependencies"
Cohesion: 0.08
Nodes (24): dependencies, @base-ui/react, boring-avatars, class-variance-authority, cn, @codemirror/commands, @codemirror/lang-cpp, @codemirror/lang-python (+16 more)

### Community 55 - "ref_node_test"
Cohesion: 0.05
Nodes (25): cancelled, notifications, result, started, MEMBERS, ROOM, FakeSocket, io() (+17 more)

### Community 56 - "search-view.tsx"
Cohesion: 0.06
Nodes (39): instant, MatchPage(), metadata, metadata, SearchPage(), accountName(), DEFAULT_FILTERS, PeopleFilters (+31 more)

### Community 58 - "build-dashboards.mjs"
Cohesion: 0.16
Nodes (16): handleSend(), alertList(), dashboards, grid, logsPanel(), LOKI, OUT, place() (+8 more)

### Community 59 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 60 - "bootstrap-superadmin-env.mjs"
Cohesion: 0.24
Nodes (5): databaseUrl, dotenv, databaseUrl, args, bootstrapSuperadmin()

### Community 61 - "RabbitMqEventsService"
Cohesion: 0.16
Nodes (9): 4.1 Event shapes: `user-service/src/events/user-event.types.ts`, 4.2 Publisher: `user-service/src/events/rabbitmq-events.service.ts`, 4.3 Consumer contract: `chat-service/src/events/user-event.ts`, 4. The code, file by file, RabbitMqEventsService, USER_EVENT_TYPES, UserEvent, UserProfileData (+1 more)

### Community 62 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 63 - "build.mjs"
Cohesion: 0.08
Nodes (21): BRANCH, chatApi, chromeCandidates, DIST, excluded(), executablePath, gg, ggReport (+13 more)

### Community 65 - "EGM Drift Report — 2026-11-12"
Cohesion: 0.05
Nodes (37): chat-service/README.md, client/AGENTS.md, client/README.md, CONTEXT.md, docs/adr/0015-code-arena-nook-integration.md, docs/adr/0016-one-game-service-instance.md, docs/api/chat-service.openapi.json, docs/api/user-service.openapi.json (+29 more)

### Community 66 - "game-notifications.postgres.test.mjs"
Cohesion: 0.07
Nodes (17): keys, pool, post(), prisma, signer, broadcasts, createDm(), createGameRoom() (+9 more)

### Community 67 - "minio.service.ts"
Cohesion: 0.07
Nodes (30): clientOptions(), minioBucket(), minioClientOptions(), minioPresignClientOptions(), port(), required(), useSsl(), MINIO_CLIENT (+22 more)

### Community 68 - "client/package.json"
Cohesion: 0.05
Nodes (40): AppliedEdit, applyLocalEdit(), ArenaLanguage, collaborativeExtensions(), EditorAdapter, EditorAdapterHandle, EditorAdapterProps, EditorSelection (+32 more)

### Community 69 - "game.service.ts"
Cohesion: 0.07
Nodes (3): RateLimitedError, LOBBY_PROBLEM_POOL, selectLobbyProblems()

### Community 71 - "ref_node_fs"
Cohesion: 0.09
Nodes (34): app, loadBankProblem(), BANK_DIR, SCHEMA_REQUIRED, workspaceTestSteps(), main(), REQUIRED_STEPS, validateG06Evidence() (+26 more)

### Community 72 - "GameDependencies"
Cohesion: 0.04
Nodes (47): dependencies, amqp-connection-manager, amqplib, arena-game-engine, arena-model, @nestjs/common, @nestjs/core, @nestjs/platform-express (+39 more)

### Community 73 - "evaluation-orchestration.ts"
Cohesion: 0.10
Nodes (8): EvaluationCompletion, EvaluationIdentity, EvaluationInFlightRegistry, EvaluationRecoveryReport, InFlightEvaluation, CountedResult, SubmissionStatus, SealedVerdict

### Community 74 - "ref_node_child_process"
Cohesion: 0.07
Nodes (19): root, scratchDirs, api(), CollabSync, headers(), newTeamMatch(), ownRevision(), api() (+11 more)

### Community 75 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, amqp-connection-manager, amqplib, class-transformer, class-validator, minio, @nestjs/common, @nestjs/config (+12 more)

### Community 76 - "User and chat integration"
Cohesion: 0.22
Nodes (9): 10. Hands-on lab (15 minutes, do this before the defense), 11. Evaluation Q&A, 12. Cheat sheet, 2. Primer: the five RabbitMQ words you need, 3. The topology in this project, 7. Known limitations (be honest about these in the defense), 8. Infrastructure, 9. Monitoring (+1 more)

### Community 77 - "Local Compose setup"
Cohesion: 0.29
Nodes (7): First startup, Frontend, Local Compose setup, Local HTTPS and OAuth, Monitoring, Network and storage, Plug in another service

### Community 78 - "game-notifications.service.ts"
Cohesion: 0.06
Nodes (40): formatGameNotification(), GAME_NOTIFICATION_HEADER, GAME_NOTIFICATION_TYPES, GameNotificationType, isRoomCode(), ROOM_CODE_PATTERN, singleLine(), deterministicUuid() (+32 more)

### Community 79 - "PostgresStores"
Cohesion: 0.09
Nodes (9): EvaluationClaim, EvaluationClaimLostError, PostgresCollabStore, PostgresEvaluationClaim, PostgresMatchStore, PostgresStores, saveMatchTx(), pgUp() (+1 more)

### Community 80 - "types.ts"
Cohesion: 0.13
Nodes (18): MatchResultProps, ProblemPanel(), ProblemPanelProps, RoundScoreRevealProps, StatusBadge(), TestPanel(), TestPanelProps, ArenaProblem (+10 more)

### Community 81 - "emoji-picker.tsx"
Cohesion: 0.24
Nodes (8): EmojiPanel(), pick(), readRecent(), writeRecent(), allEmojis, Emoji, emojiCategories, EmojiCategory

### Community 82 - "CollabDocs"
Cohesion: 0.12
Nodes (5): b64decode(), b64encode(), CollabDocs, TeamCollaborationOptions, createCollaboration()

### Community 83 - "user-service/README.md"
Cohesion: 0.17
Nodes (11): Compile and run the project, Deployment, Description, License, Observability, Project setup, Resources, Run tests (+3 more)

### Community 84 - "SupportedLanguage"
Cohesion: 0.26
Nodes (9): ContainerJudge, BankProblem, EvaluationRunInput, CaseResult, DriverKind, JudgeLimits, SupportedLanguage, VisibleTest (+1 more)

### Community 85 - "Chess Page"
Cohesion: 0.60
Nodes (3): ChessPage(), metadata, ComingSoon()

### Community 86 - "Database Verification"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER (+25 more)

### Community 87 - "http-server.ts"
Cohesion: 0.16
Nodes (15): authenticated(), BodyTooLargeError, createJudgeWorkerServer(), handleRequest(), errorResponse(), InvalidRequestError, isDriver(), isLanguage() (+7 more)

### Community 88 - "secrets.mjs"
Cohesion: 0.27
Nodes (15): requireScanner(), baseline, checkPaths(), forbiddenPath(), git(), main(), requireBaseline(), runScanner() (+7 more)

### Community 89 - "DatabaseConfigSpecs"
Cohesion: 0.06
Nodes (32): analytics, reporting_enabled, auth_enabled, common, path_prefix, replication_factor, ring, storage (+24 more)

### Community 90 - "LobbyController"
Cohesion: 0.12
Nodes (5): LobbySideId, PrivateRoom, PrivateRoomMember, RoomWithMembers, LobbyController

### Community 91 - "MatchPersistence"
Cohesion: 0.10
Nodes (8): MatchAuthority, NotMemberError, MatchPersistence, assertPersistenceContract(), makeMatch(), makeReveal(), makeSubmission(), PG_CONTRACT_URL

### Community 93 - "ProfileEditor"
Cohesion: 0.17
Nodes (15): EditProfilePage(), metadata, currentValues(), getErrorMessage(), ImagePreview(), ProfileEditor(), saveProfile(), updateField() (+7 more)

### Community 95 - "judge.ts"
Cohesion: 0.11
Nodes (20): CaseInput, ContainerJudgeOptions, decodeBase64(), DEFAULT_IMAGES, EXECUTION_STATUSES, expectedMatches(), parseRunnerRecord(), RawExecution (+12 more)

### Community 96 - "EvaluationOrchestrator"
Cohesion: 0.14
Nodes (3): EvaluationOrchestrationHost, EvaluationOrchestrator, EvaluationProblemBank

### Community 97 - "LobbyError"
Cohesion: 0.38
Nodes (3): capacityFor(), LobbyError, perSideCapacity()

### Community 98 - "user-service/tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 99 - "ComposeYamlConfig"
Cohesion: 0.07
Nodes (27): driver, include, internal, name, networks, default, judge-internal, volumes (+19 more)

### Community 100 - "PackageJsonMeta"
Cohesion: 0.07
Nodes (27): description, engines, node, license, name, private, scripts, build (+19 more)

### Community 101 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 102 - "judge0.ts"
Cohesion: 0.11
Nodes (11): CaseInput, DEFAULT_LANGUAGE_IDS, FetchJudge0HttpClient, Judge0AdapterOptions, Judge0HttpClient, Judge0SubmissionRequest, Judge0SubmissionResponse, SnippetOutput (+3 more)

### Community 103 - "Container Configuration"
Cohesion: 0.09
Nodes (27): build, logging, env_file, image, logging, volumes, driver, build (+19 more)

### Community 104 - "mail.service.ts"
Cohesion: 0.24
Nodes (6): nodemailer, MailService, actionButton(), layout(), passwordResetEmailTemplate(), verificationEmailTemplate()

### Community 105 - "Arena Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, arena-model, pg, yjs, description, devDependencies, @types/pg, typescript (+17 more)

### Community 106 - "generate-jwt-keys.mjs"
Cohesion: 0.40
Nodes (4): directory, { privateKey, publicKey }, privatePath, publicPath

### Community 107 - "client/README.md"
Cohesion: 0.40
Nodes (4): Deploy on Vercel, Learn More, Local development, Production configuration

### Community 108 - "Code Arena gameplay review"
Cohesion: 0.12
Nodes (17): Agreed rules, Code Arena gameplay review, Conditional risks outside the first repair, Conflict behavior and regression coverage, Current full verification — 2026-11-12, Documentation drift — resolved, Existing reconnect defect — resolved, Follow-up verification — 2026-11-12 (+9 more)

### Community 111 - "game-events.publisher.ts"
Cohesion: 0.11
Nodes (12): ChallengeCancelledData, GAME_EVENT_TYPES, GameEvent, GameEventBase, GameEventParticipant, GameEventType, GameMatchMode, MatchEndedData (+4 more)

### Community 112 - "properties"
Cohesion: 0.11
Nodes (20): type, type, type, properties, type, type, type, expected (+12 more)

### Community 113 - "CollabClient"
Cohesion: 0.14
Nodes (10): b64ToBytes(), bytesToB64(), COLLAB_TEXT_KEY, CollabClient, CollabConnection, CollabSyncPayload, colorForUser(), encodeRemoteCursor() (+2 more)

### Community 114 - "System Startup Guide"
Cohesion: 0.08
Nodes (24): Adding a service, Alerts, Complete snapshots (recommended), Dashboards, Data, Environment files, Existing databases, Export a copy (+16 more)

### Community 115 - "MockGame"
Cohesion: 0.17
Nodes (6): FixtureProblem, mockSession, MockGame, fullMatch(), PlayerStatus, RoundPhase

### Community 116 - "BoundedJobQueue"
Cohesion: 0.07
Nodes (21): JudgeWorkerServerOptions, BoundedJobQueue, BoundedJobQueueOptions, Job, JobState, QueueExecutionTimeoutError, QueueFullError, QueueWaitTimeoutError (+13 more)

### Community 117 - "round-lifecycle.ts"
Cohesion: 0.10
Nodes (19): isCompetitiveVerdict(), GroupResult, RoundAdvance, ScoredVerdict, assertRoundScore(), compareSides(), GroupCounts, groupEarnedBp() (+11 more)

### Community 118 - "MatchSocketPresence"
Cohesion: 0.13
Nodes (7): MatchSocketPresence, MatchSocketPresenceMode, MatchSocketPresenceState, MatchSocketPresenceTarget, MemberPresenceCall, RecordingPresenceTarget, SidePresenceCall

### Community 119 - "game.module.ts"
Cohesion: 0.09
Nodes (12): AppModule, ActiveAccountGuard, PrincipalRequest, EngineErrorFilter, GameModule, { privateKey, publicKey }, publicKeyPem, TokenPayload (+4 more)

### Community 120 - "auth-storage.test.mjs"
Cohesion: 0.21
Nodes (12): AuthRequestError, blockedStorage, arenaCases, arenaPendingCases, lobbyHarness(), rejection, button(), componentHarness() (+4 more)

### Community 121 - "Service Dependencies List"
Cohesion: 0.10
Nodes (22): build, condition, depends_on, env_file, environment, logging, depends_on, chat-service (+14 more)

### Community 122 - "Chat service"
Cohesion: 0.22
Nodes (9): Chat service, Commands and tests, Configuration, Current limitations, Direct messages, Error shape, Groups and channels, Presence (+1 more)

### Community 123 - "game/user-events.consumer.ts"
Cohesion: 0.22
Nodes (3): userTokenHash(), GameUserEventsConsumer, parseDeletedUserId()

### Community 124 - "envs/README.md"
Cohesion: 0.40
Nodes (5): Configure a fresh clone, Environment configuration, File ownership, Internal and public addresses, Placeholder convention

### Community 125 - "team-chat.gateway.ts"
Cohesion: 0.09
Nodes (12): isTeamPing(), TEAM_PING_LABELS, TEAM_PINGS, TeamChatAuthContext, TeamChatEntry, TeamChatMessage, TeamChatPing, TeamPing (+4 more)

### Community 126 - "arena-socket-path.test.mjs"
Cohesion: 0.17
Nodes (4): FakeSocket, io(), wait(), waitUntil()

### Community 127 - "PrismaService"
Cohesion: 0.12
Nodes (3): PrismaService, friendshipSelect, friendUserSelect

### Community 128 - "Judge Worker Package"
Cohesion: 0.10
Nodes (19): dependencies, arena-game-engine, devDependencies, @types/node, typescript, vitest, arena-game-engine, @types/node (+11 more)

### Community 130 - "FakeJudge"
Cohesion: 0.20
Nodes (9): ADR-0003, FakeJudge, DEFAULT_LIMITS, HiddenGroup, HiddenGroupVerdict, JudgeLimits, JudgePort, VisibleCase (+1 more)

### Community 132 - "match-statistics.ts"
Cohesion: 0.11
Nodes (13): GameStatsController, buildLeaderboard(), calculateProgression(), CodeArenaAchievement, completedAt(), CompletedMatchSummary, LeaderboardEntry, MatchOutcome (+5 more)

### Community 136 - "Docker Build Context"
Cohesion: 0.12
Nodes (17): context, dockerfile, RABBITMQ_HOST, RABBITMQ_PORT, build, env_file, environment, logging (+9 more)

### Community 137 - "fixtures.ts"
Cohesion: 0.16
Nodes (8): FixtureHiddenGroup, FixtureHiddenTest, FixtureVisibleTest, microProblems(), MockPlayer, OpponentRound, SHUTOUT_OPPONENT, SOLVED_CODE

### Community 138 - "mock-game.ts"
Cohesion: 0.09
Nodes (20): MockSide, Reveal, RunRecord, SubmissionRecord, SubmitReceipt, bothReady(), Presence, Readiness (+12 more)

### Community 139 - "Arena Harness Package"
Cohesion: 0.12
Nodes (16): dependencies, arena-model, description, devDependencies, typescript, vitest, arena-model, typescript (+8 more)

### Community 140 - "TeamChatClient"
Cohesion: 0.15
Nodes (4): TeamChatProps, TeamChatClient, SidecarFactories, SidecarState

### Community 141 - "JudgeInfraError"
Cohesion: 0.21
Nodes (9): JudgeInfraError, SealedEvaluationRequest, SealedGroupResult, isRecord(), parseCaseResult(), parseSealedGroup(), STATUSES, WorkerJudgeAdapter (+1 more)

### Community 142 - "Arena Model Package"
Cohesion: 0.12
Nodes (15): description, devDependencies, typescript, vitest, typescript, vitest, main, name (+7 more)

### Community 143 - "Health Checks"
Cohesion: 0.47
Nodes (15): healthcheck, healthcheck, healthcheck, healthcheck, healthcheck, interval, retries, start_period (+7 more)

### Community 144 - "type"
Cohesion: 0.15
Nodes (15): items, minItems, type, items, minItems, type, items, minItems (+7 more)

### Community 145 - "sidecars.ts"
Cohesion: 0.13
Nodes (23): ArenaSidecarLifecycle, configKey(), createArenaSidecarLifecycle(), cancelChatPending(), cancelCollabPending(), clearChat(), clearCollab(), dispose() (+15 more)

### Community 146 - "Git Analytics Config"
Cohesion: 0.22
Nodes (11): clean(), cwd, date(), git(), main(), escapeHtml(), evidenceDirectory, execFileAsync (+3 more)

### Community 147 - "properties"
Cohesion: 0.13
Nodes (15): minLength, type, enum, pattern, type, properties, description, difficulty (+7 more)

### Community 148 - "user-service/src/auth/auth.module.ts"
Cohesion: 0.21
Nodes (3): AccessTokenGuard, record(), record()

### Community 149 - "Nook"
Cohesion: 0.12
Nodes (16): Architecture, Code Arena integration, Data model overview, Description, Git activity report, Instructions: start the local stack, Module coverage and tracker, Module evidence and point calculation (+8 more)

### Community 151 - "Code Stats"
Cohesion: 0.26
Nodes (12): CodeArenaAchievement, CodeArenaLeaderboardEntry, CodeArenaMatchSummary, CodeArenaOutcome, CodeArenaPlayerStats, CodeArenaProgression, isCount(), isRecord() (+4 more)

### Community 152 - "Container Configs"
Cohesion: 0.15
Nodes (13): condition, depends_on, env_file, image, logging, profiles, restart, user (+5 more)

### Community 153 - "Env Variables"
Cohesion: 0.38
Nodes (13): environment, BACKUP_KEEP_DAYS, BACKUP_KEEP_MONTHS, BACKUP_KEEP_WEEKS, BACKUP_ON_START, HEALTHCHECK_PORT, POSTGRES_EXTRA_OPTS, POSTGRES_HOST (+5 more)

### Community 154 - "Database Volumes"
Cohesion: 0.15
Nodes (13): env_file, environment, image, logging, volumes, MONITORING_PASSWORD_ENV, chat-db, user-db (+5 more)

### Community 155 - "Docker Options"
Cohesion: 0.17
Nodes (13): options, max-file, max-size, env_file, hostname, image, logging, ports (+5 more)

### Community 156 - "Service Health"
Cohesion: 0.21
Nodes (13): depends_on, env_file, healthcheck, image, restart, volumes, interval, retries (+5 more)

### Community 157 - "providers.tsx"
Cohesion: 0.11
Nodes (16): geistMono, inter, metadata, RootLayout(), getQueryClient(), makeQueryClient(), Providers(), AuthProvider() (+8 more)

### Community 158 - "Docker Networks"
Cohesion: 0.17
Nodes (12): environment, image, logging, networks, restart, volumes, CONTAINERS, EVENTS (+4 more)

### Community 159 - "Analytics Flags"
Cohesion: 0.17
Nodes (12): GF_ANALYTICS_CHECK_FOR_PLUGIN_UPDATES, GF_ANALYTICS_CHECK_FOR_UPDATES, GF_ANALYTICS_REPORTING_ENABLED, GF_AUTH_ANONYMOUS_ENABLED, GF_NEWS_NEWS_FEED_ENABLED, GF_SECURITY_COOKIE_SECURE, GF_SECURITY_DISABLE_GRAVATAR, GF_SERVER_ROOT_URL (+4 more)

### Community 160 - "Web client"
Cohesion: 0.18
Nodes (11): Chat workspace, Code Arena, Commands, Current limitations, Design system, Error and loading pages, How data flows, Profile and status (+3 more)

### Community 161 - "Datasource Config"
Cohesion: 0.17
Nodes (11): apiVersion, datasources, access, editable, isDefault, jsonData, name, type (+3 more)

### Community 162 - "Alert Rules"
Cohesion: 0.17
Nodes (11): description, summary, groups, name, rules, severity, alert, annotations (+3 more)

### Community 163 - "Game TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, module, outDir, rootDir, skipLibCheck (+3 more)

### Community 164 - "Game DB"
Cohesion: 0.18
Nodes (11): game-db, depends_on, env_file, image, logging, profiles, restart, user (+3 more)

### Community 165 - "User DB"
Cohesion: 0.18
Nodes (11): user-db, user-db-backup, depends_on, env_file, image, logging, profiles, restart (+3 more)

### Community 166 - "Monitoring Stack"
Cohesion: 0.18
Nodes (10): internal, networks, docker-api, services, volumes, grafana-data, loki-data, prometheus-data (+2 more)

### Community 167 - "User service"
Cohesion: 0.14
Nodes (14): Architecture, Authentication, Commands, Configuration, Current limitations, Data model, Email verification and password reset, Events (+6 more)

### Community 168 - "GameJudge"
Cohesion: 0.17
Nodes (5): EvaluationOrchestratorOptions, GameJudge, configuredPositiveInteger(), createGameJudge(), JudgeEnvironment

### Community 169 - "Legal Pages"
Cohesion: 0.38
Nodes (7): metadata, PrivacyPage(), metadata, TermsPage(), LEGAL_LAST_UPDATED, LegalDocument(), LegalSection()

### Community 170 - "Backup Storage Init Container"
Cohesion: 0.20
Nodes (10): command, entrypoint, image, logging, network_mode, profiles, restart, user (+2 more)

### Community 171 - "Product Roadmap"
Cohesion: 0.20
Nodes (10): 1. Visual foundation and routes — complete, 2. Account session — in progress, 3. Real user data and social interactions — in progress, 4. Chat and Code Arena integration, 5. Remaining app views and release checks, Current state, Milestones, Nook client plan (+2 more)

### Community 172 - "Nook Config"
Cohesion: 0.20
Nodes (9): apiVersion, path, providers, allowUiUpdates, disableDeletion, folder, name, options (+1 more)

### Community 173 - "Build TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, declarationMap, outDir, rootDir, sourceMap, extends, include (+1 more)

### Community 174 - "arena-model/src/index.ts"
Cohesion: 0.15
Nodes (6): ARENA_EVENTS, ArenaEventPayloads, ALL_ROUND_PHASES, HealthController, httpReady(), tcp()

### Community 175 - "Model TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, module, moduleResolution, skipLibCheck, strict, target, types (+1 more)

### Community 176 - "Build Model Config"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, declarationMap, outDir, rootDir, sourceMap, extends, include (+1 more)

### Community 177 - "Judge Worker"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, outDir, rootDir, skipLibCheck, strict, target (+1 more)

### Community 179 - "Logging Configuration"
Cohesion: 0.33
Nodes (9): logging, logging, logging, driver, options, logging, max-file, max-size (+1 more)

### Community 180 - "Prometheus Settings"
Cohesion: 0.22
Nodes (8): global, evaluation_interval, scrape_interval, rule_files, scrape_configs, job_name, static_configs, targets

### Community 181 - "src/lobby.ts"
Cohesion: 0.18
Nodes (8): ExpiredRoomCursor, ExpiredRoomPage, generateInviteCode(), LOBBY_SCHEMA, PrivateRoomStatus, QueueStatus, selectProblems(), GAME_SCHEMA

### Community 182 - "Minio Init"
Cohesion: 0.25
Nodes (8): minio, condition, build, depends_on, env_file, logging, restart, minio-init

### Community 183 - "Alloy Config"
Cohesion: 0.25
Nodes (8): command, depends_on, env_file, image, networks, restart, volumes, alloy

### Community 184 - "Nook Arena Integration"
Cohesion: 0.25
Nodes (7): Global constraints, Nook / Code Arena integration plan, Progress / rulings, Review focus, Task 1: Preserve and reconcile histories, Task 2: Reconcile integration surfaces, Task 3: Verify and review

### Community 185 - "Compiler Options"
Cohesion: 0.25
Nodes (7): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, include

### Community 186 - "Harness Compiler"
Cohesion: 0.25
Nodes (7): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, include

### Community 187 - "book/package.json"
Cohesion: 0.17
Nodes (11): dependencies, marked, puppeteer-core, description, name, private, scripts, build (+3 more)

### Community 188 - "Docker Commands"
Cohesion: 0.29
Nodes (7): command, devices, image, privileged, restart, volumes, cadvisor

### Community 189 - "Notification Cleanup"
Cohesion: 0.29
Nodes (7): Cleanup, Exact notification texts (from the database), G06 live two-client demonstration, How it was run, No duplicates on reload and reconnect, What this does and does not prove, What was demonstrated

### Community 190 - "Command Verification"
Cohesion: 0.29
Nodes (7): Commands, Disposable service boundary, Live two-client demonstration, Repeatable project verification, Secret prevention and historical exposure, Setup (Linux/macOS), Tool references

### Community 191 - "Verification Plan"
Cohesion: 0.29
Nodes (6): Completion, Decisions, Local completion evidence, Progress / rulings, Verification and secret-prevention plan, Work

### Community 192 - "Build Config"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ./tsconfig.json

### Community 193 - "route.ts"
Cohesion: 0.33
Nodes (6): checkPlatformHealth(), GET(), PlatformStatus, ServiceStatus, HTTP routes, HTTP routes

### Community 194 - "Logging Metrics"
Cohesion: 0.33
Nodes (6): command, image, logging, restart, volumes, prometheus

### Community 195 - "Client console cleanup"
Cohesion: 0.18
Nodes (8): ArenaPendingAction, Client console cleanup, Follow-up: executable language choices, Remaining conditional console sources, Scope and changes, Verification, Authoritative tie-break winner display, Live Feed carousel verification

### Community 196 - "Credential Exposure"
Cohesion: 0.33
Nodes (6): Credential exposure: operator action required, Decisions, Nook / Arena integration status, Release/evaluation gates, Review and repairs, Verification (2026-11-11)

### Community 197 - "Integration Spec"
Cohesion: 0.33
Nodes (6): Code Arena integration specification, HTTP and realtime contracts, Persistence and privacy boundary, Product behavior, Service boundaries, Verification

### Community 198 - "verify-recovery.sh script"
Cohesion: 0.33
Nodes (3): backup.sh script, restore.sh script, verify-recovery.sh script

### Community 199 - "Docker Logs"
Cohesion: 0.40
Nodes (5): command, image, restart, volumes, loki

### Community 200 - "Architectural Context"
Cohesion: 0.40
Nodes (4): Agreed Architectural Decisions (ADR-0015 Summary), Context: Code Arena in Nook, Domain Glossary, Overview

### Community 202 - "accounts.service.ts"
Cohesion: 0.08
Nodes (14): AccountImagesController, accountSelect, AccountsService, JOINED_WITHIN_DAYS, publicProfileSelect, ACCOUNT_SORT_FIELDS, AccountSortField, JOINED_WITHIN_VALUES (+6 more)

### Community 203 - "Theme Tokens"
Cohesion: 0.67
Nodes (3): contrast(), design, luminance()

### Community 204 - "Integration Decision"
Cohesion: 0.50
Nodes (4): 0015. Code Arena Integration into Nook, Consequences and known limits, Context, Decisions

### Community 205 - "Project scan map"
Cohesion: 0.20
Nodes (9): Agent skills, Code-review Easter egg, Domain docs, Graphify navigation, Issue tracker, Project scan map, Review status and verification, Source entry points (+1 more)

### Community 206 - "game/team-2v2.test.ts"
Cohesion: 0.36
Nodes (7): api(), connect(), headers(), newTeamMatch(), once(), pushSource(), startCoding()

### Community 209 - "arena/chat.ts"
Cohesion: 0.20
Nodes (9): TEAM_PING_LABELS, TEAM_PINGS, TeamChatAuthContext, TeamChatClientOptions, TeamChatEntry, TeamChatMessage, TeamChatPing, TeamChatStatus (+1 more)

### Community 210 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, shadcn, tailwindcss, @tailwindcss/turbopack, @types/node, @types/react (+2 more)

### Community 211 - "provenance"
Cohesion: 0.20
Nodes (10): type, enum, created, origin, provenance, source, properties, required (+2 more)

### Community 212 - "ArenaSnapshot"
Cohesion: 0.31
Nodes (7): DuelPanel(), DuelPanelProps, PlayerCard(), ServerSnapshot, ArenaSnapshot, PlayerStatus, SideView

### Community 213 - "esc"
Cohesion: 0.25
Nodes (8): saveCrop(), arrow(), box(), esc(), image(), link(), part(), table()

### Community 219 - "ChatUser"
Cohesion: 0.29
Nodes (8): ChatUser, 13. The other links between the two services, 1. Why RabbitMQ exists in this project, 6. The HTTP fallback, Ownership, Shared JWT, Data model, Source map

### Community 221 - "ArenaWorkspace"
Cohesion: 0.48
Nodes (7): ArenaWorkspace(), handleRun(), handleSubmit(), handleSurrender(), handleToggleReady(), performAction(), EditorAdapter

### Community 223 - "Nook documentation"
Cohesion: 0.33
Nodes (6): Code Arena and evaluation, Engineering checks, Integrations (merging points), Nook documentation, Reference, Services

### Community 224 - "Code Arena lifecycle notifications"
Cohesion: 0.33
Nodes (6): Boundaries, Code Arena lifecycle notifications, Correlation checks, Linking a challenge to a conversation, Replay safety, What is written

### Community 226 - "schema.json"
Cohesion: 0.33
Nodes (5): $id, required, $schema, title, type

### Community 227 - "Domain docs"
Cohesion: 0.40
Nodes (4): Domain docs, Flag decision conflicts, Read before exploring, Use the project’s vocabulary

### Community 228 - "Issue tracker: Local Markdown"
Cohesion: 0.40
Nodes (4): Conventions, Issue tracker: Local Markdown, When a skill says “fetch the relevant ticket”, When a skill says “publish to the issue tracker”

### Community 229 - "docChapter"
Cohesion: 0.40
Nodes (5): chapter(), docChapter(), mdToHtml(), rd(), rdJson()

### Community 230 - "Complete snapshots and recovery (D04)"
Cohesion: 0.40
Nodes (5): Complete snapshots and recovery (D04), Create and schedule snapshots, Non-destructive verification, Restore during maintenance, Snapshot contents

### Community 231 - "Messages"
Cohesion: 0.40
Nodes (5): Editing and deleting, History, Messages, Read state and unread counts, Sending and retries

### Community 232 - "starters"
Cohesion: 0.40
Nodes (5): type, starters, additionalProperties, required, type

### Community 233 - "describe"
Cohesion: 0.50
Nodes (4): bodyOf(), dedent(), describe(), shiftHeadings()

### Community 234 - "renderApi"
Cohesion: 1.00
Nodes (4): flatten(), renderApi(), resolveRef(), typeOf()

### Community 236 - "tags"
Cohesion: 0.50
Nodes (4): tags, items, minItems, type

### Community 238 - "memoryLimitMb"
Cohesion: 0.67
Nodes (3): minimum, type, memoryLimitMb

### Community 239 - "visibleTests"
Cohesion: 0.67
Nodes (3): visibleTests, minItems, type

## Knowledge Gaps
- **1435 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+1430 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2102 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useAuth` to `client/package.json`, `chat-workspace.tsx`, `Legal Pages`, `details-panel.tsx`, `public-profile.tsx`, `types.ts`, `Button`, `emoji-picker.tsx`, `ThemeSelector`, `sidebar.tsx`, `ref_node_test`, `search-view.tsx`, `providers.tsx`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `GameService` connect `GameService` to `SubmissionRecord`, `ArenaEngine`, `match-statistics.ts`, `game.service.ts`, `engine.ts`, `game-events.publisher.ts`, `PostgresStores`, `MatchMode`, `team-chat.gateway.ts`, `MatchSocketPresence`, `game.module.ts`, `LobbyController`, `game/user-events.consumer.ts`, `socketPrincipal`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `bcrypt` connect `ref_node_assert` to `auth.service.ts`, `accounts.service.ts`, `superadmin.service.ts`, `user-service/package.json`, `bootstrap-superadmin-env.mjs`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _1435 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SubmissionRecord` be split into smaller, more focused modules?**
  _Cohesion score 0.05974025974025974 - nodes in this community are weakly interconnected._
- **Should `SuperadminService` be split into smaller, more focused modules?**
  _Cohesion score 0.12310606060606061 - nodes in this community are weakly interconnected._
- **Should `FriendshipsService` be split into smaller, more focused modules?**
  _Cohesion score 0.09191919191919191 - nodes in this community are weakly interconnected._