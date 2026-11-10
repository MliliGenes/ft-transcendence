# Web client

Next.js 16 App Router frontend with React 19, Tailwind CSS 4, Base UI primitives, TanStack Query, Socket.IO client and Tabler icons. Compose builds and serves it, and Nginx sends every non-API path to it.

Related documents: [client-backend integration](../integrations/client-backend.md) for sessions and gateway paths, and [feed integration](../integrations/feed.md).

Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/` before changing framework-level code. For example, error boundaries receive `retry`, and `cacheComponents` is enabled.

## Structure

| Path | Contents |
| --- | --- |
| `app/` | Routes, root layout, providers, root error, loading and 404 pages |
| `app/(auth)/` | Pages using the auth layout |
| `app/(app)/` | Pages inside `AppShell` |
| `components/auth/` | `AuthProvider`, forms, verification and OAuth return handling |
| `components/app/` | Shell, profile, search, settings, group management |
| `components/app/chat/` | Message list, message actions, markdown, emoji picker, details panels |
| `components/app/feed/` | Feed view, composer, post card, profile posts |
| `components/ui/` | Shared primitives |
| `lib/auth`, `lib/accounts`, `lib/social`, `lib/chat` | Typed API clients and helpers |
| `hooks/` | `useCurrentAccount`, media queries |
| `tests/` | Node test suites, including a design-token check |

## Routes

| Route | State |
| --- | --- |
| `/` | Landing page |
| `/login`, `/register` | Connected to user-service, with Discord and GitHub buttons |
| `/forgot-password`, `/reset-password` | Connected |
| `/verify-email` | Consumes the single-use token from the email link |
| `/privacy`, `/terms` | Static legal pages in the `(legal)` layout, linked from the landing footer and auth forms |
| `/feed` | Global feed with composer and post cards |
| `/search` | People search with filters and friend actions |
| `/chat` | DMs, groups, channels, presence, attachments, edit and delete |
| `/profile`, `/profile/[id]` | Profile, friends, blocks, status, Posts tab |
| `/profile/edit`, `/settings` | Profile fields, image cropping, status composer, account settings |
| `/play`, `/play/chess` | Coming soon |

## How data flows

- **API clients** call same-origin paths only: `/api/auth/*`, `/api/accounts/*`, `/api/social/*`, `/api/chat/*`.
- **`useAuth().requestWithSession`** runs a request with the current token and refreshes once on expiry.
- **TanStack Query** holds server state. Message lists are infinite queries keyed `["chat", "messages", userId, channelId]`. Profile posts use `["chat", "feed-posts", viewerId, userId]`.
- **`message-actions.tsx`** applies edits and deletes to both caches, so chat, feed and profile stay consistent.

## Chat workspace

`components/app/chat-workspace.tsx` owns the sidebar, selection, history, socket connection, composer and uploads. `chat/message-list.tsx` renders grouped messages with day dividers, and it renders images, videos and PDFs. New messages are merged into the query cache from `message:created`. Polling is the fallback: 30 seconds when connected and 5 seconds when not.

Attachments: up to 5 per message, images and PDFs up to 10 MB, MP4, WebM and MOV up to 50 MB.

## Profile and status

`public-profile.tsx` renders your own or someone else's profile. The status appears as a chip next to the avatar. `status-composer.tsx` is the editor, with an icon picker, a character counter and a live preview. Avatars and banners are cropped in the browser with `react-easy-crop` before upload.

## Design system

`NOOK_DESIGN_SYSTEM.json` is the visual source of truth, and a test checks it against `app/globals.css`. Update it first if the system changes. Use the existing tokens (`bg-card`, `text-muted-foreground`, `text-nook-accent-text`) and square, bordered surfaces. Themes are light, dark and system.

## Error and loading pages

| File | Purpose |
| --- | --- |
| `app/not-found.tsx`, `app/(app)/not-found.tsx` | 404, standalone or inside the shell |
| `app/error.tsx`, `app/(app)/error.tsx` | Route errors with retry |
| `app/global-error.tsx` | Root layout failure, with its own document |
| `app/loading.tsx`, `app/(app)/loading.tsx` | Route loading with the Nook logo |

`loading.tsx` covers route loading only. Client-side data fetching and session restore use each page's own skeletons.

## Commands

Run `npm run dev`, `npm run build`, `npm run lint` and `npm test` from `client/`. Under Compose, source changes need `docker compose up --build -d client`.

## Rules

- Keep access tokens in memory and refresh tokens in HTTP-only cookies. Never use local storage for them.
- Use relative `/api/...` paths so Nginx stays the single entry point.
- Client validation is feedback only. The services are authoritative.
- Never put secrets in `NEXT_PUBLIC_` variables.

## Current limitations

- Notifications in the app shell are sample data.
- Several settings sections are marked Soon.
- Play and Chess are placeholders.
- Most browser flows have only been checked by type checks, lint and unit tests.
