# Admin panel integration

The existing Nook admin layout is now available at `/admin` in the team account frontend. The original `gamechat/` application remains a separate mock preview. This folder was copied from the supplied main-branch ZIP; backend and infrastructure folders were not copied into this checkout.

## What is connected

- Shared `AuthProvider` and API client: access token in memory, refresh via HttpOnly cookie, existing login/logout and session renewal. No second login form or pasted-token UI.
- Superadmins get an Admin panel button on their account page. Anonymous visitors to `/admin` use the existing login route. Ordinary accounts see an access-denied message. Server role checks remain authoritative on every admin request.
- Dashboard totals and rolling 7/30-day registration bars use `/superadmin/stats`. The API has no daily registration series, so no daily trend is invented.
- Directory search, role/date filters, sorting, and pagination are performed by the server. Final-day filters use `23:59:59.999Z` for an inclusive UTC day. Stale requests are cancelled.
- Details are fetched by ID when opened. Create sends only username/email/password/role. Profile edits send only changed allowed profile fields. Role changes use the separate role endpoint. Delete uses the guarded superadmin endpoint. Backend duplicate, validation, permission, and last-admin errors are shown to the user.
- Saves are awaited; controls are disabled during submission. Success appears only after the API responds. Self edits update the shared account state; self-demotion removes the admin view; self-deletion signs out.
- The removed stored `status` field is not displayed or sent.

## Run with the real backend

In the team's main checkout, use this updated `auth-profile-web/` directory with its existing root Compose setup, ignored env files, user service and database. Set `VITE_API_URL=/api` in `envs/auth-profile-web.env`, then rebuild the frontend container:

```sh
docker compose up --build -d auth-profile-web
```

Open `https://localhost`, sign in through the existing account screen with a superadmin account, then select Admin panel. No credentials are included in this integration. This workspace does not contain the main checkout's Compose/backend files or local secrets.

For Vite development against an already-running Docker gateway, copy `.env.example` to `.env`, then run `npm ci` and `npm run dev -- --port 5174`. The example targets `https://localhost/api` through the development proxy. `API_PROXY_ALLOW_SELF_SIGNED=true` is only for this local self-signed gateway; leave it unset for publicly trusted certificates. Use the Docker HTTPS origin for reliable Secure-cookie login and OAuth testing. Direct Vite development on HTTP may require cookie/origin adjustments appropriate to the backend; no security settings are changed automatically.

If running user-service directly on port 3000 instead, set `API_PROXY_TARGET=http://localhost:3000`, omit `API_PROXY_PREFIX`, and keep `VITE_API_URL=/api`.

## Verification

```sh
npm test
npm run build
```

The ZIP's original session tests imported a removed `TOKEN_KEY` and assumed local-storage refresh tokens. They were updated to the source's existing in-memory access-token and cookie-refresh contract. Tests cover refresh concurrency, logout races, API error handling, and strict admin payloads/query parameters.

Browser checks use a temporary API fixture outside this project. Fixture data is not part of the app, and there is no production mock fallback. Live user-service testing still requires the team's actual Docker stack and a superadmin login. A successful build or fixture test is not proof that the real database integration was exercised.
