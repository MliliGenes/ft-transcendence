# Graph Report - ft-transcendence  (2026-11-04)

## Corpus Check
- cluster-only mode â€” file stats not available

## Summary
- 1188 nodes Â· 2602 edges Â· 54 communities (38 shown, 16 thin omitted)
- Extraction: 96% EXTRACTED Â· 4% INFERRED Â· 0% AMBIGUOUS Â· INFERRED: 98 edges (avg confidence: 0.8)
- Token cost: 0 input Â· 0 output

## Graph Freshness
- Built from commit: `f8192d82`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Frontend Auth and Account UI
- API Requests and Token Helpers
- Account Controllers and Services
- RabbitMQ User Profile Events
- Social Blocks and Friendships
- Chat Presence Gateway
- Chat Messaging Service
- Discord OAuth
- GitHub OAuth
- Chat Message DTOs
- Chat Package Metadata
- User Service Metadata
- Group HTTP Controller
- Authentication and Recovery
- User Bootstrap Scripts
- Auth Payload and Hash Helpers
- Group Membership DTOs
- Frontend Dependencies
- Chat User Profile Guard
- Application and Prisma Modules
- User Auth DTOs and Guards
- Prisma Database Client
- Chat TypeScript Configuration
- Auth HTTP Controller
- User TypeScript Configuration
- Chat Runtime Dependencies
- Group Service
- User Feature Modules
- User Runtime Dependencies
- User Development Dependencies
- User Event Consumer
- Chat Development Dependencies
- User Scripts and Commands
- Chat Build Configuration
- Superadmin User DTO
- Access Token Guard
- Chat Feature Modules
- Email Service
- User Query DTO and Filters
- Application Health Controller
- Chat Lint Configuration
- Group Creation DTO
- Channel Update DTO
- Group Update DTO
- User Lint Configuration
- Superadmin Admin Module
- Chat Nest Build Setup
- User Nest Build Setup
- Registration Validation DTO
- Password Reset Confirmation DTO
- Browser Origin Configuration
- Nginx Entrypoint

## God Nodes (most connected - your core abstractions)
1. `AuthService` - 32 edges
2. `Notice()` - 25 edges
3. `scripts` - 25 edges
4. `GroupsService` - 23 edges
5. `PrismaService` - 22 edges
6. `AuthenticatedRequest` - 21 edges
7. `useAuth()` - 21 edges
8. `GroupsController` - 20 edges
9. `compilerOptions` - 19 edges
10. `compilerOptions` - 19 edges

## Surprising Connections (you probably didn't know these)
- `submit()` --indirect_call--> `token()`  [INFERRED]
  auth-profile-web/src/pages/PasswordResetPage.jsx â†’ chat-service/test/dm.postgres.test.mjs
- `UserQueryDto` --inherits--> `PaginationDto`  [EXTRACTED]
  user-service/src/superadmin/dto/user-query.dto.ts â†’ user-service/src/accounts/dto/pagination.dto.ts
- `CreateUserDto` --inherits--> `RegisterDto`  [EXTRACTED]
  user-service/src/superadmin/dto/create-user.dto.ts â†’ user-service/src/auth/dto/register.dto.ts
- `choose()` --calls--> `imageError()`  [EXTRACTED]
  auth-profile-web/src/components/ImageUpload.jsx â†’ auth-profile-web/src/lib/account.js
- `submit()` --calls--> `passwordChangeError()`  [EXTRACTED]
  auth-profile-web/src/components/PasswordForm.jsx â†’ auth-profile-web/src/lib/account.js

## Import Cycles
- None detected.

## Communities (54 total, 16 thin omitted)

### Frontend Auth and Account UI - "Frontend Auth and Account UI"
Cohesion: 0.06
Nodes (70): App(), AuthContext, AuthProvider(), useAuth(), Connections(), Directory(), ImageUpload(), choose() (+62 more)

