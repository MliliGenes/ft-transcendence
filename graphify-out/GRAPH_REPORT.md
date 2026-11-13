# Graph Report - nook-client  (2026-11-12)

## Corpus Check
- 514 files · ~410,281 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 49 file(s) not represented in the graph (top: (none) 26, .example 14, .toml 3)

## Summary
- 4885 nodes · 11103 edges · 230 communities (181 shown, 49 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 449 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b8ad5fb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- engine.ts
- ref_nestjs_config
- accounts.service.ts
- SuperadminService
- SocialController
- ChatGateway
- ChatControllerMethods
- Discord OAuth
- GithubStrategy
- SendMessageDto
- AuthProviderMigrations
- user-service/package.json
- GroupsController
- AuthService
- User Bootstrap Scripts
- ref_nestjs_common
- Conversation Schema
- Arena Workspace Hook
- User Service Package
- chat.module.ts
- sidebar.tsx
- MatchRecordState
- Chat TypeScript Configuration
- InMemoryCollabPersist
- User TypeScript Configuration
- dependencies
- Minio Module Docs
- arena-editor-collab-lifecycle.test.mjs
- User Runtime Dependencies
- SocketGatewayHandlers
- UserEventConsumer
- Chat Development Dependencies
- User Scripts and Commands
- chat-service/tsconfig.build.json
- RegisterDto
- ArenaEngineLogic
- Auth Control Methods
- Nook — Project Context
- Documentation Index
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
- Button
- LobbyPlayPages
- AppErrorHandling
- Nginx Entrypoint
- Judge Worker Server
- InvitationTests
- chat/client.ts
- Socket Transport State
- build-dashboards.mjs
- components.json
- bootstrap-superadmin-env.mjs
- RabbitMqEventsService
- compilerOptions
- DocumentationBuild
- EGM Drift Report — 2026-11-12
- ChatServiceModules
- Minio Client Config
- MarkdownEditor
- game.service.ts
- AccountSearchDtos
- TestWorkspaceSetup
- GameDependencies
- chat-service/src/app.module.ts
- team-chat.test.ts
- app/page.tsx
- ChatUserGuards
- Local Compose setup
- GameNotifications
- PostgresCollabStore
- ArenaWorkspace.tsx
- emoji-picker.tsx
- Collaboration Sync
- user-service/README.md
- SupportedLanguage
- Chess Page
- Database Verification
- Judge Server Setup
- secrets.mjs
- DatabaseConfigSpecs
- RateLimitingService
- MatchAuthorityLogic
- GameGatewayLogic
- ProfileEditor
- Auth Checks
- container-judge.ts
- EvaluationRegistry
- LobbyError
- user-service/tsconfig.build.json
- ComposeYamlConfig
- PackageJsonMeta
- scripts
- Judge0 Adapter
- Container Configuration
- mail.service.ts
- Arena Dependencies
- ref_node_fs
- client/README.md
- Code Arena gameplay review
- AGENTS.md
- Game Control Methods
- Game Event Types
- EditorAdapter.tsx
- Collaboration Logic
- System Startup Guide
- Mock Game Simulation
- Job Queue Management
- IllegalStateError
- Match Presence Tracking
- game.module.ts
- next
- Service Dependencies List
- Chat & Messaging
- User Block Management
- envs/README.md
- TeamChatContext
- arena-socket-path.test.mjs
- Rxjs Library
- Judge Worker Package
- InMemoryLobbyStore
- Fake Judge Logic
- judge.ts
- GameStatsController
- init.sh
- 10-monitoring-role.sh
- DiscordStrategy
- Docker Build Context
- Fixture Data Models
- Round Phase Transitions
- Arena Harness Package
- Team Chat Client
- GameJudge
- Arena Model Package
- Health Checks
- sidecars.ts
- Git Analytics Config
- Architecture Overview
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
- App Features
- Datasource Config
- Alert Rules
- Game TS Config
- Game DB
- User DB
- Monitoring Stack
- Game Problem Logic
- MatchMode
- Legal Pages
- Backup Storage Init Container
- Product Roadmap
- Nook Config
- Build TS Config
- App Modules
- Model TS Config
- Build Model Config
- Judge Worker
- ILobbyStore
- Logging Configuration
- Prometheus Settings
- src/lobby.ts
- Minio Init
- Alloy Config
- Nook Arena Integration
- Compiler Options
- Harness Compiler
- CollabGateway
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
- BACKUP_RECOVERY.md
- Docker Logs
- Architectural Context
- LobbyStore
- AccountImagesController
- Theme Tokens
- Integration Decision
- game/reconnect.test.ts
- game/team-2v2.test.ts
- Job Queue
- ConfirmPasswordResetDto
- MatchView.tsx
- @prisma/client@7.10.0
- prettier@^3.4.2
- Dev Cert Gen
- Play Script
- Judge Worker Entrypoint Script

## God Nodes (most connected - your core abstractions)
1. `MatchRecord` - 122 edges
2. `ArenaEngine` - 86 edges
3. `GameService` - 82 edges
4. `Button()` - 82 edges
5. `useAuth()` - 58 edges
6. `next` - 55 edges
7. `react` - 54 edges
8. `ChatWorkspace()` - 53 edges
9. `SideId` - 51 edges
10. `SubmissionRecord` - 48 edges

## Surprising Connections (you probably didn't know these)
- `Errors` --references--> `AuthRequestError`  [INFERRED]
  docs/integrations/client-backend.md → client/lib/auth/client.ts
- `Structure` --references--> `useCurrentAccount()`  [INFERRED]
  docs/services/client.md → client/hooks/use-current-account.ts
- `Limits` --references--> `PresenceAudienceService`  [INFERRED]
  docs/integrations/feed.md → chat-service/src/chat/presence/presence-audience.service.ts
- `Integrations (merging points)` --references--> `ChatUser`  [INFERRED]
  docs/README.md → client/lib/chat/client.ts
- `1. Why RabbitMQ exists in this project` --references--> `ChatUser`  [INFERRED]
  docs/integrations/user-chat.md → client/lib/chat/client.ts

## Import Cycles
- 2-file cycle: `packages/arena-game/src/lobby.ts -> packages/arena-game/src/postgres-store.ts -> packages/arena-game/src/lobby.ts`

## Communities (230 total, 49 thin omitted)

### Community 0 - "engine.ts"
Cohesion: 0.04
Nodes (32): b64encode(), COLLAB_TEXT_KEY, CollabPersist, CollabRow, InMemoryCollabPersist, EngineOptions, ExpiredError, MATCH_DURATION_MS (+24 more)

### Community 1 - "ref_nestjs_config"
Cohesion: 0.13
Nodes (5): hooks, bcrypt, react-dom, readSession(), mail

### Community 2 - "accounts.service.ts"
Cohesion: 0.07
Nodes (15): sharp, AccountsController, accountResponse(), accountSelect, AccountsService, JOINED_WITHIN_DAYS, publicProfileSelect, STATUS_ICON_NAMES (+7 more)

### Community 3 - "SuperadminService"
Cohesion: 0.11
Nodes (3): CreateUserDto, SuperadminController, SuperadminService

### Community 4 - "SocialController"
Cohesion: 0.06
Nodes (18): Architecture, Authentication, Commands, Configuration, Current limitations, Data model, Email verification and password reset, Events (+10 more)

### Community 5 - "ChatGateway"
Cohesion: 0.05
Nodes (13): GameRoomsClient, RoomLookupResponse, RoomResponse, ChatGateway, PresenceAudienceService, PresenceChange, PresenceService, PresenceStatus (+5 more)

### Community 6 - "ChatControllerMethods"
Cohesion: 0.05
Nodes (8): ChatController, ChatService, isUniqueViolation(), CreateAttachmentUploadUrlDto, GetMessagesQueryDto, maxBytesFor(), MinioService, 4.1 Upload and send

### Community 10 - "AuthProviderMigrations"
Cohesion: 0.13
Nodes (27): "AuthProvider", AuthProvider_provider_providerUserId_key, AuthProvider_userId_provider_key, "AuthToken", AuthToken_expiresAt_idx, AuthToken_tokenHash_key, AuthToken_userId_purpose_idx, "Friendship" (+19 more)

### Community 11 - "user-service/package.json"
Cohesion: 0.07
Nodes (28): @types/bcrypt, devDependencies, dotenv@^17.2.3, @nestjs/cli@^12.0.0, @nestjs/mau@^0.2.6, @nestjs/schematics@^12.0.0, oxlint@^1.58.0, prisma@7.10.0 (+20 more)

### Community 12 - "GroupsController"
Cohesion: 0.11
Nodes (4): GroupsController, GroupsService, Isolation from normal chat, Request

### Community 13 - "AuthService"
Cohesion: 0.15
Nodes (4): AuthService, RefreshDto, DiscordProfile, GithubProfile

### Community 14 - "User Bootstrap Scripts"
Cohesion: 0.08
Nodes (26): scripts, bootstrap:superadmin, bootstrap:superadmin:env, build, deploy, format, lint, pretest (+18 more)

### Community 15 - "ref_nestjs_common"
Cohesion: 0.05
Nodes (24): AuthenticatedRequest, AccountsModule, AppController, AppModule, AppService, AuthModule, AuthResult, trustedBrowserOrigins() (+16 more)

### Community 16 - "Conversation Schema"
Cohesion: 0.18
Nodes (19): "ChatUser", "Conversation", Conversation_dmUserAId_createdAt_id_idx, Conversation_dmUserAId_dmUserBId_key, Conversation_dmUserBId_createdAt_id_idx, Conversation_groupId_createdAt_id_idx, "Group", "GroupMember" (+11 more)

### Community 17 - "Arena Workspace Hook"
Cohesion: 0.12
Nodes (3): ArenaWorkspaceProps, ArenaTransport, ArenaConnectionOptions

### Community 18 - "User Service Package"
Cohesion: 0.11
Nodes (17): author, amqp-connection-manager@^5.0.0, pg@^8.16.3, description, @nestjs/testing@^12.0.1, @types/express@^5.0.0, @types/supertest@^7.0.0, amqp-connection-manager (+9 more)

### Community 19 - "chat.module.ts"
Cohesion: 0.12
Nodes (10): AuthModule, ChatModule, ChatSharedModule, EnsureActiveUserGuard, GroupsModule, PresenceModule, EventsModule, FeedModule (+2 more)

### Community 20 - "sidebar.tsx"
Cohesion: 0.08
Nodes (33): AppLayout(), SavedSidebarShell(), AppNavigation(), AppShell(), navigation, Separator(), SidebarContent(), SidebarContext (+25 more)

### Community 21 - "MatchRecordState"
Cohesion: 0.08
Nodes (24): b64decode(), CollabDocs, collabRoomId(), SealedSnapshot, PostgresMatchStore, DocumentRevision, MatchRecord, MemberReadiness (+16 more)

### Community 22 - "Chat TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 23 - "InMemoryCollabPersist"
Cohesion: 0.05
Nodes (36): ProblemBank, FileBank, assertSupportedLanguage(), ValidationError, GAME_SCHEMA, testPrincipal(), InMemoryMatchStore, C_SOLVE (+28 more)

### Community 24 - "User TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 25 - "dependencies"
Cohesion: 0.06
Nodes (45): author, dependencies, amqp-connection-manager@^5.0.1, amqplib@^2.2.0, class-transformer@^0.5.1, class-validator@^0.15.1, minio@^8.0.7, @nestjs/common@^12.0.1 (+37 more)

### Community 26 - "Minio Module Docs"
Cohesion: 0.12
Nodes (14): MinioModule, 10. Evaluation Q&A, 11. Cheat sheet, 1. The problem, 2. Primer, 3. Architecture at a glance, 4.2 Verification at send time (the real security check), 4.3 Preview and download (+6 more)

### Community 27 - "arena-editor-collab-lifecycle.test.mjs"
Cohesion: 0.07
Nodes (24): cmState, cmView, { CollabClient }, createCollabModule(), createdClients, createEditorModule(), createHarness(), useEffect() (+16 more)

### Community 28 - "User Runtime Dependencies"
Cohesion: 0.07
Nodes (27): argon2, nodemailer, dependencies, amqplib@^2.2.0, argon2@^0.45.1, bcrypt@^6.0.0, class-transformer@^0.5.1, class-validator@^0.15.1 (+19 more)

### Community 29 - "SocketGatewayHandlers"
Cohesion: 0.10
Nodes (17): ActiveAccountGuard, PrincipalRequest, LobbyGateway, roomChannel(), userChannel(), attachSocketPrincipal(), chooseHandshakeValue(), MatchSocketPrincipal (+9 more)

### Community 30 - "UserEventConsumer"
Cohesion: 0.09
Nodes (17): isDate(), parseUserEvent(), USER_EVENT_TYPES, UserEvent, UserProfileData, UserEventsConsumer, FeedService, Client (+9 more)

### Community 31 - "Chat Development Dependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @nestjs/cli@^12.0.0, @nestjs/mau@^0.2.6, @nestjs/schematics@^12.0.0, @nestjs/testing@^12.0.1, oxlint@^1.58.0, prettier@^3.4.2, source-map-support@^0.5.21 (+23 more)

### Community 32 - "User Scripts and Commands"
Cohesion: 0.12
Nodes (16): scripts, build, deploy, format, lint, prisma:generate, start, start:debug (+8 more)

### Community 33 - "chat-service/tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 35 - "ArenaEngineLogic"
Cohesion: 0.11
Nodes (12): ArenaEngine, driverFor(), NotMemberError, AuthenticatedPrincipal, ForfeitRecord, CollabFixture, setupCollab(), realEngine() (+4 more)

### Community 36 - "Auth Control Methods"
Cohesion: 0.13
Nodes (10): AuthController, assertTrustedBrowserOrigin(), LoginDto, RequestPasswordResetDto, clearRefreshCookie(), publicSession(), readRefreshCookie(), REFRESH_COOKIE_NAME (+2 more)

### Community 37 - "Nook — Project Context"
Cohesion: 0.09
Nodes (22): 10. Backlog organization, 11. Design context, 12. Questions to settle next, 13. Source and decision history, 1. Nook in one paragraph, 2. How to interpret this document, 3. Confirmed decisions, 4. Audience and reason to return (+14 more)

### Community 39 - "useAuth"
Cohesion: 0.08
Nodes (45): metadata, SettingsPage(), ForgotPasswordPage(), metadata, LoginPage(), metadata, metadata, RegisterPage() (+37 more)

### Community 40 - "chat-workspace.tsx"
Cohesion: 0.06
Nodes (44): ChatContent(), ChatPage(), ChatPageProps, metadata, EmojiPicker(), applyMarkdownFormat(), formats, MarkdownFormat (+36 more)

### Community 41 - "GroupCreationDtos"
Cohesion: 0.05
Nodes (12): ATTACHMENT_CONTENT_TYPES, CreateDmDto, EditMessageDto, MarkReadDto, AddGroupMemberDto, CreateChannelDto, CreateGroupDto, UpdateChannelDto (+4 more)

### Community 42 - "Socket Adaptation Logic"
Cohesion: 0.16
Nodes (13): adapt(), adaptFinal(), adaptReveal(), RateLimitError, ServerReveal, ServerSnapshot, SnapshotTrigger, SocketTransportOptions (+5 more)

### Community 43 - "Points Roadmap: Groups First, Frontend Next"
Cohesion: 0.12
Nodes (17): Current scoring position, Delivery Roadmap: Nook and Code Arena, Optional: add Chess as a second game, Other module candidates, Phase 1 — Group chat backend implemented; acceptance remains open, Phase 2 — Make presence and activity data usable, Phase 3 — Build the main frontend as feature-sized sessions, Phase 4 — Add two low-scope completion tasks (+9 more)

### Community 44 - "User Lint Configuration"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Community 45 - "MessageActionsUI"
Cohesion: 0.09
Nodes (31): applyToCaches(), DeleteMessageDialog(), failureText(), messageCaches, MessageEditor(), onKeyDown(), save(), dayFormat (+23 more)

### Community 46 - "Chat Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 47 - "GamePagesUI"
Cohesion: 0.08
Nodes (51): PlayLeaderboardPage(), instant, metadata, PublicProfilePage(), metadata, ProfilePage(), metadata, SearchPage() (+43 more)

### Community 48 - "User Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 49 - "Button"
Cohesion: 0.14
Nodes (30): StatusPage(), CreateGroupDialog(), groupDetailKey(), GroupMark(), groupMembersKey(), GroupHome(), rank(), Stat() (+22 more)

### Community 50 - "LobbyPlayPages"
Cohesion: 0.06
Nodes (27): instant, LobbyRoomPage(), metadata, metadata, PlayPage(), LobbyView(), handleLeave(), handleStart() (+19 more)

### Community 51 - "AppErrorHandling"
Cohesion: 0.09
Nodes (26): AppError(), AppLoading(), AppNotFound(), metadata, AuthLayout(), RootError(), LegalLayout(), Loading() (+18 more)

### Community 54 - "Judge Worker Server"
Cohesion: 0.18
Nodes (9): JudgeWorkerServerOptions, integerEnv(), requiredEnv(), start(), DockerCommand, DockerImageReadiness, DockerImageReadinessOptions, JudgeReadinessProbe (+1 more)

### Community 55 - "InvitationTests"
Cohesion: 0.05
Nodes (22): cancelled, notifications, result, started, MEMBERS, ROOM, FakeSocket, io() (+14 more)

### Community 56 - "chat/client.ts"
Cohesion: 0.08
Nodes (32): metadata, VerifyEmailPage(), State, VerifyEmailView(), accountRequest(), accountResponse(), AccountUpdate, ImageKind (+24 more)

### Community 57 - "Socket Transport State"
Cohesion: 0.12
Nodes (3): shouldApplyUpdate(), SocketArenaTransport, TransportSession

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
Cohesion: 0.13
Nodes (5): RabbitMqEventsService, USER_EVENT_TYPES, UserEvent, UserProfileData, UserProfileSnapshot

### Community 62 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 63 - "DocumentationBuild"
Cohesion: 0.05
Nodes (52): arrow(), bodyOf(), box(), BRANCH, chapter(), chatApi, chromeCandidates, dedent() (+44 more)

### Community 65 - "EGM Drift Report — 2026-11-12"
Cohesion: 0.05
Nodes (37): chat-service/README.md, client/AGENTS.md, client/README.md, CONTEXT.md, docs/adr/0015-code-arena-nook-integration.md, docs/adr/0016-one-game-service-instance.md, docs/api/chat-service.openapi.json, docs/api/user-service.openapi.json (+29 more)

### Community 66 - "ChatServiceModules"
Cohesion: 0.06
Nodes (16): keys, pool, prisma, signer, broadcasts, createDm(), createGameRoom(), freePort() (+8 more)

### Community 67 - "Minio Client Config"
Cohesion: 0.22
Nodes (13): clientOptions(), minioBucket(), minioClientOptions(), minioPresignClientOptions(), port(), required(), useSsl(), MINIO_CLIENT (+5 more)

### Community 68 - "MarkdownEditor"
Cohesion: 0.04
Nodes (66): components, markdownClass, remarkPlugins, eslintConfig, dependencies, @base-ui/react@^1.9.0, boring-avatars@^2.0.4, class-variance-authority@^0.7.1 (+58 more)

### Community 69 - "game.service.ts"
Cohesion: 0.07
Nodes (13): LOBBY_PROBLEM_POOL, buildLeaderboard(), calculateProgression(), CodeArenaAchievement, completedAt(), CompletedMatchSummary, LeaderboardEntry, MatchOutcome (+5 more)

### Community 70 - "AccountSearchDtos"
Cohesion: 0.06
Nodes (7): ACCOUNT_SORT_FIELDS, AccountSearchDto, AccountSortField, JOINED_WITHIN_VALUES, JoinedWithin, PaginationDto, UserQueryDto

### Community 71 - "TestWorkspaceSetup"
Cohesion: 0.17
Nodes (21): workspaceTestSteps(), installHooks(), installScanner(), releases, scannerPath, version, integrationEnvironment(), runIntegration() (+13 more)

### Community 72 - "GameDependencies"
Cohesion: 0.06
Nodes (47): dependencies, amqp-connection-manager@^5.0.0, amqplib@^2.2.0, arena-game-engine@*, arena-model@*, @nestjs/common@^11.1.0, @nestjs/core@^11.1.0, @nestjs/platform-express@^11.1.0 (+39 more)

### Community 73 - "chat-service/src/app.module.ts"
Cohesion: 0.13
Nodes (6): AppController, AppModule, AppService, AccessTokenPayload, CurrentUser, IS_PUBLIC_KEY

### Community 74 - "team-chat.test.ts"
Cohesion: 0.13
Nodes (10): TeamChatAuthContext, api(), headers(), api(), HAS_PG, headers(), newMatch(), api() (+2 more)

### Community 75 - "app/page.tsx"
Cohesion: 0.25
Nodes (17): chatPoints, features, feedPoints, Home(), spaces, Presence, StatusDot(), Avatar() (+9 more)

### Community 76 - "ChatUserGuards"
Cohesion: 0.08
Nodes (25): AuthGuard, ChatUser, 10. Hands-on lab (15 minutes, do this before the defense), 11. Evaluation Q&A, 12. Cheat sheet, 13. The other links between the two services, 1. Why RabbitMQ exists in this project, 2. Primer: the five RabbitMQ words you need (+17 more)

### Community 77 - "Local Compose setup"
Cohesion: 0.29
Nodes (7): First startup, Frontend, Local Compose setup, Local HTTPS and OAuth, Monitoring, Network and storage, Plug in another service

### Community 78 - "GameNotifications"
Cohesion: 0.06
Nodes (44): formatGameNotification(), GAME_NOTIFICATION_HEADER, GAME_NOTIFICATION_TYPES, GameNotificationType, isRoomCode(), ROOM_CODE_PATTERN, singleLine(), deterministicUuid() (+36 more)

### Community 79 - "PostgresCollabStore"
Cohesion: 0.11
Nodes (5): PostgresCollabStore, PostgresEvaluationClaim, PostgresStores, pgUp(), pgUp()

### Community 80 - "ArenaWorkspace.tsx"
Cohesion: 0.07
Nodes (33): ArenaHeader(), ArenaHeaderProps, formatClock(), ArenaWorkspace(), EditorAdapter, DuelPanel(), DuelPanelProps, PlayerCard() (+25 more)

### Community 81 - "emoji-picker.tsx"
Cohesion: 0.24
Nodes (8): EmojiPanel(), pick(), readRecent(), writeRecent(), allEmojis, Emoji, emojiCategories, EmojiCategory

### Community 82 - "Collaboration Sync"
Cohesion: 0.31
Nodes (5): api(), CollabSync, headers(), newTeamMatch(), ownRevision()

### Community 83 - "user-service/README.md"
Cohesion: 0.17
Nodes (11): Compile and run the project, Deployment, Description, License, Observability, Project setup, Resources, Run tests (+3 more)

### Community 84 - "SupportedLanguage"
Cohesion: 0.16
Nodes (9): ContainerJudge, expectedMatches(), BankProblem, EvaluationProblemBank, EvaluationRunInput, Judge0Adapter, DriverKind, JudgeLimits (+1 more)

### Community 85 - "Chess Page"
Cohesion: 0.60
Nodes (3): ChessPage(), metadata, ComingSoon()

### Community 86 - "Database Verification"
Cohesion: 0.06
Nodes (33): concurrency, cancel-in-progress, group, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER (+25 more)

### Community 87 - "Judge Server Setup"
Cohesion: 0.23
Nodes (15): authenticated(), BodyTooLargeError, createJudgeWorkerServer(), handleRequest(), errorResponse(), InvalidRequestError, isDriver(), isLanguage() (+7 more)

### Community 88 - "secrets.mjs"
Cohesion: 0.24
Nodes (14): requireScanner(), baseline, checkPaths(), forbiddenPath(), git(), main(), requireBaseline(), runScanner() (+6 more)

### Community 89 - "DatabaseConfigSpecs"
Cohesion: 0.06
Nodes (32): analytics, reporting_enabled, auth_enabled, common, path_prefix, replication_factor, ring, storage (+24 more)

### Community 91 - "MatchAuthorityLogic"
Cohesion: 0.12
Nodes (6): MatchAuthority, MatchPersistence, assertPersistenceContract(), makeMatch(), makeReveal(), makeSubmission()

### Community 92 - "GameGatewayLogic"
Cohesion: 0.07
Nodes (5): GameGateway, roomFor(), GameService, selectLobbyProblems(), userTokenHash()

### Community 93 - "ProfileEditor"
Cohesion: 0.17
Nodes (15): EditProfilePage(), metadata, currentValues(), getErrorMessage(), ImagePreview(), ProfileEditor(), saveProfile(), updateField() (+7 more)

### Community 95 - "container-judge.ts"
Cohesion: 0.13
Nodes (14): CaseInput, ContainerJudgeOptions, decodeBase64(), DEFAULT_IMAGES, EXECUTION_STATUSES, parseRunnerRecord(), RawExecution, RunnerRecord (+6 more)

### Community 96 - "EvaluationRegistry"
Cohesion: 0.07
Nodes (17): EvaluationCompletion, EvaluationIdentity, EvaluationInFlightRegistry, EvaluationOrchestrationHost, EvaluationOrchestrator, EvaluationRecoveryReport, InFlightEvaluation, EvaluationProviderTelemetry (+9 more)

### Community 97 - "LobbyError"
Cohesion: 0.20
Nodes (3): generateInviteCode(), LobbyError, perSideCapacity()

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
Cohesion: 0.13
Nodes (6): FetchJudge0HttpClient, Judge0HttpClient, Judge0SubmissionResponse, limits, request, ScriptedJudge0Http

### Community 103 - "Container Configuration"
Cohesion: 0.09
Nodes (27): build, logging, env_file, image, logging, volumes, driver, build (+19 more)

### Community 104 - "mail.service.ts"
Cohesion: 0.26
Nodes (5): MailService, actionButton(), layout(), passwordResetEmailTemplate(), verificationEmailTemplate()

### Community 105 - "Arena Dependencies"
Cohesion: 0.10
Nodes (25): dependencies, arena-model@*, pg@^8.13.0, yjs@^13.6.33, description, devDependencies, @types/pg@^8.11.0, typescript@^5.9.2 (+17 more)

### Community 106 - "ref_node_fs"
Cohesion: 0.07
Nodes (19): app, root, ca, loadBankProblem(), BANK_DIR, SCHEMA_REQUIRED, main(), REQUIRED_STEPS (+11 more)

### Community 107 - "client/README.md"
Cohesion: 0.40
Nodes (4): Deploy on Vercel, Learn More, Local development, Production configuration

### Community 108 - "Code Arena gameplay review"
Cohesion: 0.12
Nodes (17): Agreed rules, Code Arena gameplay review, Conditional risks outside the first repair, Conflict behavior and regression coverage, Current full verification — 2026-11-12, Documentation drift — resolved, Existing reconnect defect — resolved, Follow-up verification — 2026-11-12 (+9 more)

### Community 111 - "Game Event Types"
Cohesion: 0.13
Nodes (12): ChallengeCancelledData, GAME_EVENT_TYPES, GameEvent, GameEventBase, GameEventParticipant, GameEventType, GameMatchMode, MatchEndedData (+4 more)

### Community 112 - "EditorAdapter.tsx"
Cohesion: 0.15
Nodes (14): AppliedEdit, applyLocalEdit(), ArenaLanguage, collaborativeExtensions(), EditorAdapter, EditorAdapterHandle, EditorAdapterProps, EditorSelection (+6 more)

### Community 113 - "Collaboration Logic"
Cohesion: 0.14
Nodes (9): b64ToBytes(), bytesToB64(), COLLAB_TEXT_KEY, CollabClient, CollabConnection, CollabSyncPayload, colorForUser(), encodeRemoteCursor() (+1 more)

### Community 114 - "System Startup Guide"
Cohesion: 0.08
Nodes (24): Adding a service, Alerts, Complete snapshots (recommended), Dashboards, Data, Environment files, Existing databases, Export a copy (+16 more)

### Community 115 - "Mock Game Simulation"
Cohesion: 0.20
Nodes (3): MockSession, MockGame, PlayerStatus

### Community 116 - "Job Queue Management"
Cohesion: 0.12
Nodes (12): BoundedJobQueue, BoundedJobQueueOptions, Job, JobState, QueueExecutionTimeoutError, QueueFullError, QueueWaitTimeoutError, limits (+4 more)

### Community 117 - "IllegalStateError"
Cohesion: 0.07
Nodes (24): isCompetitiveVerdict(), IllegalStateError, PostgresRevealStore, GroupResult, RevealSnapshot, RevealInput, RoundAdvance, RoundLifecycle (+16 more)

### Community 118 - "Match Presence Tracking"
Cohesion: 0.13
Nodes (7): MatchSocketPresence, MatchSocketPresenceMode, MatchSocketPresenceState, MatchSocketPresenceTarget, MemberPresenceCall, RecordingPresenceTarget, SidePresenceCall

### Community 119 - "game.module.ts"
Cohesion: 0.14
Nodes (9): EngineErrorFilter, GameModule, { privateKey, publicKey }, publicKeyPem, TokenPayload, verifyAccessToken(), devPrincipalMiddleware(), express-serve-static-core (+1 more)

### Community 120 - "next"
Cohesion: 0.09
Nodes (38): FeedPage(), metadata, colors, founded, joinedFormat, CodeArenaProfile(), historyKey(), MatchHistory() (+30 more)

### Community 121 - "Service Dependencies List"
Cohesion: 0.10
Nodes (22): build, condition, depends_on, env_file, environment, logging, depends_on, chat-service (+14 more)

### Community 122 - "Chat & Messaging"
Cohesion: 0.10
Nodes (21): Boundaries, Chat service, Code Arena lifecycle notifications, Commands and tests, Configuration, Correlation checks, Current limitations, Direct messages (+13 more)

### Community 124 - "envs/README.md"
Cohesion: 0.40
Nodes (5): Configure a fresh clone, Environment configuration, File ownership, Internal and public addresses, Placeholder convention

### Community 125 - "TeamChatContext"
Cohesion: 0.14
Nodes (8): isTeamPing(), TEAM_PING_LABELS, TEAM_PINGS, TeamChatEntry, TeamChatMessage, TeamChatPing, TeamPing, TeamChatGateway

### Community 126 - "arena-socket-path.test.mjs"
Cohesion: 0.14
Nodes (4): FakeSocket, io(), wait(), waitUntil()

### Community 128 - "Judge Worker Package"
Cohesion: 0.12
Nodes (19): dependencies, arena-game-engine@*, devDependencies, @types/node@^22.16.0, typescript@^5.9.2, vitest@^3.2.4, arena-game-engine, @types/node (+11 more)

### Community 130 - "Fake Judge Logic"
Cohesion: 0.22
Nodes (8): ADR-0003, FakeJudge, HiddenGroup, HiddenGroupVerdict, JudgeLimits, JudgePort, VisibleCase, VisibleVerdict

### Community 131 - "judge.ts"
Cohesion: 0.14
Nodes (16): CaseInput, DEFAULT_LANGUAGE_IDS, Judge0AdapterOptions, Judge0SubmissionRequest, NormalizedCase, SnippetOutput, ExecutionStatus, JudgeExecutionMetrics (+8 more)

### Community 136 - "Docker Build Context"
Cohesion: 0.12
Nodes (17): context, dockerfile, RABBITMQ_HOST, RABBITMQ_PORT, build, env_file, environment, logging (+9 more)

### Community 137 - "Fixture Data Models"
Cohesion: 0.16
Nodes (9): FixtureHiddenGroup, FixtureHiddenTest, FixtureVisibleTest, microProblems(), MockPlayer, mockSession(), SHUTOUT_OPPONENT, SOLVED_CODE (+1 more)

### Community 138 - "Round Phase Transitions"
Cohesion: 0.18
Nodes (16): bothReady(), Presence, Readiness, resetReadiness(), RoundPhase, STATUS_LABEL, VisibleTest, VisibleTestStatus (+8 more)

### Community 139 - "Arena Harness Package"
Cohesion: 0.14
Nodes (16): dependencies, arena-model@*, description, devDependencies, typescript@^5.9.2, vitest@^3.2.4, arena-model, typescript (+8 more)

### Community 140 - "Team Chat Client"
Cohesion: 0.09
Nodes (12): TeamChatProps, TEAM_PING_LABELS, TEAM_PINGS, TeamChatAuthContext, TeamChatClient, TeamChatClientOptions, TeamChatEntry, TeamChatMessage (+4 more)

### Community 141 - "GameJudge"
Cohesion: 0.15
Nodes (12): EvaluationOrchestratorOptions, CaseResult, GameJudge, isRecord(), parseCaseResult(), parseSealedGroup(), STATUSES, WorkerJudgeAdapter (+4 more)

### Community 142 - "Arena Model Package"
Cohesion: 0.14
Nodes (15): description, devDependencies, typescript@^5.9.2, vitest@^3.2.4, typescript, vitest, main, name (+7 more)

### Community 143 - "Health Checks"
Cohesion: 0.47
Nodes (15): healthcheck, healthcheck, healthcheck, healthcheck, healthcheck, interval, retries, start_period (+7 more)

### Community 145 - "sidecars.ts"
Cohesion: 0.12
Nodes (24): ArenaSidecarLifecycle, configKey(), createArenaSidecarLifecycle(), cancelChatPending(), cancelCollabPending(), clearChat(), clearCollab(), dispose() (+16 more)

### Community 146 - "Git Analytics Config"
Cohesion: 0.22
Nodes (11): clean(), cwd, date(), git(), main(), escapeHtml(), evidenceDirectory, execFileAsync (+3 more)

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

### Community 157 - "providers.tsx"
Cohesion: 0.22
Nodes (8): geistMono, inter, metadata, RootLayout(), getQueryClient(), makeQueryClient(), Providers(), AuthProvider()

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
Cohesion: 0.13
Nodes (12): FixtureProblem, OpponentRound, DEFAULT_LIMITS, MockSide, Reveal, RunRecord, SubmissionRecord, SubmitReceipt (+4 more)

### Community 168 - "MatchMode"
Cohesion: 0.21
Nodes (5): capacityFor(), PrivateRoom, QueueEntry, saveMatchTx(), MatchMode

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
Cohesion: 0.18
Nodes (5): ALL_ROUND_PHASES, AppModule, HealthController, httpReady(), tcp()

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
Nodes (9): ExpiredRoomCursor, ExpiredRoomPage, LOBBY_SCHEMA, LobbySideId, PrivateRoomMember, PrivateRoomStatus, QueueStatus, RoomWithMembers (+1 more)

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

### Community 198 - "BACKUP_RECOVERY.md"
Cohesion: 0.18
Nodes (8): Complete snapshots and recovery (D04), Create and schedule snapshots, Non-destructive verification, Restore during maintenance, Snapshot contents, backup.sh script, restore.sh script, verify-recovery.sh script

### Community 199 - "Docker Logs"
Cohesion: 0.40
Nodes (5): command, image, restart, volumes, loki

### Community 200 - "Architectural Context"
Cohesion: 0.40
Nodes (4): Agreed Architectural Decisions (ADR-0015 Summary), Context: Code Arena in Nook, Domain Glossary, Overview

### Community 203 - "Theme Tokens"
Cohesion: 0.67
Nodes (3): contrast(), design, luminance()

### Community 204 - "Integration Decision"
Cohesion: 0.50
Nodes (4): 0015. Code Arena Integration into Nook, Consequences and known limits, Context, Decisions

### Community 205 - "game/reconnect.test.ts"
Cohesion: 0.33
Nodes (6): api(), HAS_PG, headers(), newMatch(), snapshotOf(), startCoding()

### Community 206 - "game/team-2v2.test.ts"
Cohesion: 0.33
Nodes (6): api(), headers(), newTeamMatch(), once(), pushSource(), startCoding()

### Community 209 - "MatchView.tsx"
Cohesion: 0.47
Nodes (4): instant, MatchPage(), metadata, MatchView()

## Knowledge Gaps
- **7 isolated node(s):** `ADR-0003`, `MC_CONFIG_DIR`, `./tsconfig.json`, `./tsconfig.json`, `./tsconfig.json` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1780 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `AppErrorHandling` to `ref_nestjs_config`, `MarkdownEditor`, `useAuth`, `chat-workspace.tsx`, `Legal Pages`, `Team Chat Client`, `MessageActionsUI`, `GamePagesUI`, `ArenaWorkspace.tsx`, `Button`, `emoji-picker.tsx`, `EditorAdapter.tsx`, `sidebar.tsx`, `MatchView.tsx`, `next`, `chat/client.ts`, `providers.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `ADR-0003`, `MC_CONFIG_DIR`, `./tsconfig.json` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `engine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03589232303090728 - nodes in this community are weakly interconnected._
- **Why does `Infrastructure` connect `System Startup Guide` to `Documentation Index`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `ref_nestjs_config` be split into smaller, more focused modules?**
  _Cohesion score 0.1309175920514319 - nodes in this community are weakly interconnected._
- **Why does `bcrypt` connect `ref_nestjs_config` to `accounts.service.ts`, `bootstrap-superadmin-env.mjs`, `ref_nestjs_common`, `User Service Package`, `User Runtime Dependencies`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `accounts.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0697980684811238 - nodes in this community are weakly interconnected._