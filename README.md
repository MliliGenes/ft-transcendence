*This project has been created as part of the 42 curriculum by [login1], [login2], [login3], [login4], [login5].*

---

<div align="center">

# 🌐 Nexus

### A developer community platform for the 42 network and beyond.

Post. Discuss. Connect. Compete.

![Version](https://img.shields.io/badge/version-1.0.0-white?style=flat-square)
![Status](https://img.shields.io/badge/status-in%20development-white?style=flat-square)
![Points](https://img.shields.io/badge/modules-15%20pts%20planned-white?style=flat-square)
![42](https://img.shields.io/badge/42-ft__transcendence-white?style=flat-square)

</div>

---

## Description

**Nexus** is a full-stack developer community platform — think Reddit, Discord, and GitHub Social in one place, built specifically for developers and 42 students.

The core idea is simple: a place where developers can write posts, share code snippets, discuss ideas, send messages, follow each other, and compete in a built-in multiplayer game. Every feature is designed to be modular — each layer of functionality is independent, stands on its own, and makes the previous layers more valuable.

### Key Features

- **Identity & Portfolio** — User profiles with skills, bio, and avatar. Log in with your 42 intra account via OAuth and have your profile auto-populate from your intra data.
- **Content Layer** — Write and publish posts with Markdown support, syntax-highlighted code snippets, tags, and categories.
- **Social Graph** — Follow users, send friend requests, and see a live activity feed of what people you follow are posting and doing.
- **Real-time Messaging** — Direct messages, typing indicators, read receipts, and live online status via WebSockets.
- **Communities** — Create and join topic-based rooms (e.g. `#webdev`, `#42-projects`, `#career`). Posts live inside communities.
- **Notifications** — Real-time alerts for follows, likes, comments, messages, and mentions.
- **Discovery** — Search posts and users with filters, tags, and sorting. Trending content surfaced automatically.
- **Multiplayer Game** — A built-in competitive game (TBD by team) with leaderboards, match history, and tournament support.

### Project Philosophy

Nexus is built feature-by-feature in a strict order where each phase is shippable and valuable on its own. No phase blocks another. This makes the project naturally modular for a team: multiple people can work on different layers simultaneously without stepping on each other.

---

## Team Information

> **Note:** Team roles will be finalized at the project kickoff meeting. The structure below reflects the intended organization for a 4–5 person team.

| Login | Role(s) | Responsibilities |
|---|---|---|
| [login1] | Tech Lead + Developer | Defines technical architecture, makes stack decisions, reviews critical code, implements core backend and auth |
| [login2] | Product Owner + Developer | Maintains product vision and backlog, validates completed features, implements content and social layers |
| [login3] | Scrum Master + Developer | Organizes meetings, tracks deadlines, manages blockers, implements real-time and messaging features |
| [login4] | Developer | Implements game module, game statistics, and tournament system |
| [login5] | Developer | Implements frontend, design system, search, and accessibility/i18n |

> For a 4-person team: login1 takes Tech Lead + Scrum Master, login2 takes PO + Developer.

---

## Project Management

### Work Organization

The project is divided into 10 sequential phases, each independently shippable:

| Phase | Feature | Owner | Status |
|---|---|---|---|
| 1 | Auth, profiles, Docker setup | [login1] | 🔲 |
| 2 | Posts, Markdown, code snippets | [login2] | 🔲 |
| 3 | Likes, comments, nested replies | [login2] | 🔲 |
| 4 | Follow system, activity feed | [login3] | 🔲 |
| 5 | Real-time messaging (WebSockets) | [login3] | 🔲 |
| 6 | Notification system | [login3] | 🔲 |
| 7 | Communities / group rooms | [login2] | 🔲 |
| 8 | Multiplayer game + leaderboard | [login4] | 🔲 |
| 9 | Search, filters, discovery | [login5] | 🔲 |
| 10 | AI recommendations, analytics | [login1] | 🔲 |

### Tools

- **Task tracking:** GitHub Issues + GitHub Projects (Kanban board)
- **Communication:** Discord — dedicated server with channels per module
- **Code reviews:** GitHub Pull Requests — minimum 1 review before merge into `main`
- **Versioning:** Git with conventional commit messages (`feat:`, `fix:`, `chore:`, etc.)
- **Meetings:** Weekly sync every Monday — progress, blockers, next week plan

### Branching Strategy

```
main          ← stable, deployable at all times
dev           ← integration branch
feat/<name>   ← one branch per feature/phase
fix/<name>    ← bug fixes
```

---

## Instructions

### Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Purpose |
|---|---|---|
| Docker | 24.x+ | Container runtime |
| Docker Compose | 2.x+ | Multi-container orchestration |
| Git | Any | Version control |
| Make | Any | Command shortcuts (optional) |

> Node.js and Python are **not** required on your host machine — everything runs inside Docker containers.

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/[team]/ft_transcendence.git
cd ft_transcendence
```

2. Copy the example environment file and fill in your values:
```bash
cp .env.example .env
```

3. Open `.env` and configure the required variables (see `.env.example` for descriptions):

```env
# App
NODE_ENV=production
DOMAIN=localhost
PORT=443

# Database
POSTGRES_DB=nexus
POSTGRES_USER=nexus_user
POSTGRES_PASSWORD=your_password_here

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRY=7d

# 42 OAuth
FORTY_TWO_CLIENT_ID=your_42_client_id
FORTY_TWO_CLIENT_SECRET=your_42_client_secret
FORTY_TWO_REDIRECT_URI=https://localhost/auth/callback/42

# 2FA (optional)
TOTP_APP_NAME=Nexus
```

> **Never commit your `.env` file.** It is listed in `.gitignore` by default.
> Get your 42 OAuth credentials at: [https://profile.intra.42.fr/oauth/applications](https://profile.intra.42.fr/oauth/applications)

### Running the Project

Start the entire stack with a single command:

```bash
docker compose up --build
```

The application will be available at:
- **App:** `https://localhost`
- **API:** `https://localhost/api`

To stop:
```bash
docker compose down
```

To reset the database:
```bash
docker compose down -v
docker compose up --build
```

### Development Mode

```bash
docker compose -f docker-compose.dev.yml up --build
```

This enables hot-reload for both frontend and backend.

---

## Technical Stack

### Frontend

| Technology | Justification |
|---|---|
| **React** | Component-based architecture, large ecosystem, excellent WebSocket/real-time support, team familiarity |
| **Tailwind CSS** | Utility-first, consistent design tokens, no CSS file overhead, rapid iteration |
| **React Router** | Standard SPA routing for React |
| **Socket.io Client** | Matches the backend Socket.io server for real-time features |

### Backend

| Technology | Justification |
|---|---|
| **NestJS** | TypeScript end-to-end, built-in WebSocket support via Socket.io, modular architecture that mirrors our feature phases, dependency injection for testability |
| **Prisma ORM** | Type-safe database queries, auto-generated client from schema, readable migrations |
| **Passport.js** | Standard auth middleware for NestJS — handles JWT and OAuth strategies cleanly |

### Database

| Technology | Justification |
|---|---|
| **PostgreSQL** | Relational model fits our data (users → posts → comments → likes), ACID compliance, excellent with Prisma |

### Infrastructure

| Technology | Role |
|---|---|
| **Docker + Docker Compose** | Single-command deployment, environment parity, required by subject |
| **Nginx** | Reverse proxy, TLS termination, serves frontend static files |
| **Let's Encrypt / self-signed** | HTTPS enforcement as required by the subject |

### Architecture Overview

```
Client (React SPA)
    │
    │ HTTPS / WSS
    ▼
Nginx (reverse proxy + TLS)
    │
    ├──► NestJS API (REST + WebSockets)
    │        │
    │        ├──► PostgreSQL (via Prisma)
    │        └──► Static assets
    │
    └──► /api/*  → NestJS
         /*      → React build
```

---

## Database Schema

### Entity Relationship Overview

```
users
  ├── id, login, email, password_hash, avatar_url
  ├── bio, skills[], intra_level, coalition
  ├── created_at, updated_at
  │
  ├──< posts (user has many posts)
  ├──< comments (user has many comments)
  ├──< likes (user has many likes)
  ├──< messages_sent
  ├──< messages_received
  ├──< followers (self-referential)
  ├──< following (self-referential)
  └──< game_matches (as player1 or player2)

posts
  ├── id, title, body (markdown), code_snippet
  ├── author_id → users
  ├── community_id → communities
  ├── tags[]
  └──< comments, likes

comments
  ├── id, body, author_id → users
  ├── post_id → posts
  └── parent_id → comments (nested replies)

communities
  ├── id, name, description, icon
  └──< posts, memberships

messages
  ├── id, body, sender_id → users
  ├── receiver_id → users
  └── read_at, created_at

game_matches
  ├── id, player1_id → users, player2_id → users
  ├── winner_id → users
  ├── score_player1, score_player2
  └── played_at

notifications
  ├── id, recipient_id → users
  ├── type (follow | like | comment | message | mention)
  ├── actor_id → users
  ├── reference_id, reference_type
  └── read_at, created_at
```

### Key Design Decisions

- Passwords are **hashed with bcrypt** (salt rounds: 12) — never stored in plain text.
- All timestamps are stored in **UTC**.
- `tags` on posts are stored as a PostgreSQL array for simplicity at this scale.
- The `game_matches` table is game-agnostic — the game type is stored as a field, so a second game can be added without a schema change.

---

## Features List

| Feature | Description | Owner | Module |
|---|---|---|---|
| Registration & Login | Email/password auth with bcrypt hashing | [login1] | Mandatory |
| 42 OAuth Login | Login with 42 intra, auto-fill profile | [login1] | Minor |
| JWT Auth | Stateless auth, refresh token rotation | [login1] | Mandatory |
| User Profile | Avatar, bio, skills, intra level display | [login2] | Major |
| Avatar Upload | Upload or use default, stored securely | [login2] | Major |
| Online Status | Live presence via WebSocket heartbeat | [login3] | Major |
| Friend System | Add/remove friends, see friends list | [login2] | Major |
| Follow System | Follow/unfollow, activity feed | [login2] | Major |
| Post Creation | Markdown posts with code highlighting | [login2] | — |
| Comments | Nested threaded comments on posts | [login2] | — |
| Likes | Like posts and comments | [login2] | — |
| Direct Messages | Real-time 1-to-1 chat via WebSockets | [login3] | Major |
| Typing Indicators | Live typing status in chat | [login3] | Major |
| Read Receipts | Message seen status | [login3] | Major |
| Notifications | Real-time alerts for all social actions | [login3] | Minor |
| Communities | Topic rooms, post inside a community | [login2] | Major |
| Multiplayer Game | [TBD by team] with live gameplay | [login4] | Major |
| Game Leaderboard | Ranked scores across all players | [login4] | Minor |
| Match History | Past games, results, opponents | [login4] | Minor |
| Tournament System | Brackets, matchmaking, registration | [login4] | Minor |
| Search | Full-text search on posts and users | [login5] | Minor |
| Privacy Policy | Accessible page with relevant content | [login5] | Mandatory |
| Terms of Service | Accessible page with relevant content | [login5] | Mandatory |
| Responsive UI | Mobile-first, all screen sizes | [login5] | Mandatory |
| Multi-language | EN, FR, AR (RTL) | [login5] | Minor |
| GDPR Compliance | Data export and account deletion | [login1] | Minor |

---

## Modules

### Points Summary

| # | Module | Category | Type | Points | Owner |
|---|---|---|---|---|---|
| 1 | Use frameworks (React + NestJS) | Web | Major | 2 | [login1] + [login5] |
| 2 | Real-time features via WebSockets | Web | Major | 2 | [login3] |
| 3 | User interaction — chat, profiles, friends | Web | Major | 2 | [login2] + [login3] |
| 4 | Standard user management & auth | User Management | Major | 2 | [login1] + [login2] |
| 5 | Web-based multiplayer game | Gaming | Major | 2 | [login4] |
| 6 | OAuth 2.0 with 42 intranet | User Management | Minor | 1 | [login1] |
| 7 | ORM for database (Prisma) | Web | Minor | 1 | [login1] |
| 8 | Notification system | Web | Minor | 1 | [login3] |
| 9 | Game statistics + match history | User Management | Minor | 1 | [login4] |
| 10 | Advanced search | Web | Minor | 1 | [login5] |
| 11 | Multi-language EN/FR/AR | Accessibility & i18n | Minor | 1 | [login5] |
| | **Total** | | | **16** | |

> 14 points required. We plan for 16 to account for a module being partially rejected at evaluation.

### Module Justifications

**Module 1 — Frameworks (Major, 2pts)**
React provides a component model that maps cleanly to our feature phases. NestJS mirrors this on the backend with its module system. Using TypeScript end-to-end eliminates an entire category of bugs and makes the codebase consistent for the whole team.

**Module 2 — Real-time via WebSockets (Major, 2pts)**
Real-time is not a nice-to-have for Nexus — it is the product. Chat, online presence, live notifications, and game state all require persistent bidirectional connections. Socket.io (integrated into NestJS) handles connection/disconnection gracefully and supports room-based broadcasting which maps directly to our community and game features.

**Module 3 — User Interaction (Major, 2pts)**
Chat, profiles, and a friend system are the social layer that ties the entire platform together. Without this module, Nexus is a blog. With it, it becomes a community. This module is implemented across phases 4 and 5 of the build plan.

**Module 4 — Standard User Management (Major, 2pts)**
Covers profile editing, avatar upload, friend requests, and online status display. This is the identity layer that every other feature builds on. Implemented in phase 1.

**Module 5 — Web-based Multiplayer Game (Major, 2pts)**
The game is what gives users a reason to return to the platform beyond reading posts. It creates a competitive social layer — leaderboards, rivalries, shared experiences — that reinforces the community aspect. The specific game is decided by team vote at kickoff.

**Module 6 — 42 OAuth (Minor, 1pt)**
The natural auth method for a platform aimed at 42 students. It removes the sign-up friction entirely and enables auto-filling profiles with real intra data — level, coalition, campus — which is Nexus's differentiator versus a generic platform.

**Module 7 — ORM / Prisma (Minor, 1pt)**
Prisma generates a fully type-safe database client from the schema file. This eliminates raw SQL errors, makes migrations readable and reversible, and means the whole team can read and write database queries without knowing SQL deeply.

**Module 8 — Notification System (Minor, 1pt)**
Every social action (like, comment, follow, message, mention) produces a notification. This is what makes the platform feel alive rather than static. Implemented as a real-time push via WebSocket with a persistent store for offline users.

**Module 9 — Game Statistics + Match History (Minor, 1pt)**
Requires module 5. Win/loss records, ranking, progression over time, and match-by-match history. Stored in the `game_matches` table. Displayed on user profiles as part of their identity.

**Module 10 — Advanced Search (Minor, 1pt)**
Full-text search across posts, users, and communities. Filters by tag, date, community, and author. Sorted by relevance or recency. Built on PostgreSQL's native full-text search capabilities.

**Module 11 — Multi-language EN/FR/AR (Minor, 1pt)**
English, French, and Arabic with full RTL layout mirroring for Arabic. Implemented via i18next with a language switcher in the UI. All user-facing strings are extracted into translation files from day one.

---

## Individual Contributions

> This section is completed progressively as the project is built. Each team member documents their work here at the end of each phase.

### [login1] — Tech Lead + Developer
- [ ] Project scaffolding and Docker Compose setup
- [ ] PostgreSQL + Prisma schema and initial migrations
- [ ] NestJS application structure and module organization
- [ ] JWT authentication (register, login, refresh, logout)
- [ ] 42 OAuth integration (Passport.js strategy)
- [ ] HTTPS configuration with Nginx
- [ ] Environment variable management (.env + validation)
- [ ] GDPR compliance features (data export, account deletion)
- [ ] Code review of all critical backend changes

### [login2] — Product Owner + Developer
- [ ] User profile pages (view and edit)
- [ ] Avatar upload and default avatar fallback
- [ ] Post creation (Markdown editor, syntax highlighting)
- [ ] Comment system (nested replies)
- [ ] Like system (posts and comments)
- [ ] Follow/unfollow and friend request system
- [ ] Activity feed
- [ ] Communities (create, join, post inside)
- [ ] Product backlog maintenance and feature prioritization

### [login3] — Scrum Master + Developer
- [ ] WebSocket gateway setup (Socket.io + NestJS)
- [ ] Real-time direct messaging
- [ ] Typing indicators and read receipts
- [ ] Online/offline presence system
- [ ] Notification system (real-time + persistent)
- [ ] Team meeting facilitation and progress tracking

### [login4] — Developer
- [ ] Multiplayer game implementation ([TBD])
- [ ] Game matchmaking
- [ ] Game leaderboard
- [ ] Match history storage and display
- [ ] Tournament bracket system

### [login5] — Developer
- [ ] React application structure and routing
- [ ] Global design system (components, tokens, typography)
- [ ] Responsive layout (mobile-first)
- [ ] Advanced search UI and backend integration
- [ ] i18n system setup (i18next)
- [ ] EN, FR, AR translations + RTL layout
- [ ] Privacy Policy and Terms of Service pages
- [ ] Browser compatibility testing

---

## Resources

### Documentation
- [NestJS Documentation](https://docs.nestjs.com)
- [React Documentation](https://react.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Socket.io Documentation](https://socket.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [42 API Documentation](https://api.intra.42.fr/apidoc)
- [Passport.js Documentation](https://www.passportjs.org/docs)
- [i18next Documentation](https://www.i18next.com)
- [Docker Compose Documentation](https://docs.docker.com/compose)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21)
- [GDPR Developer Guide](https://gdpr.eu/developers)

### Articles & References
- [WebSocket vs HTTP — When to use each](https://ably.com/topic/websockets-vs-http)
- [JWT Best Practices](https://curity.io/resources/learn/jwt-best-practices)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [OAuth 2.0 Explained](https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2)
- [Microservices vs Monolith](https://martinfowler.com/articles/microservices.html)

### AI Usage

AI tools (primarily Claude) were used throughout this project in the following ways:

| Task | How AI was used |
|---|---|
| Architecture planning | Discussing module structure, feature ordering, and dependency mapping |
| Boilerplate generation | Generating initial NestJS module skeletons, Prisma schema drafts, and Docker Compose configuration as starting points — reviewed and modified before use |
| Debugging | Explaining error messages and suggesting fixes, always verified by the team member before applying |
| Documentation | Drafting sections of this README as a starting point, then rewritten by the team |
| Code review assist | Asking AI to identify potential issues in code before peer review — not a replacement for human review |
| Learning | Explaining unfamiliar concepts (WebSocket lifecycle, OAuth flow, Prisma relations) to fill knowledge gaps |

All AI-generated content was reviewed, understood, and validated by the team member responsible for that part of the project before being committed. No code was blindly copy-pasted. Every team member can explain every line they committed.

---

## Known Limitations

> Populated during development.

- [ ] To be documented

## License

This project was built as part of the 42 school curriculum. No commercial license.

---

<div align="center">
<sub>Built with ☕ and too many <code>git rebase</code>s</sub>
</div>