### API Requests and Token Helpers - "API Requests and Token Helpers"
Cohesion: 0.05
Nodes (19): databaseUrl, keys, pool, post(), prisma, signer, token(), ca (+11 more)

### Account Controllers and Services - "Account Controllers and Services"
Cohesion: 0.05
Nodes (14): AccountImagesController, AccountsController, accountResponse(), accountSelect, AccountsService, publicProfileSelect, PaginationDto, UpdateAccountDto (+6 more)

### RabbitMQ User Profile Events - "RabbitMQ User Profile Events"
Cohesion: 0.06
Nodes (7): RabbitMqEventsService, USER_EVENT_TYPES, UserEvent, UserProfileData, UserProfileSnapshot, SuperadminController, SuperadminService

### Social Blocks and Friendships - "Social Blocks and Friendships"
Cohesion: 0.10
Nodes (3): BlocksService, FriendshipsService, SocialController

### Chat Presence Gateway - "Chat Presence Gateway"
Cohesion: 0.10
Nodes (8): ChatGateway, PresenceAudienceService, PresenceModule, PresenceChange, PresenceService, PresenceStatus, @nestjs/websockets, socket.io

### Discord OAuth - "Discord OAuth"
Cohesion: 0.14
Nodes (3): DiscordController, DiscordStrategy, record()

### GitHub OAuth - "GitHub OAuth"
Cohesion: 0.14
Nodes (3): GithubController, GithubStrategy, record()

### Chat Message DTOs - "Chat Message DTOs"
Cohesion: 0.10
Nodes (5): CreateDmDto, EditMessageDto, GetMessagesQueryDto, MarkReadDto, SendMessageDto

### Chat Package Metadata - "Chat Package Metadata"
Cohesion: 0.07
Nodes (26): author, description, amqplib, class-transformer, @nestjs/cli, @nestjs/config, @nestjs/platform-express, @nestjs/testing (+18 more)

### User Service Metadata - "User Service Metadata"
Cohesion: 0.07
Nodes (26): amqp-connection-manager, class-validator, @nestjs/common, @nestjs/core, @nestjs/jwt, @nestjs/mau, @nestjs/schematics, @prisma/adapter-pg (+18 more)

### Authentication and Recovery - "Authentication and Recovery"
Cohesion: 0.17
Nodes (3): AuthService, DiscordProfile, GithubProfile

### User Bootstrap Scripts - "User Bootstrap Scripts"
Cohesion: 0.08
Nodes (25): scripts, bootstrap:superadmin, bootstrap:superadmin:env, build, deploy, format, lint, prisma:generate (+17 more)

### Auth Payload and Hash Helpers - "Auth Payload and Hash Helpers"
Cohesion: 0.12
Nodes (7): AUTH_TOKEN_PATTERN, AuthResult, LoginDto, REFRESH_TOKEN_PATTERN, RefreshDto, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS

### Group Membership DTOs - "Group Membership DTOs"
Cohesion: 0.15
Nodes (5): AddGroupMemberDto, CreateChannelDto, UpdateGroupMemberRoleDto, AuthenticatedRequest, GroupDb

### Frontend Dependencies - "Frontend Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, react, react-dom, socket.io-client, devDependencies, vite, @vitejs/plugin-react, name (+12 more)

### Chat User Profile Guard - "Chat User Profile Guard"
Cohesion: 0.14
Nodes (5): AuthenticatedRequest, EnsureActiveUserGuard, PublicUser, UserProfilesService, PrismaService

### Application and Prisma Modules - "Application and Prisma Modules"
Cohesion: 0.14
Nodes (4): AppController, AppModule, AppService, PrismaModule

### User Auth DTOs and Guards - "User Auth DTOs and Guards"
Cohesion: 0.19
Nodes (9): RequestPasswordResetDto, AccessTokenGuard, clearRefreshCookie(), publicSession(), readRefreshCookie(), REFRESH_COOKIE_NAME, refreshCookieOptions(), setRefreshCookie() (+1 more)

