# Account interface

React interface for registration, login, Discord authentication and linking,
profile editing, avatar/banner uploads, and the public user directory.

## Run locally

Start the backend on port 3000, then from this directory:

```sh
npm ci
npm run dev
```

Optional: copy `.env.example` to `.env` and set `VITE_API_URL`. Vite variables
are public build-time configuration; never put private keys or client secrets here.

Use `http://localhost:5173` consistently. The backend allows this origin with
credentials. Configure `AUTH_FRONTEND_URL` there and register both Discord redirects:

- `http://localhost:3000/auth/discord/callback`
- `http://localhost:3000/auth/discord/link/callback`

## How it fits together

- `src/auth/AuthProvider.jsx` restores the session and owns account state.
- `src/lib/session.js` consumes OAuth fragments before React mounts, removes
  them from the URL, and replaces stale credentials with the newly issued pair.
- `src/lib/api-client.js` retries a protected request once after a 401. Concurrent
  requests share a refresh; Web Locks coordinate tabs when available. A failed
  or ambiguous refresh requires signing in again, avoiding reuse of a consumed token.
- `src/components/ProfileForm.jsx` submits only changed, allowed fields. Photo
  uploads save separately, so partial success does not masquerade as a full save.
- `src/lib/navigation.js` handles internal navigation and browser back/forward.

Logout clears the local session immediately and attempts server revocation. A
failed revocation is reported. Existing access tokens retain their backend-defined
expiry; logout does not revoke JWT signatures.

## Verification and deployment

```sh
npm test
npm run build
npm run preview
```

Serve the generated `dist` directory over HTTPS. Configure an SPA fallback to
`index.html` for frontend routes such as `/login`, `/register`, and `/account`;
keep API routes outside that fallback. Configure the backend CORS allowlist for
the real frontend origin if using separate origins.

This is an improved MVP interface, not a completed production security review.
Tokens still use localStorage and OAuth returns them in a URL fragment (removed
immediately). An HttpOnly-cookie or one-time-code handoff is a future hardening
step. Cross-tab refresh coordination requires Web Locks (HTTPS or localhost);
without it, only requests within a single tab are coordinated. If storage is
blocked, the session lasts only in memory. Never log credentials.

Dependencies and build output are ignored by Git. Reinstall with `npm ci` after
cloning. Automated tests cover session races and update payloads; live visual
browser verification was unavailable during this refactor.
