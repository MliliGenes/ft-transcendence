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
- `src/lib/api-client.js` shares one refresh after a 401. A selected GET or HEAD
  can retry once with `retrySafeRead: true`. A mutation is never sent again.
  Network failures retain the session. Confirmed expiry clears it. Web Locks
  coordinate cookie changes across tabs.
- `src/components/ProfileForm.jsx` submits only changed, allowed fields. Photo
  uploads save separately, so partial success does not masquerade as a full save.
- `src/lib/navigation.js` handles internal navigation and browser back/forward.

The refresh token stays in an HttpOnly cookie. The access token stays in memory,
so a page reload restores the session through `/auth/refresh`. Logout clears the
local session immediately and attempts server revocation. A failed revocation is
reported. A persistent marker with no credentials blocks restore after failed
logout, including reload and entry to Play. A later deliberate sign-in can replace
that marker. Existing access tokens retain their backend expiry; logout does not
revoke JWT signatures.

The account page follows verified sign-in and sign-out from other tabs. It clears
the old profile while the replacement account is verified. Dev and production
proxies keep the refresh cookie at `/api/auth/`. The service clears old HttpOnly
root cookies through `Set-Cookie`; JavaScript cannot delete them.

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
cloning. Automated tests cover session races, narrow dev cookies and update payloads.
The browser regressions in `frontend/e2e/account-auth-repairs.spec.ts` exercise
the actual account App with mocked HTTP. They require an account web fixture via
`E2E_ACCOUNT_WEB_URL`. Real HTTPS service proof is a separate repair-plan gate.