### Prisma Database Client - "Prisma Database Client"
Cohesion: 0.11
Nodes (4): PrismaModule, PrismaService, friendshipSelect, friendUserSelect

### Chat TypeScript Configuration - "Chat TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### User TypeScript Configuration - "User TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Chat Runtime Dependencies - "Chat Runtime Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, amqp-connection-manager, amqplib, class-transformer, class-validator, @nestjs/common, @nestjs/config, @nestjs/core (+11 more)

### User Feature Modules - "User Feature Modules"
Cohesion: 0.18
Nodes (5): AccountsModule, AppModule, AuthModule, EventsModule, SocialModule

### User Runtime Dependencies - "User Runtime Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, amqp-connection-manager, amqplib, argon2, bcrypt, class-transformer, class-validator, @nestjs/common (+11 more)

### User Development Dependencies - "User Development Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, dotenv, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier (+11 more)

### User Event Consumer - "User Event Consumer"
Cohesion: 0.17
Nodes (7): EventsModule, isDate(), parseUserEvent(), USER_EVENT_TYPES, UserEvent, UserProfileData, UserEventsConsumer

### Chat Development Dependencies - "Chat Development Dependencies"
Cohesion: 0.12
Nodes (16): devDependencies, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier, source-map-support (+8 more)

### User Scripts and Commands - "User Scripts and Commands"
Cohesion: 0.13
Nodes (15): scripts, build, deploy, format, lint, prisma:generate, start, start:debug (+7 more)

### Chat Build Configuration - "Chat Build Configuration"
Cohesion: 0.15
Nodes (11): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json, compilerOptions, rootDir (+3 more)

### Superadmin User DTO - "Superadmin User DTO"
Cohesion: 0.31
Nodes (3): CreateUserDto, UpdateRoleDto, adminUserSelect

### Access Token Guard - "Access Token Guard"
Cohesion: 0.23
Nodes (4): AuthGuard, AccessTokenPayload, CurrentUser, IS_PUBLIC_KEY

### Chat Feature Modules - "Chat Feature Modules"
Cohesion: 0.27
Nodes (4): AuthModule, ChatModule, ChatSharedModule, GroupsModule

### Email Service - "Email Service"
Cohesion: 0.29
Nodes (6): nodemailer, MailService, actionButton(), layout(), passwordResetEmailTemplate(), verificationEmailTemplate()

### Chat Lint Configuration - "Chat Lint Configuration"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### User Lint Configuration - "User Lint Configuration"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Chat Nest Build Setup - "Chat Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### User Nest Build Setup - "User Nest Build Setup"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

## Knowledge Gaps
- **246 isolated node(s):** `AuthResult`, `AuthenticatedRequest`, `GroupDb`, `AuthenticatedRequest`, `PublicUser` (+241 more)
  These have â‰¤1 connection - possible missing edges. (Counts symbols only; 483 node(s) total have â‰¤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** â€” run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `bcrypt` connect `API Requests and Token Helpers` to `Account Controllers and Services`, `User Service Metadata`, `Superadmin User DTO`, `Auth Payload and Hash Helpers`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `AuthenticatedRequest` connect `Account Controllers and Services` to `Superadmin User DTO`, `RabbitMQ User Profile Events`, `Discord OAuth`, `GitHub OAuth`, `Superadmin Admin Module`, `User Auth DTOs and Guards`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Authentication and Recovery` to `RabbitMQ User Profile Events`, `Discord OAuth`, `GitHub OAuth`, `Auth Payload and Hash Helpers`, `User Auth DTOs and Guards`, `Auth HTTP Controller`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `AuthResult`, `AuthenticatedRequest`, `GroupDb` to the rest of the system?**
  _246 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend Auth and Account UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05721434528773978 - nodes in this community are weakly interconnected._
- **Should `API Requests and Token Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.053479381443298966 - nodes in this community are weakly interconnected._
- **Should `Account Controllers and Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05277777777777778 - nodes in this community are weakly interconnected._