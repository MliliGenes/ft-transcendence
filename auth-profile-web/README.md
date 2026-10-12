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
- `src/lib/session.js` keeps the access token in memory and removes legacy
  script-readable tokens from local storage. OAuth callbacks return without tokens in the URL.
- `src/lib/api-client.js` retries a protected request once after a 401. Concurrent
  requests share a refresh; Web Locks coordinate tabs when available. A failed
  or ambiguous refresh requires signing in again, avoiding reuse of a consumed token.
- `src/components/ProfileForm.jsx` submits only changed, allowed fields. Photo
  uploads save separately, so partial success does not masquerade as a full save.
- `src/lib/navigation.js` handles internal navigation and browser back/forward.

The refresh token stays in an HttpOnly cookie. The access token stays in memory,
so a page reload restores the session through `/auth/refresh`. Logout clears the
local session immediately and attempts server revocation. A failed revocation is
reported. Existing access tokens retain their backend-defined expiry; logout
does not revoke JWT signatures.

## Verification and deployment

The account page includes a **Friends & blocks** endpoint tester. Copy a user
UUID from **People here** to send a request or block/unblock them. Incoming
requests support accept/reject; sent requests support cancellation. Friends,
incoming requests, sent requests, and blocked users reload after each successful
action. Use **Refresh lists** after taking an action in another browser/account.
API errors and the last successful action's JSON response are displayed.

To test both sides, sign in to two accounts in separate browser profiles. Send
a request, refresh the recipient's lists, accept it, then refresh the sender's
lists. Block the friend and check that the friendship disappears and the blocked
user appears; unblock them to clear the block. Also try rejecting and cancelling
requests. The friends endpoint returns user IDs only, so deleting an accepted or
declined friendship uses the manual **Friendship ID to delete** field; copy that
ID from the request or action response first.

```sh
npm test
npm run build
npm run preview
```

Serve the generated `dist` directory over HTTPS. Configure an SPA fallback to
`index.html` for frontend routes such as `/login`, `/register`, and `/account`;
keep API routes outside that fallback. Configure the backend CORS allowlist for
the real frontend origin if using separate origins.

Dependencies and build output are ignored by Git. Reinstall with `npm ci` after
cloning. Automated tests cover session races and update payloads; live visual
browser verification was unavailable during this refactor.
