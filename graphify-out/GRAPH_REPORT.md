# Graph Report - nook-client  (2026-11-11)

## Corpus Check
- 509 files · ~330,754 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 49 file(s) not represented in the graph (top: (none) 26, .example 14, .toml 3)
- Community labels: 161 names generated with local Ollama qwen3.5:4b; 47 existing labels preserved and two duplicate Docker labels clarified.

## Summary
- 4698 nodes · 10990 edges · 208 communities (178 shown, 30 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 504 edges (avg confidence: 0.86)
- Token cost: 7,735 input · 1,222 output

## Graph Freshness
- Built from commit: `3fe061a1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CollabEngineCore
- ref_nestjs_config
- accounts.service.ts
- SuperadminService
- SocialController
- ChatGateway
- ChatControllerMethods
- Discord OAuth
- GithubStrategy
- ChatApiEndpoints
- AuthProviderMigrations
- user-service/package.json
- GroupsController
- AuthService
- User Bootstrap Scripts
- AuthModuleConfig
- Conversation Schema
- Arena Workspace Hook
- User Service Package
- src/app.module.ts
- sidebar.tsx
- MatchRecordState
- Chat TypeScript Configuration
- InMemoryCollabPersist
- User TypeScript Configuration
- dependencies
- Minio Module Docs
- App Controller Structure
- User Runtime Dependencies
- SocketGatewayHandlers
- UserEventConsumer
- Chat Development Dependencies
- User Scripts and Commands
- chat-service/tsconfig.build.json
- PrismaService
- ArenaEngineLogic
- Auth Control Methods
- Nook — Project Context
- useAuth
- chat-workspace.tsx
- GroupCreationDtos
- Socket Adaptation Logic
- Points Roadmap: Groups First, Frontend Next
- User Lint Configuration
- MessageActionsUI
- Chat Nest Build Setup
- GamePagesUI
- User Nest Build Setup
- MatchGroupUI
- LobbyPlayPages
- AppErrorHandling
- Nginx Entrypoint
- Judge Worker Server
- InvitationTests
- AuthenticatedRequest
- Socket Transport State
- build-dashboards.mjs
- components.json
- bootstrap-superadmin-env.mjs
- RabbitMqEventsService
- compilerOptions
- DocumentationBuild
- CI Steps
- ChatServiceModules
- Minio Client Config
- MarkdownEditor
- Team Chat
- AccountSearchDtos
- TestWorkspaceSetup
- GameDependencies
- Duel Panel UI
- JudgeContainerTest
- SubmissionPersistence
- ChatUserGuards
- Local Compose setup
- GameNotifications
- PostgresCollabStore
- Match Result Props
- emoji-picker.tsx
- Collaboration Sync
- user-service/README.md
- CaseExecutionJudge
- Chess Page
- Database Verification
- Judge Server Setup
- Match Events
- DatabaseConfigSpecs
- RateLimitingService
- MatchAuthorityLogic
- GameGatewayLogic
- Auth Guard Logic
- Auth Checks
- Socket Transport
- EvaluationRegistry
- LobbyRoomCapacity
- user-service/tsconfig.build.json
- ComposeYamlConfig
- PackageJsonMeta
- scripts
- Judge0 Adapter
- Container Configuration
- Email Templates
- Arena Dependencies
- Evidence Validation
- client/README.md
- Chat Page
- AGENTS.md
- Game Control Methods
- Game Event Types
- Editor Handle
- Collaboration Logic
- System Startup Guide
- Mock Game Simulation
- Job Queue Management
- Scoring Verdicts
- Match Presence Tracking
- AuthGuardDecorators
- Feed Page Components
- Service Dependencies List
- Chat & Messaging
- User Block Management
- envs/README.md
- TeamChatContext
- Reflect Metadata
- Rxjs Library
- Judge Worker Package
- Vitest Coverage
- Fake Judge Logic
- Judge0 Adapter Logic
- GameStatsController
- init.sh
- 10-monitoring-role.sh
- Sidecar Lifecycle
- Docker Build Context
- Fixture Data Models
- Round Phase Transitions
- Arena Harness Package
- Team Chat Client
- Sealed Evaluation Logic
- Arena Model Package
- Health Checks
- Arena Sidecars
- Git Analytics Config
- Architecture Overview
- Code Stats
- Container Configs
- Env Variables
- Database Volumes
- Docker Options
- Service Health
- Evaluation Orchestration
- Docker Networks
- Analytics Flags
- App Features
- Datasource Config
- Alert Rules
- Game TS Config
- Game DB
- User DB
- Monitoring Stack
- Game Problem Logic
- Legal Pages
- Backup Storage Init Container
- Product Roadmap
- Nook Config
- Build TS Config
- App Modules
- Model TS Config
- Build Model Config
- Judge Worker
- Test Reconnect State
- Logging Configuration
- Prometheus Settings
- Minio Init
- Alloy Config
- Nook Arena Integration
- Compiler Options
- Harness Compiler
- Docker Commands
- Notification Cleanup
- Command Verification
- Verification Plan
- Build Config
- Platform Status
- Logging Metrics
- Client Integration
- Credential Exposure
- Integration Spec
- Backup Scripts
- Docker Logs
- Architectural Context
- Snapshot Recovery
- Fixture Controls
- Theme Tokens
- Integration Decision
- Request Node
- Job Queue
- Dev Cert Gen
- Play Script
- Judge Worker Entrypoint Script

## God Nodes (most connected - your core abstractions)
1. `MatchRecord` - 121 edges
2. `ArenaEngine` - 87 edges
3. `GameService` - 86 edges
4. `Button()` - 82 edges
5. `useAuth()` - 58 edges
6. `next` - 55 edges
7. `react` - 54 edges
8. `ChatWorkspace()` - 53 edges
9. `SideId` - 52 edges
10. `SubmissionRecord` - 48 edges

## Surprising Connections (you probably didn't know these)
- `Limits` --references--> `PresenceAudienceService`  [INFERRED]
  docs/integrations/feed.md → chat-service/src/chat/presence/presence-audience.service.ts
- `Errors` --references--> `AuthRequestError`  [INFERRED]
  docs/integrations/client-backend.md → client/lib/auth/client.ts
- `Structure` --references--> `useCurrentAccount()`  [INFERRED]
  docs/services/client.md → client/hooks/use-current-account.ts
- `Events` --references--> `AuthService`  [INFERRED]
  docs/services/user-service.md → user-service/src/auth/auth.service.ts
- `Events` --references--> `AccountsService`  [INFERRED]
  docs/services/user-service.md → user-service/src/accounts/accounts.service.ts

## Import Cycles
- 2-file cycle: `packages/arena-game/src/lobby.ts -> packages/arena-game/src/postgres-store.ts -> packages/arena-game/src/lobby.ts`

## Communities (208 total, 30 thin omitted)

### Community 0 - "CollabEngineCore"
Cohesion: 0.05
Nodes (41): b64encode(), COLLAB_TEXT_KEY, CollabPersist, CollabRow, EngineOptions, ExpiredError, MATCH_DURATION_MS, RatePolicy (+33 more)

### Community 1 - "ref_nestjs_config"
Cohesion: 0.16
Nodes (4): hooks, bcrypt, readSession(), mail

### Community 2 - "accounts.service.ts"
Cohesion: 0.06
Nodes (18): AccountImagesController, AccountsModule, accountResponse(), accountSelect, AccountsService, JOINED_WITHIN_DAYS, publicProfileSelect, ACCOUNT_SORT_FIELDS (+10 more)

### Community 4 - "SocialController"
Cohesion: 0.05
Nodes (22): Architecture, Authentication, Commands, Configuration, Current limitations, Data model, Email verification and password reset, Events (+14 more)

### Community 5 - "ChatGateway"
Cohesion: 0.08
Nodes (8): ChatGateway, PresenceAudienceService, PresenceChange, PresenceService, PresenceStatus, PublicUser, PrismaService, gatewayWith()

### Community 6 - "ChatControllerMethods"
Cohesion: 0.06
Nodes (8): ChatController, ChatService, isUniqueViolation(), GetMessagesQueryDto, GameRoomsClient, maxBytesFor(), MinioService, 4.1 Upload and send

### Community 7 - "Discord OAuth"
Cohesion: 0.14
Nodes (3): DiscordController, DiscordStrategy, record()

### Community 8 - "GithubStrategy"
Cohesion: 0.14
Nodes (3): GithubController, GithubStrategy, record()

### Community 9 - "ChatApiEndpoints"
Cohesion: 0.06
Nodes (9): ATTACHMENT_CONTENT_TYPES, CreateAttachmentUploadUrlDto, CreateDmDto, EditMessageDto, MarkReadDto, GameChallengeDto, SendMessageDto, RoomLookupResponse (+1 more)

### Community 10 - "AuthProviderMigrations"
Cohesion: 0.13
Nodes (27): "AuthProvider", AuthProvider_provider_providerUserId_key, AuthProvider_userId_provider_key, "AuthToken", AuthToken_expiresAt_idx, AuthToken_tokenHash_key, AuthToken_userId_purpose_idx, "Friendship" (+19 more)

### Community 11 - "user-service/package.json"
Cohesion: 0.07
Nodes (28): @types/bcrypt, devDependencies, dotenv@^17.2.3, @nestjs/cli@^12.0.0, @nestjs/mau@^0.2.6, @nestjs/schematics@^12.0.0, oxlint@^1.58.0, prettier@^3.4.2 (+20 more)

### Community 12 - "GroupsController"
Cohesion: 0.11
Nodes (4): GroupsController, GroupsService, Isolation from normal chat, Request

### Community 13 - "AuthService"
Cohesion: 0.14
Nodes (4): AuthService, RefreshDto, DiscordProfile, GithubProfile

### Community 14 - "User Bootstrap Scripts"
Cohesion: 0.08
Nodes (26): scripts, bootstrap:superadmin, bootstrap:superadmin:env, build, deploy, format, lint, pretest (+18 more)

### Community 15 - "AuthModuleConfig"
Cohesion: 0.08
Nodes (15): AUTH_TOKEN_PATTERN, AuthResult, ConfirmPasswordResetDto, LoginDto, REFRESH_TOKEN_PATTERN, RequestPasswordResetDto, AccessTokenGuard, clearRefreshCookie() (+7 more)

### Community 16 - "Conversation Schema"
Cohesion: 0.18
Nodes (19): "ChatUser", "Conversation", Conversation_dmUserAId_createdAt_id_idx, Conversation_dmUserAId_dmUserBId_key, Conversation_dmUserBId_createdAt_id_idx, Conversation_groupId_createdAt_id_idx, "Group", "GroupMember" (+11 more)

### Community 17 - "Arena Workspace Hook"
Cohesion: 0.12
Nodes (4): ArenaWorkspaceProps, useArena(), ArenaTransport, ArenaConnectionOptions

### Community 18 - "User Service Package"
Cohesion: 0.11
Nodes (17): author, @nestjs/config@^12.0.1, pg@^8.16.3, description, @nestjs/testing@^12.0.1, @types/supertest@^7.0.0, typescript@^6.0.2, @nestjs/config (+9 more)

### Community 19 - "src/app.module.ts"
Cohesion: 0.09
Nodes (11): AppController, AppModule, AppService, AuthModule, ChatModule, ChatSharedModule, GroupsModule, PresenceModule (+3 more)

### Community 20 - "sidebar.tsx"
Cohesion: 0.07
Nodes (38): AppLayout(), SavedSidebarShell(), AppNavigation(), AppShell(), navigation, Separator(), SheetContent(), SheetHeader() (+30 more)

### Community 21 - "MatchRecordState"
Cohesion: 0.07
Nodes (30): b64decode(), CollabDocs, collabRoomId(), SealedSnapshot, EvaluationOrchestrationHost, IllegalStateError, DocumentRevision, MatchRecord (+22 more)

### Community 22 - "Chat TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 23 - "InMemoryCollabPersist"
Cohesion: 0.06
Nodes (43): InMemoryCollabPersist, ProblemBank, FileBank, testPrincipal(), InMemoryMatchStore, InMemoryRevealStore, CollabFixture, PG_URL (+35 more)

### Community 24 - "User TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 25 - "dependencies"
Cohesion: 0.06
Nodes (45): author, dependencies, amqp-connection-manager@^5.0.1, amqplib@^2.2.0, class-transformer@^0.5.1, class-validator@^0.15.1, minio@^8.0.7, @nestjs/common@^12.0.1 (+37 more)

### Community 26 - "Minio Module Docs"
Cohesion: 0.12
Nodes (14): MinioModule, 10. Evaluation Q&A, 11. Cheat sheet, 1. The problem, 2. Primer, 3. Architecture at a glance, 4.2 Verification at send time (the real security check), 4.3 Preview and download (+6 more)

### Community 27 - "App Controller Structure"
Cohesion: 0.13
Nodes (5): AppController, AppModule, AppService, EventsModule, PrismaModule

### Community 28 - "User Runtime Dependencies"
Cohesion: 0.07
Nodes (28): argon2, nodemailer, sharp, dependencies, amqp-connection-manager@^5.0.0, amqplib@^2.2.0, argon2@^0.45.1, bcrypt@^6.0.0 (+20 more)

### Community 29 - "SocketGatewayHandlers"
Cohesion: 0.08
Nodes (20): CollabGateway, { privateKey, publicKey }, publicKeyPem, TokenPayload, verifyAccessToken(), LobbyGateway, roomChannel(), userChannel() (+12 more)

### Community 30 - "UserEventConsumer"
Cohesion: 0.09
Nodes (21): isDate(), parseUserEvent(), USER_EVENT_TYPES, UserEvent, UserProfileData, UserEventsConsumer, FEED_CHANNEL_ID, FEED_CHANNEL_NAME (+13 more)

### Community 31 - "Chat Development Dependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @nestjs/cli@^12.0.0, @nestjs/mau@^0.2.6, @nestjs/schematics@^12.0.0, @nestjs/testing@^12.0.1, oxlint@^1.58.0, prettier@^3.4.2, source-map-support@^0.5.21 (+23 more)

### Community 32 - "User Scripts and Commands"
Cohesion: 0.12
Nodes (16): scripts, build, deploy, format, lint, prisma:generate, start, start:debug (+8 more)

### Community 33 - "chat-service/tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 34 - "PrismaService"
Cohesion: 0.11
Nodes (7): AuthModule, RegisterDto, CreateUserDto, UpdateRoleDto, SuperadminGuard, SuperadminModule, adminUserSelect

### Community 35 - "ArenaEngineLogic"
Cohesion: 0.11
Nodes (9): ArenaEngine, driverFor(), assertSupportedLanguage(), ValidationError, AuthenticatedPrincipal, ForfeitRecord, realEngine(), createMatch() (+1 more)

### Community 36 - "Auth Control Methods"
Cohesion: 0.23
Nodes (3): AuthController, assertTrustedBrowserOrigin(), readRefreshCookie()

### Community 37 - "Nook — Project Context"
Cohesion: 0.09
Nodes (22): 10. Backlog organization, 11. Design context, 12. Questions to settle next, 13. Source and decision history, 1. Nook in one paragraph, 2. How to interpret this document, 3. Confirmed decisions, 4. Audience and reason to return (+14 more)

### Community 39 - "useAuth"
Cohesion: 0.05
Nodes (74): EditProfilePage(), metadata, metadata, SettingsPage(), ForgotPasswordPage(), metadata, LoginPage(), metadata (+66 more)

### Community 40 - "chat-workspace.tsx"
Cohesion: 0.07
Nodes (65): ChatMarkdown(), DirectDetails(), groupDetailKey(), GroupDetails(), GroupMark(), groupMembersKey(), joined, MemberRow() (+57 more)

### Community 41 - "GroupCreationDtos"
Cohesion: 0.07
Nodes (8): AddGroupMemberDto, CreateChannelDto, CreateGroupDto, UpdateChannelDto, UpdateGroupDto, UpdateGroupMemberRoleDto, AuthenticatedRequest, GroupDb

### Community 42 - "Socket Adaptation Logic"
Cohesion: 0.17
Nodes (11): ArenaHeaderProps, adapt(), adaptFinal(), adaptReveal(), ServerReveal, shouldApplyUpdate(), SocketTransportOptions, StaleCommandError (+3 more)

### Community 43 - "Points Roadmap: Groups First, Frontend Next"
Cohesion: 0.12
Nodes (17): Current scoring position, Delivery Roadmap: Nook and Code Arena, Open acceptance checks, Optional: add Chess as a second game, Other module candidates, Phase 1 — Finish group chat on the backend, Phase 2 — Make presence and activity data usable, Phase 3 — Build the main frontend as feature-sized sessions (+9 more)

### Community 44 - "User Lint Configuration"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Community 45 - "MessageActionsUI"
Cohesion: 0.08
Nodes (43): applyToCaches(), DeleteMessageDialog(), failureText(), messageCaches, MessageEditor(), onKeyDown(), save(), MessageOwnerActions() (+35 more)

### Community 46 - "Chat Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 47 - "GamePagesUI"
Cohesion: 0.05
Nodes (67): PlayLeaderboardPage(), instant, metadata, PublicProfilePage(), metadata, ProfilePage(), metadata, SearchPage() (+59 more)

### Community 48 - "User Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 49 - "MatchGroupUI"
Cohesion: 0.09
Nodes (31): instant, MatchPage(), metadata, metadata, VerifyEmailPage(), StatusPage(), CreateGroupDialog(), ConfirmDialog() (+23 more)

### Community 50 - "LobbyPlayPages"
Cohesion: 0.06
Nodes (29): instant, LobbyRoomPage(), metadata, metadata, PlayPage(), LobbyView(), handleLeave(), handleStart() (+21 more)

### Community 51 - "AppErrorHandling"
Cohesion: 0.07
Nodes (41): AppError(), AppLoading(), AppNotFound(), metadata, AuthLayout(), RootError(), LegalLayout(), Loading() (+33 more)

### Community 54 - "Judge Worker Server"
Cohesion: 0.18
Nodes (9): JudgeWorkerServerOptions, integerEnv(), requiredEnv(), start(), DockerCommand, DockerImageReadiness, DockerImageReadinessOptions, JudgeReadinessProbe (+1 more)

### Community 55 - "InvitationTests"
Cohesion: 0.05
Nodes (19): cancelled, notifications, result, started, MEMBERS, ROOM, compiledModule, context (+11 more)

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
Cohesion: 0.09
Nodes (6): RabbitMqEventsService, USER_EVENT_TYPES, UserEvent, UserProfileData, UserProfileSnapshot, PrismaService

### Community 62 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 63 - "DocumentationBuild"
Cohesion: 0.05
Nodes (52): arrow(), bodyOf(), box(), BRANCH, chapter(), chatApi, chromeCandidates, dedent() (+44 more)

### Community 65 - "CI Steps"
Cohesion: 0.18
Nodes (11): if, name, run, uses, with, steps, cache, cache-dependency-path (+3 more)

### Community 66 - "ChatServiceModules"
Cohesion: 0.06
Nodes (16): keys, pool, prisma, signer, broadcasts, createDm(), createGameRoom(), freePort() (+8 more)

### Community 67 - "Minio Client Config"
Cohesion: 0.22
Nodes (13): clientOptions(), minioBucket(), minioClientOptions(), minioPresignClientOptions(), port(), required(), useSsl(), MINIO_CLIENT (+5 more)

### Community 68 - "MarkdownEditor"
Cohesion: 0.04
Nodes (75): components, markdownClass, remarkPlugins, ArenaLanguage, EditorAdapter, EditorAdapterProps, EditorSelection, languageExtension() (+67 more)

### Community 69 - "Team Chat"
Cohesion: 0.20
Nodes (9): TEAM_PING_LABELS, TEAM_PINGS, TeamChatAuthContext, TeamChatClientOptions, TeamChatEntry, TeamChatMessage, TeamChatPing, TeamChatStatus (+1 more)

### Community 70 - "AccountSearchDtos"
Cohesion: 0.07
Nodes (3): AccountSearchDto, PaginationDto, UserQueryDto

### Community 71 - "TestWorkspaceSetup"
Cohesion: 0.11
Nodes (37): loadBankProblem(), workspaceTestSteps(), REQUIRED_STEPS, installHooks(), installScanner(), releases, requireScanner(), scannerPath (+29 more)

### Community 72 - "GameDependencies"
Cohesion: 0.06
Nodes (47): dependencies, amqp-connection-manager@^5.0.0, amqplib@^2.2.0, arena-game-engine@*, arena-model@*, @nestjs/common@^11.1.0, @nestjs/core@^11.1.0, @nestjs/platform-express@^11.1.0 (+39 more)

### Community 73 - "Duel Panel UI"
Cohesion: 0.31
Nodes (7): DuelPanel(), DuelPanelProps, PlayerCard(), ServerSnapshot, ArenaSnapshot, PlayerStatus, SideView

### Community 74 - "JudgeContainerTest"
Cohesion: 0.06
Nodes (22): root, scratchDirs, api(), headers(), api(), HAS_PG, headers(), newMatch() (+14 more)

### Community 75 - "SubmissionPersistence"
Cohesion: 0.08
Nodes (5): StoreBackedMatchPersistence, PostgresSubmissionStore, SubmissionRecord, InMemorySubmissionStore, SubmissionStore

### Community 76 - "ChatUserGuards"
Cohesion: 0.07
Nodes (27): EnsureActiveUserGuard, UserProfilesService, ChatUser, 10. Hands-on lab (15 minutes, do this before the defense), 11. Evaluation Q&A, 12. Cheat sheet, 13. The other links between the two services, 1. Why RabbitMQ exists in this project (+19 more)

### Community 77 - "Local Compose setup"
Cohesion: 0.29
Nodes (7): First startup, Frontend, Local Compose setup, Local HTTPS and OAuth, Monitoring, Network and storage, Plug in another service

### Community 78 - "GameNotifications"
Cohesion: 0.06
Nodes (40): formatGameNotification(), GAME_NOTIFICATION_HEADER, GAME_NOTIFICATION_TYPES, GameNotificationType, isRoomCode(), ROOM_CODE_PATTERN, singleLine(), deterministicUuid() (+32 more)

### Community 79 - "PostgresCollabStore"
Cohesion: 0.09
Nodes (7): PostgresCollabStore, PostgresEvaluationClaim, PostgresMatchStore, PostgresStores, saveMatchTx(), pgUp(), pgUp()

### Community 80 - "Match Result Props"
Cohesion: 0.16
Nodes (15): MatchResultProps, RoundScoreRevealProps, StatusBadge(), TestPanel(), TestPanelProps, MatchFinalView, Presence, ProblemExample (+7 more)

### Community 81 - "emoji-picker.tsx"
Cohesion: 0.24
Nodes (8): EmojiPanel(), pick(), readRecent(), writeRecent(), allEmojis, Emoji, emojiCategories, EmojiCategory

### Community 82 - "Collaboration Sync"
Cohesion: 0.31
Nodes (5): api(), CollabSync, headers(), newTeamMatch(), ownRevision()

### Community 83 - "user-service/README.md"
Cohesion: 0.17
Nodes (11): Compile and run the project, Deployment, Description, License, Observability, Project setup, Resources, Run tests (+3 more)

### Community 84 - "CaseExecutionJudge"
Cohesion: 0.13
Nodes (24): CaseInput, ContainerJudge, ContainerJudgeOptions, decodeBase64(), DEFAULT_IMAGES, EXECUTION_STATUSES, expectedMatches(), parseRunnerRecord() (+16 more)

### Community 85 - "Chess Page"
Cohesion: 0.60
Nodes (3): ChessPage(), metadata, ComingSoon()

### Community 86 - "Database Verification"
Cohesion: 0.09
Nodes (22): concurrency, cancel-in-progress, group, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER (+14 more)

### Community 87 - "Judge Server Setup"
Cohesion: 0.23
Nodes (15): authenticated(), BodyTooLargeError, createJudgeWorkerServer(), handleRequest(), errorResponse(), InvalidRequestError, isDriver(), isLanguage() (+7 more)

### Community 88 - "Match Events"
Cohesion: 0.25
Nodes (8): matchId(), Boundaries, Code Arena lifecycle notifications, Correlation checks, Events that Chat consumes, Linking a challenge to a conversation, Replay safety, What is written

### Community 89 - "DatabaseConfigSpecs"
Cohesion: 0.06
Nodes (32): analytics, reporting_enabled, auth_enabled, common, path_prefix, replication_factor, ring, storage (+24 more)

### Community 90 - "RateLimitingService"
Cohesion: 0.08
Nodes (8): RateLimitedError, ILobbyStore, PrivateRoom, PrivateRoomMember, QueueEntry, RoomWithMembers, MatchMode, LobbyController

### Community 91 - "MatchAuthorityLogic"
Cohesion: 0.13
Nodes (4): MatchAuthority, NotMemberError, MatchPersistence, assertPersistenceContract()

### Community 92 - "GameGatewayLogic"
Cohesion: 0.08
Nodes (3): GameGateway, roomFor(), GameService

### Community 96 - "EvaluationRegistry"
Cohesion: 0.11
Nodes (4): EvaluationInFlightRegistry, EvaluationOrchestrator, EvaluationClaim, SealedVerdict

### Community 97 - "LobbyRoomCapacity"
Cohesion: 0.08
Nodes (6): capacityFor(), generateInviteCode(), InMemoryLobbyStore, LobbyError, LobbyStore, perSideCapacity()

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

### Community 102 - "Judge0 Adapter"
Cohesion: 0.11
Nodes (11): CaseInput, DEFAULT_LANGUAGE_IDS, FetchJudge0HttpClient, Judge0AdapterOptions, Judge0HttpClient, Judge0SubmissionRequest, Judge0SubmissionResponse, SnippetOutput (+3 more)

### Community 103 - "Container Configuration"
Cohesion: 0.09
Nodes (27): build, logging, env_file, image, logging, volumes, driver, build (+19 more)

### Community 104 - "Email Templates"
Cohesion: 0.73
Nodes (4): actionButton(), layout(), passwordResetEmailTemplate(), verificationEmailTemplate()

### Community 105 - "Arena Dependencies"
Cohesion: 0.10
Nodes (25): dependencies, arena-model@*, pg@^8.13.0, yjs@^13.6.33, description, devDependencies, @types/pg@^8.11.0, typescript@^5.9.2 (+17 more)

### Community 106 - "Evidence Validation"
Cohesion: 0.29
Nodes (6): main(), validateG06Evidence(), evidence, evidenceDirectory, readme, screenshots

### Community 107 - "client/README.md"
Cohesion: 0.40
Nodes (4): Deploy on Vercel, Learn More, Local development, Production configuration

### Community 108 - "Chat Page"
Cohesion: 0.50
Nodes (4): ChatContent(), ChatPage(), ChatPageProps, metadata

### Community 111 - "Game Event Types"
Cohesion: 0.11
Nodes (12): ChallengeCancelledData, GAME_EVENT_TYPES, GameEvent, GameEventBase, GameEventParticipant, GameEventType, GameMatchMode, MatchEndedData (+4 more)

### Community 113 - "Collaboration Logic"
Cohesion: 0.14
Nodes (9): b64ToBytes(), bytesToB64(), COLLAB_TEXT_KEY, CollabClient, CollabConnection, CollabSyncPayload, colorForUser(), encodeRemoteCursor() (+1 more)

### Community 114 - "System Startup Guide"
Cohesion: 0.08
Nodes (24): Adding a service, Alerts, Complete snapshots (recommended), Dashboards, Data, Environment files, Existing databases, Export a copy (+16 more)

### Community 115 - "Mock Game Simulation"
Cohesion: 0.19
Nodes (3): MockSession, OpponentRound, MockGame

### Community 116 - "Job Queue Management"
Cohesion: 0.12
Nodes (12): BoundedJobQueue, BoundedJobQueueOptions, Job, JobState, QueueExecutionTimeoutError, QueueFullError, QueueWaitTimeoutError, limits (+4 more)

### Community 117 - "Scoring Verdicts"
Cohesion: 0.27
Nodes (12): isCompetitiveVerdict(), assertRoundScore(), compareSides(), GroupCounts, groupEarnedBp(), matchSum(), roundScoreBp(), roundScoreFromBp() (+4 more)

### Community 118 - "Match Presence Tracking"
Cohesion: 0.15
Nodes (7): MatchSocketPresence, MatchSocketPresenceMode, MatchSocketPresenceState, MatchSocketPresenceTarget, MemberPresenceCall, RecordingPresenceTarget, SidePresenceCall

### Community 119 - "AuthGuardDecorators"
Cohesion: 0.08
Nodes (17): AccessTokenPayload, CurrentUser, IS_PUBLIC_KEY, AuthenticatedRequest, ExpiredRoomCursor, LobbySideId, ActiveAccountGuard, PrincipalRequest (+9 more)

### Community 120 - "Feed Page Components"
Cohesion: 0.17
Nodes (18): FeedPage(), metadata, FeedComposer(), addFiles(), onKeyDown(), submit(), FileChip(), feedKey() (+10 more)

### Community 121 - "Service Dependencies List"
Cohesion: 0.10
Nodes (22): build, condition, depends_on, env_file, environment, logging, depends_on, chat-service (+14 more)

### Community 122 - "Chat & Messaging"
Cohesion: 0.13
Nodes (15): Chat service, Commands and tests, Configuration, Current limitations, Direct messages, Editing and deleting, Error shape, Groups and channels (+7 more)

### Community 123 - "User Block Management"
Cohesion: 0.16
Nodes (3): userTokenHash(), GameUserEventsConsumer, parseDeletedUserId()

### Community 124 - "envs/README.md"
Cohesion: 0.40
Nodes (5): Configure a fresh clone, Environment configuration, File ownership, Internal and public addresses, Placeholder convention

### Community 125 - "TeamChatContext"
Cohesion: 0.10
Nodes (12): isTeamPing(), TEAM_PING_LABELS, TEAM_PINGS, TeamChatAuthContext, TeamChatEntry, TeamChatMessage, TeamChatPing, TeamPing (+4 more)

### Community 128 - "Judge Worker Package"
Cohesion: 0.12
Nodes (19): dependencies, arena-game-engine@*, devDependencies, @types/node@^22.16.0, typescript@^5.9.2, vitest@^3.2.4, arena-game-engine, @types/node (+11 more)

### Community 130 - "Fake Judge Logic"
Cohesion: 0.20
Nodes (9): ADR-0003, FakeJudge, DEFAULT_LIMITS, HiddenGroup, HiddenGroupVerdict, JudgeLimits, JudgePort, VisibleCase (+1 more)

### Community 131 - "Judge0 Adapter Logic"
Cohesion: 0.19
Nodes (5): Judge0Adapter, JudgeExecutionMetrics, configuredPositiveInteger(), createGameJudge(), JudgeEnvironment

### Community 132 - "GameStatsController"
Cohesion: 0.10
Nodes (13): GameStatsController, buildLeaderboard(), calculateProgression(), CodeArenaAchievement, completedAt(), CompletedMatchSummary, LeaderboardEntry, MatchOutcome (+5 more)

### Community 135 - "Sidecar Lifecycle"
Cohesion: 0.13
Nodes (9): ArenaSidecarLifecycle, defaultFactories, DisposableClient, LiveClientConfig, PendingClient, ScopeIdentity, SidecarFactories, SidecarScope (+1 more)

### Community 136 - "Docker Build Context"
Cohesion: 0.12
Nodes (17): context, dockerfile, RABBITMQ_HOST, RABBITMQ_PORT, build, env_file, environment, logging (+9 more)

### Community 137 - "Fixture Data Models"
Cohesion: 0.16
Nodes (9): FixtureHiddenGroup, FixtureHiddenTest, FixtureVisibleTest, microProblems(), MockPlayer, mockSession(), SHUTOUT_OPPONENT, SOLVED_CODE (+1 more)

### Community 138 - "Round Phase Transitions"
Cohesion: 0.16
Nodes (18): ALL_ROUND_PHASES, bothReady(), Presence, resetReadiness(), RoundPhase, STATUS_LABEL, VisibleTest, VisibleTestStatus (+10 more)

### Community 139 - "Arena Harness Package"
Cohesion: 0.14
Nodes (16): dependencies, arena-model@*, description, devDependencies, typescript@^5.9.2, vitest@^3.2.4, arena-model, typescript (+8 more)

### Community 141 - "Sealed Evaluation Logic"
Cohesion: 0.21
Nodes (9): JudgeInfraError, SealedEvaluationRequest, SealedGroupResult, isRecord(), parseCaseResult(), parseSealedGroup(), STATUSES, WorkerJudgeAdapter (+1 more)

### Community 142 - "Arena Model Package"
Cohesion: 0.14
Nodes (15): description, devDependencies, typescript@^5.9.2, vitest@^3.2.4, typescript, vitest, main, name (+7 more)

### Community 143 - "Health Checks"
Cohesion: 0.47
Nodes (15): healthcheck, healthcheck, healthcheck, healthcheck, healthcheck, interval, retries, start_period (+7 more)

### Community 145 - "Arena Sidecars"
Cohesion: 0.31
Nodes (14): configKey(), createArenaSidecarLifecycle(), cancelChatPending(), cancelCollabPending(), clearChat(), clearCollab(), dispose(), ensureChat() (+6 more)

### Community 146 - "Git Analytics Config"
Cohesion: 0.11
Nodes (18): app, clean(), cwd, date(), git(), main(), BANK_DIR, SCHEMA_REQUIRED (+10 more)

### Community 149 - "Architecture Overview"
Cohesion: 0.14
Nodes (14): 42 curriculum attribution and team, Architecture, Code Arena integration, Data model overview, Description, Git activity report, Instructions: start the local stack, Module evidence and point calculation (+6 more)

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

### Community 157 - "Evaluation Orchestration"
Cohesion: 0.11
Nodes (15): EvaluationCompletion, EvaluationIdentity, EvaluationOrchestratorOptions, EvaluationProblemBank, EvaluationRecoveryReport, EvaluationRunInput, InFlightEvaluation, EvaluationProviderTelemetry (+7 more)

### Community 158 - "Docker Networks"
Cohesion: 0.17
Nodes (12): environment, image, logging, networks, restart, volumes, CONTAINERS, EVENTS (+4 more)

### Community 159 - "Analytics Flags"
Cohesion: 0.17
Nodes (12): GF_ANALYTICS_CHECK_FOR_PLUGIN_UPDATES, GF_ANALYTICS_CHECK_FOR_UPDATES, GF_ANALYTICS_REPORTING_ENABLED, GF_AUTH_ANONYMOUS_ENABLED, GF_NEWS_NEWS_FEED_ENABLED, GF_SECURITY_COOKIE_SECURE, GF_SECURITY_DISABLE_GRAVATAR, GF_SERVER_ROOT_URL (+4 more)

### Community 160 - "App Features"
Cohesion: 0.17
Nodes (12): Chat workspace, Code Arena, Commands, Current limitations, Design system, Error and loading pages, How data flows, Profile and status (+4 more)

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

### Community 167 - "Game Problem Logic"
Cohesion: 0.22
Nodes (7): FixtureProblem, MockSide, Reveal, RunRecord, SubmissionRecord, SubmitReceipt, RoundContribution

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

### Community 174 - "App Modules"
Cohesion: 0.20
Nodes (4): AppModule, HealthController, httpReady(), tcp()

### Community 175 - "Model TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, module, moduleResolution, skipLibCheck, strict, target, types (+1 more)

### Community 176 - "Build Model Config"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, declarationMap, outDir, rootDir, sourceMap, extends, include (+1 more)

### Community 177 - "Judge Worker"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, outDir, rootDir, skipLibCheck, strict, target (+1 more)

### Community 178 - "Test Reconnect State"
Cohesion: 0.25
Nodes (3): FakeSocket, io(), MATCH_SNAPSHOT

### Community 179 - "Logging Configuration"
Cohesion: 0.33
Nodes (9): logging, logging, logging, driver, options, logging, max-file, max-size (+1 more)

### Community 180 - "Prometheus Settings"
Cohesion: 0.22
Nodes (8): global, evaluation_interval, scrape_interval, rule_files, scrape_configs, job_name, static_configs, targets

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

### Community 193 - "Platform Status"
Cohesion: 0.47
Nodes (4): checkPlatformHealth(), GET(), PlatformStatus, ServiceStatus

### Community 194 - "Logging Metrics"
Cohesion: 0.33
Nodes (6): command, image, logging, restart, volumes, prometheus

### Community 195 - "Client Integration"
Cohesion: 0.33
Nodes (6): Client and backend integration, Errors, Paths, Realtime, Session, Where each merging point is documented

### Community 196 - "Credential Exposure"
Cohesion: 0.33
Nodes (6): Credential exposure: operator action required, Decisions, Nook / Arena integration status, Release/evaluation gates, Review and repairs, Verification (2026-11-11)

### Community 197 - "Integration Spec"
Cohesion: 0.33
Nodes (6): Code Arena integration specification, HTTP and realtime contracts, Persistence and privacy boundary, Product behavior, Service boundaries, Verification

### Community 198 - "Backup Scripts"
Cohesion: 0.33
Nodes (3): backup.sh script, restore.sh script, verify-recovery.sh script

### Community 199 - "Docker Logs"
Cohesion: 0.40
Nodes (5): command, image, restart, volumes, loki

### Community 200 - "Architectural Context"
Cohesion: 0.40
Nodes (4): Agreed Architectural Decisions (ADR-0015 Summary), Context: Code Arena in Nook, Domain Glossary, Overview

### Community 201 - "Snapshot Recovery"
Cohesion: 0.40
Nodes (5): Complete snapshots and recovery (D04), Create and schedule snapshots, Non-destructive verification, Restore during maintenance, Snapshot contents

### Community 203 - "Theme Tokens"
Cohesion: 0.67
Nodes (3): contrast(), design, luminance()

### Community 204 - "Integration Decision"
Cohesion: 0.50
Nodes (4): 0015. Code Arena Integration into Nook, Consequences and known limits, Context, Decisions

## Knowledge Gaps
- **7 isolated node(s):** `ADR-0003`, `MC_CONFIG_DIR`, `./tsconfig.json`, `./tsconfig.json`, `./tsconfig.json` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1627 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useAuth` to `MarkdownEditor`, `chat-workspace.tsx`, `Legal Pages`, `Chat Page`, `MessageActionsUI`, `GamePagesUI`, `Match Result Props`, `MatchGroupUI`, `emoji-picker.tsx`, `AppErrorHandling`, `sidebar.tsx`, `Arena Workspace Hook`, `Feed Page Components`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `ADR-0003`, `MC_CONFIG_DIR`, `./tsconfig.json` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CollabEngineCore` be split into smaller, more focused modules?**
  _Cohesion score 0.04566544566544566 - nodes in this community are weakly interconnected._
- **Why does `minio` connect `Minio Client Config` to `dependencies`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `accounts.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.058445353594389245 - nodes in this community are weakly interconnected._
- **Why does `ArenaEngine` connect `ArenaEngineLogic` to `CollabEngineCore`, `EvaluationRegistry`, `PostgresCollabStore`, `CaseExecutionJudge`, `MatchRecordState`, `AuthGuardDecorators`, `InMemoryCollabPersist`, `MatchAuthorityLogic`, `GameGatewayLogic`, `Evaluation Orchestration`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `SuperadminService` be split into smaller, more focused modules?**
  _Cohesion score 0.12310606060606061 - nodes in this community are weakly interconnected._