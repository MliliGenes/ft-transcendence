# Graph Report - ft-transcendence  (2026-11-08)

## Corpus Check
- 266 files · ~247,396 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 43 file(s) not represented in the graph (top: (none) 22, .example 11, .toml 2)

## Summary
- 2033 nodes · 4216 edges · 135 communities (94 shown, 41 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 156 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6176ae2b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ref_nestjs_config
- accounts.service.ts
- SuperadminService
- SocialController
- ChatGateway
- ChatController
- Discord OAuth
- GithubStrategy
- chat.controller.ts
- chat-service/package.json
- user-service/package.json
- GroupsController
- AuthService
- User Bootstrap Scripts
- auth.service.ts
- ref_class_validator
- search-view.tsx
- ref_nestjs_common
- src/app.module.ts
- sidebar.tsx
- social.controller.ts
- Chat TypeScript Configuration
- Endpoints
- User TypeScript Configuration
- dependencies
- GroupsService
- app/app.module.ts
- User Runtime Dependencies
- User Development Dependencies
- user-events.consumer.ts
- Chat Development Dependencies
- User Scripts and Commands
- chat-service/tsconfig.build.json
- PrismaService
- auth.guard.ts
- auth.controller.ts
- Nook — Project Context
- docs/README.md
- useAuth
- chat-workspace.tsx
- CreateGroupDto
- UpdateChannelDto
- Points Roadmap: Groups First, Frontend Next
- User Lint Configuration
- public-profile.tsx
- Chat Nest Build Setup
- message-list.tsx
- User Nest Build Setup
- Button
- ConfirmPasswordResetDto
- Chat service MVP — our working plan
- Nginx Entrypoint
- ChatService
- oauth.ts
- AuthenticatedRequest
- Chat Service Plan (merged)
- build-dashboards.mjs
- components.json
- bootstrap-superadmin-env.mjs
- RabbitMqEventsService
- compilerOptions
- GroupMember
- AccountSearchDto
- dm.postgres.test.mjs
- minio.module.ts
- client/package.json
- generate-jwt-keys.mjs
- PaginationDto
- MinioService
- ProfileEditor
- dependencies
- mail
- docs/chat-service/README.md
- ChatUser
- Local Compose setup
- Nook profile and user settings design specification
- MinIO message attachments plan
- chat-markdown.tsx
- emoji-picker.tsx
- next
- user-service/README.md
- Milestones
- ComingSoon
- 4. DM and message operations
- devDependencies
- AccountsService
- 8. Build phases
- Reading order
- RabbitMQ events and the ChatUser table
- providers.tsx
- GetMessagesQueryDto
- SERVICE.md
- UpdateAccountDto
- Search and Friend Requests
- Deferred Public API Adapter
- user-service/tsconfig.build.json
- Nook — Profile Bio & Custom Status
- Chat attachments: upload and download
- scripts
- 5. Architecture
- Nook documentation
- mail.service.ts
- FriendshipsService
- 3. First-release behavior
- client/README.md
- UpdateGroupDto
- AGENTS.md
- 5. History, read state, and unread counts
- Use of AI
- envs/README.md
- Monitoring
- Additional routes verified against source
- friendships.service.ts
- Local Monitoring for Nook
- LoginDto
- user-service/src/main.ts
- social-client.test.mjs
- init.sh
- 10-monitoring-role.sh

## God Nodes (most connected - your core abstractions)
1. `Button()` - 47 edges
2. `ChatWorkspace()` - 46 edges
3. `useAuth()` - 38 edges
4. `react` - 34 edges
5. `next` - 33 edges
6. `AuthService` - 32 edges
7. `PublicProfile()` - 26 edges
8. `@tabler/icons-react` - 25 edges
9. `scripts` - 25 edges
10. `GroupsService` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Authentication` --references--> `EnsureActiveUserGuard`  [INFERRED]
  docs/chat-service/API.md → chat-service/src/chat/ensure-active-user.guard.ts
- `Implementation steps` --references--> `MessageAttachment()`  [INFERRED]
  docs/chat-service/minio-attachments-plan.md → client/components/app/chat/message-list.tsx
- `Storage model` --references--> `MessageAttachment()`  [INFERRED]
  docs/chat-service/minio-attachments-plan.md → client/components/app/chat/message-list.tsx
- `Create or get a direct conversation` --references--> `ChatUser`  [INFERRED]
  docs/chat-service/API.md → client/lib/chat/client.ts
- `Current implementation snapshot` --references--> `ChatUser`  [INFERRED]
  docs/chat-service/MVP_PLAN.md → client/lib/chat/client.ts

## Import Cycles
- None detected.

## Communities (135 total, 41 thin omitted)

### Community 2 - "accounts.service.ts"
Cohesion: 0.12
Nodes (12): accountSelect, JOINED_WITHIN_DAYS, publicProfileSelect, ACCOUNT_SORT_FIELDS, AccountSortField, JOINED_WITHIN_VALUES, JoinedWithin, STATUS_ICON_NAMES (+4 more)

### Community 3 - "SuperadminService"
Cohesion: 0.09
Nodes (3): UserQueryDto, SuperadminController, SuperadminService

### Community 5 - "ChatGateway"
Cohesion: 0.10
Nodes (6): ChatGateway, PresenceChange, PresenceService, PresenceStatus, 6. Broadcasting through Socket.IO, 4. Work with nested reads, writes, and filters

### Community 7 - "Discord OAuth"
Cohesion: 0.14
Nodes (3): DiscordController, DiscordStrategy, record()

### Community 8 - "GithubStrategy"
Cohesion: 0.14
Nodes (3): GithubController, GithubStrategy, record()

### Community 9 - "chat.controller.ts"
Cohesion: 0.09
Nodes (6): ATTACHMENT_CONTENT_TYPES, CreateAttachmentUploadUrlDto, CreateDmDto, EditMessageDto, MarkReadDto, SendMessageDto

### Community 10 - "chat-service/package.json"
Cohesion: 0.05
Nodes (38): author, description, amqp-connection-manager, amqplib, class-transformer, class-validator, @nestjs/cli, @nestjs/common (+30 more)

### Community 11 - "user-service/package.json"
Cohesion: 0.05
Nodes (40): argon2, sharp, @types/bcrypt, author, description, amqp-connection-manager, amqplib, class-transformer (+32 more)

### Community 13 - "AuthService"
Cohesion: 0.14
Nodes (4): AuthService, RefreshDto, DiscordProfile, GithubProfile

### Community 14 - "User Bootstrap Scripts"
Cohesion: 0.08
Nodes (25): scripts, bootstrap:superadmin, bootstrap:superadmin:env, build, deploy, format, lint, prisma:generate (+17 more)

### Community 15 - "auth.service.ts"
Cohesion: 0.16
Nodes (5): AuthResult, REFRESH_TOKEN_PATTERN, AccessTokenGuard, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS

### Community 16 - "ref_class_validator"
Cohesion: 0.15
Nodes (5): AddGroupMemberDto, CreateChannelDto, UpdateGroupMemberRoleDto, AuthenticatedRequest, GroupDb

### Community 17 - "search-view.tsx"
Cohesion: 0.08
Nodes (30): metadata, SearchPage(), accountName(), DEFAULT_FILTERS, PeopleFilters, resultQueryKey(), SearchView(), SORT_OPTIONS (+22 more)

### Community 18 - "ref_nestjs_common"
Cohesion: 0.08
Nodes (13): AuthModule, ChatSharedModule, AuthenticatedRequest, EnsureActiveUserGuard, GroupsModule, PresenceAudienceService, PresenceModule, PublicUser (+5 more)

### Community 19 - "src/app.module.ts"
Cohesion: 0.13
Nodes (5): AppController, AppModule, AppService, ChatModule, PrismaModule

### Community 20 - "sidebar.tsx"
Cohesion: 0.05
Nodes (47): AppLayout(), AuthLayout(), features, Home(), ImagePlaceholder(), AppNavigation(), AppShell(), navigation (+39 more)

### Community 21 - "social.controller.ts"
Cohesion: 0.18
Nodes (4): AuthModule, BlocksService, GetFriendshipsRequest, SocialModule

### Community 22 - "Chat TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 23 - "Endpoints"
Cohesion: 0.09
Nodes (22): Authentication, Chat Service API, Create a group, Create or get a direct conversation, Current limitations, Delete a message, Edit a message, Endpoints (+14 more)

### Community 24 - "User TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 25 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, amqp-connection-manager, amqplib, class-transformer, class-validator, minio, @nestjs/common, @nestjs/config (+12 more)

### Community 27 - "app/app.module.ts"
Cohesion: 0.10
Nodes (7): AccountsModule, AppController, AppModule, AppService, EventsModule, PrismaModule, SuperadminModule

### Community 28 - "User Runtime Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, amqp-connection-manager, amqplib, argon2, bcrypt, class-transformer, class-validator, @nestjs/common (+11 more)

### Community 29 - "User Development Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, dotenv, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier (+11 more)

### Community 30 - "user-events.consumer.ts"
Cohesion: 0.17
Nodes (7): EventsModule, isDate(), parseUserEvent(), USER_EVENT_TYPES, UserEvent, UserProfileData, UserEventsConsumer

### Community 31 - "Chat Development Dependencies"
Cohesion: 0.12
Nodes (16): devDependencies, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier, source-map-support (+8 more)

### Community 32 - "User Scripts and Commands"
Cohesion: 0.13
Nodes (15): scripts, build, deploy, format, lint, prisma:generate, start, start:debug (+7 more)

### Community 33 - "chat-service/tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 34 - "PrismaService"
Cohesion: 0.10
Nodes (6): RegisterDto, PrismaService, CreateUserDto, UpdateRoleDto, SuperadminGuard, adminUserSelect

### Community 35 - "auth.guard.ts"
Cohesion: 0.23
Nodes (4): AuthGuard, AccessTokenPayload, CurrentUser, IS_PUBLIC_KEY

### Community 36 - "auth.controller.ts"
Cohesion: 0.17
Nodes (9): AuthController, assertTrustedBrowserOrigin(), RequestPasswordResetDto, clearRefreshCookie(), publicSession(), readRefreshCookie(), REFRESH_COOKIE_NAME, refreshCookieOptions() (+1 more)

### Community 37 - "Nook — Project Context"
Cohesion: 0.09
Nodes (22): 10. Backlog organization, 11. Design context, 12. Questions to settle next, 13. Source and decision history, 1. Nook in one paragraph, 2. How to interpret this document, 3. Confirmed decisions, 4. Audience and reason to return (+14 more)

### Community 38 - "docs/README.md"
Cohesion: 0.17
Nodes (4): Account interface, How it fits together, Run locally, Verification and deployment

### Community 39 - "useAuth"
Cohesion: 0.09
Nodes (42): metadata, SettingsPage(), LoginPage(), metadata, metadata, RegisterPage(), metadata, ResetPasswordPage() (+34 more)

### Community 40 - "chat-workspace.tsx"
Cohesion: 0.08
Nodes (29): ChatContent(), ChatPage(), ChatPageProps, metadata, EmojiPicker(), applyMarkdownFormat(), formats, MarkdownFormat (+21 more)

### Community 43 - "Points Roadmap: Groups First, Frontend Next"
Cohesion: 0.12
Nodes (16): Add the Chess service after the first game is integrated, Integrate the friend's game, Optional points after the 18-point path, Phase 1 — Finish group chat on the backend, Phase 2 — Make presence and activity data usable, Phase 3 — Build the main frontend as feature-sized sessions, Phase 4 — Add two low-scope completion tasks, Phase 5 — Integrate the existing game, then decide on Chess (+8 more)

### Community 44 - "User Lint Configuration"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Community 45 - "public-profile.tsx"
Cohesion: 0.11
Nodes (43): instant, metadata, PublicProfilePage(), metadata, ProfilePage(), AccountAvatar(), colors, ChatMarkdown() (+35 more)

### Community 46 - "Chat Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 47 - "message-list.tsx"
Cohesion: 0.12
Nodes (21): dayFormat, dayKey(), dayLabel(), dayWithYearFormat, fullFormat, MessageAttachment(), download(), MessageList() (+13 more)

### Community 48 - "User Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 49 - "Button"
Cohesion: 0.16
Nodes (27): CreateGroupDialog(), groupMembersKey(), ConfirmDialog(), ChannelEditor(), ChannelsTab(), errorMessage(), GroupDetailsEditor(), GroupSettingsView() (+19 more)

### Community 51 - "Chat service MVP — our working plan"
Cohesion: 0.14
Nodes (14): Authentication contract, Chat service MVP — our working plan, Current implementation snapshot, Current next step: verify live delivery, then build groups and channels, Deployment work needed for the usable MVP, Feature checkpoints, Heartbeat/activity note, How we work (+6 more)

### Community 54 - "ChatService"
Cohesion: 0.14
Nodes (3): ChatService, DM endpoint tests, Run on 2026-10-31

### Community 55 - "oauth.ts"
Cohesion: 0.27
Nodes (10): OAuthReturnHandler(), isOAuthError(), isProvider(), OAuthError, OAuthFlow, OAuthNotice, OAuthReturn, parseOAuthReturn() (+2 more)

### Community 56 - "AuthenticatedRequest"
Cohesion: 0.22
Nodes (3): AccountsController, UploadedImage, AuthenticatedRequest

### Community 57 - "Chat Service Plan (merged)"
Cohesion: 0.13
Nodes (15): 10. Testing checklist, 11. Deliberately later, 12. Open decisions, 13. Merge notes (what was reconciled), 1. Mental model (read this when confused), 2. Points worth targeting, 4. Permission baseline, 6. Data model (+7 more)

### Community 58 - "build-dashboards.mjs"
Cohesion: 0.16
Nodes (15): alertList(), dashboards, grid, logsPanel(), LOKI, OUT, place(), PROM (+7 more)

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

### Community 63 - "GroupMember"
Cohesion: 0.25
Nodes (8): GroupMember, 2. Understand our membership table, Chat schema draft, Constraints before migration, How group conversations work, Rules the service must enforce, User data, 4. How an event mutates ChatUser

### Community 66 - "dm.postgres.test.mjs"
Cohesion: 0.12
Nodes (5): keys, pool, post(), prisma, signer

### Community 67 - "minio.module.ts"
Cohesion: 0.26
Nodes (12): clientOptions(), minioBucket(), minioClientOptions(), minioPresignClientOptions(), port(), required(), useSsl(), MINIO_CLIENT (+4 more)

### Community 68 - "client/package.json"
Cohesion: 0.11
Nodes (17): eslintConfig, @types/node, typescript, name, private, version, boring-avatars, class-variance-authority (+9 more)

### Community 69 - "generate-jwt-keys.mjs"
Cohesion: 0.14
Nodes (8): contrast(), design, luminance(), ca, directory, { privateKey, publicKey }, privatePath, publicPath

### Community 72 - "ProfileEditor"
Cohesion: 0.27
Nodes (8): EditProfilePage(), metadata, currentValues(), getErrorMessage(), ImagePreview(), ProfileEditor(), saveProfile(), updateField()

### Community 73 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @base-ui/react, boring-avatars, class-variance-authority, cn, next, next-themes, react (+8 more)

### Community 75 - "docs/chat-service/README.md"
Cohesion: 0.17
Nodes (10): Compile and run the project, Deployment, Description, License, Observability, Project setup, Resources, Run tests (+2 more)

### Community 76 - "ChatUser"
Cohesion: 0.27
Nodes (10): ChatUser, 10. How to try the combined flow, 11. File map and verification, 12. Where we go next, 1. What was already there, and what Chat adds, 2. Authentication: reuse the existing session, 3. Database and Prisma, 7. RabbitMQ profile synchronization (+2 more)

### Community 77 - "Local Compose setup"
Cohesion: 0.29
Nodes (7): First startup, Frontend, Local Compose setup, Local HTTPS and OAuth, Monitoring, Network and storage, Plug in another service

### Community 78 - "Nook profile and user settings design specification"
Cohesion: 0.17
Nodes (12): Account and secondary sections, API and state contract, Board inventory, Change Avatar dialog, Edit Banner dialog, Edit Profile panel, Execution record, Nook profile and user settings design specification (+4 more)

### Community 79 - "MinIO message attachments plan"
Cohesion: 0.25
Nodes (8): Current project state, Decisions to make during implementation, Goal, Implementation steps, MinIO message attachments plan, Storage model, Upload flow (presigned PUT), Verification checklist

### Community 80 - "chat-markdown.tsx"
Cohesion: 0.21
Nodes (7): components, markdownClass, remarkPlugins, react-dom, react-markdown, remark-breaks, remark-gfm

### Community 81 - "emoji-picker.tsx"
Cohesion: 0.24
Nodes (8): EmojiPanel(), pick(), readRecent(), writeRecent(), allEmojis, Emoji, emojiCategories, EmojiCategory

### Community 82 - "next"
Cohesion: 0.18
Nodes (5): ForgotPasswordPage(), metadata, ForgotPasswordForm(), nextConfig, next

### Community 83 - "user-service/README.md"
Cohesion: 0.17
Nodes (11): Compile and run the project, Deployment, Description, License, Observability, Project setup, Resources, Run tests (+3 more)

### Community 84 - "Milestones"
Cohesion: 0.17
Nodes (10): 1. Visual foundation and routes — complete, 2. Account session — in progress, 3. Real user data and social interactions — in progress, 4. Chat integration, 5. Remaining app views and release checks, Current state, Milestones, Nook client plan (+2 more)

### Community 85 - "ComingSoon"
Cohesion: 0.29
Nodes (7): FeedPage(), metadata, ChessPage(), metadata, metadata, PlayPage(), ComingSoon()

### Community 86 - "4. DM and message operations"
Cohesion: 0.50
Nodes (4): 4. DM and message operations, Editing and deleting, Opening a DM, Sending and retrying a message

### Community 87 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, shadcn, tailwindcss, @tailwindcss/turbopack, @types/node, @types/react (+2 more)

### Community 89 - "8. Build phases"
Cohesion: 0.22
Nodes (9): 8. Build phases, Phase 1: Foundation, Phase 2: Persistent DMs (REST only), Phase 3: Realtime + test UI, Phase 4: Groups and roles, Phase 5: Message actions, Phase 6: Presence (+2 U01 candidate), Phase 7: Search (optional, +1 W13 candidate) (+1 more)

### Community 90 - "Reading order"
Cohesion: 0.22
Nodes (8): 1. Understand how the schema connects models, 3. Choose which fields and relations to return, 5. Understand atomic writes, 6. Inspect what Prisma sends to PostgreSQL, How nesting relates to SQL joins, Practice using our project, Prisma reading guide for our chat service, Reading order

### Community 91 - "RabbitMQ events and the ChatUser table"
Cohesion: 0.22
Nodes (8): 1. The complete flow, 2. Where events originate, 3. What an event contains, 5. Deletion preserves chat history, 6. Acknowledgements and failures, 7. Where the HTTP fallback fits, 8. Current consistency limits, RabbitMQ events and the ChatUser table

### Community 92 - "providers.tsx"
Cohesion: 0.24
Nodes (9): geistMono, inter, metadata, RootLayout(), getQueryClient(), makeQueryClient(), Providers(), AuthProvider() (+1 more)

### Community 94 - "SERVICE.md"
Cohesion: 0.10
Nodes (17): token(), Architecture and source map, Authentication and authorization, Configuration, Current limitations, Data model, Development and checks, Documentation map (+9 more)

### Community 96 - "Search and Friend Requests"
Cohesion: 0.29
Nodes (6): Assumptions, Backend search, Client experience, Search and Friend Requests, Summary, Validation

### Community 97 - "Deferred Public API Adapter"
Cohesion: 0.29
Nodes (7): API-key lifecycle, Build order when resumed, Defer implementation until, Deferred Public API Adapter, Goal, Request handling and security, W06 completion checklist

### Community 98 - "user-service/tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 99 - "Nook — Profile Bio & Custom Status"
Cohesion: 0.29
Nodes (6): 1. Database, 2. User service, 3. Frontend, 4. Acceptance checks, Goal, Nook — Profile Bio & Custom Status

### Community 100 - "Chat attachments: upload and download"
Cohesion: 0.25
Nodes (7): Chat attachments: upload and download, Code map, Current limits to keep in mind, Upload and send flow, Viewing and downloading, What goes where, Why two MinIO clients and endpoints exist

### Community 101 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 102 - "5. Architecture"
Cohesion: 0.33
Nodes (6): 5. Architecture, Deployment, Identity and tokens, Keeping `ChatUser` fresh (the one microservice rule in practice), Sockets, Write path: REST writes, sockets for live updates

### Community 103 - "Nook documentation"
Cohesion: 0.33
Nodes (6): Chat service, Client (Next.js), Infrastructure and archive, Nook documentation, Project, User service

### Community 104 - "mail.service.ts"
Cohesion: 0.29
Nodes (6): nodemailer, MailService, actionButton(), layout(), passwordResetEmailTemplate(), verificationEmailTemplate()

### Community 106 - "3. First-release behavior"
Cohesion: 0.40
Nodes (5): 3. First-release behavior, DMs, Groups and channels, Messages and reactions, Presence

### Community 107 - "client/README.md"
Cohesion: 0.40
Nodes (4): Deploy on Vercel, Learn More, Local development, Production configuration

### Community 110 - "5. History, read state, and unread counts"
Cohesion: 0.50
Nodes (4): 5. History, read state, and unread counts, Calculating unread messages, Loading history, Recording a read marker

### Community 111 - "Use of AI"
Cohesion: 0.33
Nodes (5): FT_TRANSCENDENCE, Tasks where AI was used, Tools, Use of AI, What we did ourselves

### Community 124 - "envs/README.md"
Cohesion: 0.25
Nodes (6): Local MinIO, Configure a fresh clone, Environment configuration, File ownership, Internal and public addresses, Placeholder convention

### Community 125 - "Monitoring"
Cohesion: 0.25
Nodes (8): Alert rules, Dashboards, How this maps to module D02 (Prometheus and Grafana), Monitoring, Security and privacy, Setup, Troubleshooting, What runs

### Community 126 - "Additional routes verified against source"
Cohesion: 0.33
Nodes (6): Additional routes verified against source, Corrections to earlier limitation notes, Friendships, Search accounts, Service root, Set or change password

### Community 128 - "Local Monitoring for Nook"
Cohesion: 0.40
Nodes (5): Containers, Implementation, Local Monitoring for Nook, Summary, Validation and Defaults

## Knowledge Gaps
- **662 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+657 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 970 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useAuth` to `client/package.json`, `chat-workspace.tsx`, `public-profile.tsx`, `message-list.tsx`, `chat-markdown.tsx`, `Button`, `emoji-picker.tsx`, `search-view.tsx`, `sidebar.tsx`, `oauth.ts`, `providers.tsx`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `token()` connect `SERVICE.md` to `dm.postgres.test.mjs`, `useAuth`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `ChatUser` connect `ChatUser` to `8. Build phases`, `5. Architecture`, `public-profile.tsx`, `message-list.tsx`, `Chat service MVP — our working plan`, `Endpoints`, `Chat Service Plan (merged)`, `Reading order`, `RabbitMQ events and the ChatUser table`, `GroupMember`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _662 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `accounts.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1168091168091168 - nodes in this community are weakly interconnected._
- **Should `SuperadminService` be split into smaller, more focused modules?**
  _Cohesion score 0.09024390243902439 - nodes in this community are weakly interconnected._
- **Should `ChatGateway` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._