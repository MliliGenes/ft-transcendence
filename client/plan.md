# Nook client plan

This is the working progress tracker for the Nook web client. Update this file as implementation changes: check off work only after it is present and verified, revise the status table when a page changes, and refresh the review date.

**Last reviewed:** 2026-11-06  
**Current focus:** Profile/settings design and image editing implemented; verify the browser flow through Nginx, then connect search and chat.

## Product direction

Nook is a calm, dark social and gaming space for friends and interest groups. The agreed visual source of truth is [`NOOK_DESIGN_SYSTEM.json`](./NOOK_DESIGN_SYSTEM.json). The client uses Next.js App Router, Tabler icons, shared UI primitives, and the gateway's same-origin `/api` routes.

Profile/settings implementation reference: [PROFILE_DESIGN_SPEC.md](./PROFILE_DESIGN_SPEC.md), based on `NOOK_UI/profile/Nook User Settings Dark UI Grid.png`. Execution was approved. The implementation uses existing square-corner tokens and a fixed 3:1 banner crop matching the API; other crop presets remain deferred.

## Current state

| Area | Status | What works today |
| --- | --- | --- |
| Landing page (`/`) | UI complete | Responsive marketing page, shared logo, and image placeholders. |
| Login and registration | API connected; verify in running stack | Client validation and user-service requests; access token kept in memory; refresh token handled by an HTTP-only cookie. |
| App shell and notifications | Mixed | Shared navigation shows the signed-in account name/avatar with generated fallbacks; notification content is sample data. |
| Chat (`/chat`) | UI prototype | Discord-like layout with sample conversations and local-only message sending. |
| Search (`/search`) | UI prototype | Search view is present; results are not yet backed by the user service. |
| Feed (`/feed`) | Coming soon | Placeholder page. |
| Profile (`/profile`) | API connected | Banner and circular avatar, identity, connections, empty content states, and Edit profile link to settings; shared account query. |
| Play (`/play`) | Coming soon | Lists Chess and a future second game; Chess opens its own coming-soon view. |
| Settings (`/settings`) | Profile/API connected; browser verification pending | Reference-based window/rail, profile fields including email, account details, connection status, logout, crop/zoom uploads, and avatar/banner deletion. Security, notifications, appearance, and privacy are marked Soon; connection management is deferred. |
| Gateway routing | Configured | Nginx sends `/chat` to the client and `/api/chat/*` to the chat service. |

“UI prototype” means the view is implemented but its data or actions are not persisted through a backend. It does not imply that the underlying backend capability is missing.

## Milestones

### 1. Visual foundation and routes — complete

- [x] Establish the shared Nook color and component direction from the design-system JSON.
- [x] Add the reusable logo, Tabler icons, and shared input/button/label primitives.
- [x] Add generated Boring Avatars as shared fallbacks for profile imagery.
- [x] Build the landing, login, and registration views with image placeholders.
- [x] Add the shared app shell, notification dropdown, profile, search, feed placeholder, and chat prototype.
- [x] Give the client chat view the `/chat` route and keep chat-service routes under `/api/chat` in Nginx.
- [x] Add a Play catalog and a dedicated Chess coming-soon page.

### 2. Account session — in progress

- [x] Connect registration and login to `POST /api/auth/register` and `POST /api/auth/login`.
- [x] Keep access tokens in memory and let the browser manage the HTTP-only refresh cookie.
- [x] Add refresh and logout request helpers.
- [ ] Run a browser smoke check through Nginx for register, login, cookie refresh after reload, and error states.
- [x] Add a visible logout action in settings and show the authenticated user's actual name/avatar in the app shell.
- [ ] Connect the existing GitHub and Discord buttons to their OAuth redirect flows once provider configuration is available; handle callback errors and return users to the app.

**Acceptance:** a user can register or log in through the gateway, retain a session after reload, see their own identity in the shell, and log out with the refresh session revoked.

### 3. Real user data and social interactions — in progress

- [x] Replace example profile data with `GET /accounts/me`; save profile edits with `PATCH /accounts/me` and upload avatar/banner images.
- [x] Match the profile settings reference, add `react-easy-crop` with browser-canvas resizing (256x256 avatar, 1500x500 banner), and connect image deletion to the 204 endpoints.
- [ ] Verify desktop/mobile appearance, dialog focus, crop cancellation, image replacement/removal, and refresh/retry behavior in a real browser against the gateway.
- [ ] Connect people search and friend actions to the user service; represent loading, empty, and error states.
- [ ] Build the feed against the available feed/post API, or record the required backend contract if it does not exist yet.
- [ ] Replace sample notifications with the notification source and make read/unread state meaningful.

**Acceptance:** profile, people search, feed, and notifications show server-backed data and user actions survive navigation and reload.

### 4. Chat integration

- [ ] Replace sample conversations and messages with the chat-service API using `/api/chat`.
- [ ] Connect live message updates through `/api/chat/socket.io` and handle reconnects and expired sessions.
- [ ] Connect conversation selection, group creation, and message sending to persisted service actions.
- [ ] Keep direct message and group layouts usable on narrow screens as responsive design is finalized.

**Acceptance:** two signed-in users can exchange persisted messages and see new messages arrive without reloading.

### 5. Remaining app views and release checks

- [x] Implement the Settings route shown by the app navigation for profile editing, account details, and connected-account status.
- [ ] Replace remaining image and content placeholders when final assets/copy are available.
- [ ] Review keyboard navigation, focus states, accessible names, and narrow-screen layouts against the design system.
- [ ] Run lint, type checks, production build, and end-to-end checks for the main user journeys.

**Acceptance:** every visible navigation item leads to a usable page, and the main account, search, chat, and profile journeys pass in the deployed gateway setup.

## Working rules

Latest profile/settings checks: production build, TypeScript, lint, and focused Node tests. Browser automation is unavailable in this session, so visual and live gateway interaction checks remain pending. Run `npm test` for API-client/image processing regression checks; browser-canvas APIs are mocked in the resize unit tests.

- Keep visual decisions aligned with [`NOOK_DESIGN_SYSTEM.json`](./NOOK_DESIGN_SYSTEM.json); update that file first if the agreed system changes.
- Use relative `/api/...` browser requests so Nginx remains the single API entry point.
- Treat client-side validation as feedback only; the user service remains authoritative.
- Do not put access or refresh tokens in local storage. Keep access tokens in memory and refresh tokens in HTTP-only cookies.
- When a task is completed, update the relevant checklist and the **Last reviewed** date in this file.
- If progress depends on a missing backend capability, document the endpoint/contract needed instead of marking the frontend integration complete.
