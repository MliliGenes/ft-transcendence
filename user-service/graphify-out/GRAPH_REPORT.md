# Graph Report - user-service  (2026-10-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 601 nodes · 1360 edges · 21 communities (19 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a1c42880`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 32 edges
2. `AuthService` - 27 edges
3. `scripts` - 24 edges
4. `AuthenticatedRequest` - 21 edges
5. `useAuth()` - 19 edges
6. `compilerOptions` - 19 edges
7. `PrismaService` - 18 edges
8. `AccountsService` - 17 edges
9. `Notice()` - 17 edges
10. `SuperadminService` - 16 edges

## Surprising Connections (you probably didn't know these)
- `UserQueryDto` --inherits--> `PaginationDto`  [EXTRACTED]
  src/superadmin/dto/user-query.dto.ts → src/accounts/dto/pagination.dto.ts
- `choose()` --calls--> `imageError()`  [EXTRACTED]
  auth-profile-web/src/components/ImageUpload.jsx → auth-profile-web/src/lib/account.js
- `submit()` --calls--> `passwordChangeError()`  [EXTRACTED]
  auth-profile-web/src/components/PasswordForm.jsx → auth-profile-web/src/lib/account.js
- `submit()` --calls--> `toProfileForm()`  [EXTRACTED]
  auth-profile-web/src/components/ProfileForm.jsx → auth-profile-web/src/lib/account.js
- `submit()` --calls--> `passwordSetError()`  [EXTRACTED]
  auth-profile-web/src/components/SetPasswordForm.jsx → auth-profile-web/src/lib/account.js

## Import Cycles
- None detected.

## Communities (21 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (50): App(), AuthContext, AuthProvider(), useAuth(), Connections(), Directory(), ImageUpload(), choose() (+42 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (16): class-validator, @nestjs/common, AuthModule, AuthResult, LoginDto, REFRESH_TOKEN_PATTERN, RefreshDto, RegisterDto (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (13): AccountImagesController, AccountsController, accountResponse(), accountSelect, AccountsService, publicProfileSelect, PaginationDto, SetPasswordDto (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (14): bcrypt, @nestjs/config, @nestjs/jwt, @nestjs/testing, pg, @prisma/adapter-pg, reflect-metadata, supertest (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (4): UpdateAccountDto, UserQueryDto, SuperadminController, SuperadminService

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (4): AuthController, AuthService, DiscordProfile, GithubProfile

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (3): DiscordController, DiscordStrategy, record()

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (3): GithubController, GithubStrategy, record()

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (25): author, description, license, name, private, type, version, argon2 (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (24): scripts, bootstrap:superadmin, build, deploy, format, lint, prisma:generate, prisma:validate (+16 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (6): @nestjs/core, AccountsModule, AppController, AppService, PrismaModule, SuperadminModule

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (18): dependencies, react, react-dom, devDependencies, vite, @vitejs/plugin-react, name, private (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (19): devDependencies, dotenv, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (16): dependencies, argon2, bcrypt, class-transformer, class-validator, @nestjs/common, @nestjs/config, @nestjs/core (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, rootDir, exclude, extends, include

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (4): databaseUrl, dotenv, prisma, args

## Knowledge Gaps
- **139 isolated node(s):** `AuthResult`, `AuthContext`, `empty`, `empty`, `IMAGE_LIMITS` (+134 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 242 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `Community 1` to `Community 8`, `Community 3`, `Community 2`, `Community 10`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `AuthenticatedRequest` connect `Community 2` to `Community 1`, `Community 4`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `scripts` connect `Community 9` to `Community 8`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `AuthResult`, `AuthContext`, `empty` to the rest of the system?**
  _139 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07592592592592592 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.061458718992965566 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06259780907668232 - nodes in this community are weakly interconnected._