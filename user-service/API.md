# User Service API

Base URL: `http://localhost:3000`

Request bodies use JSON, except image uploads which use multipart/form-data. The service rejects unknown body fields and returns `400 Bad Request` for invalid input.

## Authentication

Successful registration, login, Discord callback, and refresh responses return an access/refresh token pair:

```json
{
  "user": {
    "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
    "email": "user@example.com",
    "username": "player1"
  },
  "accessToken": "<JWT>",
  "refreshToken": "<refresh-id>.<refresh-secret>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresIn": 604800
}
```

- Access tokens are RS256 JWTs and expire after 15 minutes.
- Send access tokens as `Authorization: Bearer <accessToken>`.
- Refresh tokens expire after 7 days and are rotated after every successful refresh.
- The client must replace both stored tokens after refresh. Each replacement has a new seven-day lifetime.
- Reusing a revoked, unexpired refresh token revokes the remaining refresh tokens in that login session; other login sessions remain active. Coordinate concurrent refresh attempts in the client.
- Logout revokes all refresh tokens in the submitted token's login session. The current access token remains valid until it expires.

## Endpoints

### Register

`POST /auth/register`

Request:

```json
{
  "username": "player1",
  "email": "user@example.com",
  "password": "correct horse battery staple"
}
```

Validation:

- `username`: 3-30 characters
- `email`: valid email address
- New registrations always receive `USER`. A supplied `role` is rejected with 400.
- `password`: 8-32 characters and no more than 72 UTF-8 bytes

Responses:

- `201 Created`: user and token pair
- `400 Bad Request`: invalid body
- `409 Conflict`: email or username is already in use

### Login

`POST /auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "correct horse battery staple"
}
```

Responses:

- `200 OK`: user and token pair
- `400 Bad Request`: invalid body
- `401 Unauthorized`: invalid credentials

### Discord Login

`GET /auth/discord` starts authorization with a `302` redirect to Discord.

`GET /auth/discord/callback` receives Discord's authorization code and state,
checks the temporary browser cookie, and returns the user and token pair with
`200 OK` for JSON clients. Browser requests accepting `text/html` redirect to
`AUTH_FRONTEND_URL` (default `http://localhost:5173`) with our tokens in the URL
fragment. Neither endpoint requires an existing application access token or a
JSON body. Start the flow in a browser; Discord supplies the callback parameters.

See [Discord OAuth login](#discord-oauth-login) for configuration, account rules,
and error responses, or [the strategy walkthrough](DISCORD_AUTH.md) for a
step-by-step explanation of the implementation.

### Link Discord to the signed-in account

`POST /auth/discord/link` requires `Authorization: Bearer <accessToken>` and no
body. It returns `200` with `{ "authorizationUrl": "https://discord.com/oauth2/authorize?..." }`
and sets a temporary HttpOnly browser cookie. Navigate to that URL in the same
browser. The account comes only from the validated access token.

`GET /auth/discord/link/callback` receives Discord's `code` and `state`. It does
not require a Bearer header: the single-use state and browser cookie bind the
callback to the user who started linking. It returns `200` JSON:

```json
{ "provider": "DISCORD", "providerUserId": "123456789012345678" }
```

Browser login and linking failures redirect to the frontend with safe
`oauthError` and `oauthFlow` fragment values for display. JSON requests retain
their normal error status and body.

For browser requests accepting `text/html`, success redirects to
`AUTH_FRONTEND_URL#providerLinked=discord`. Linking issues no new tokens; keep the
existing local session. It preserves email, verification, username, password,
role, and avatar. Discord email does not need to match the local email or be
verified because this flow attaches a proven provider identity to an already
authenticated local account. It requests only Discord's `identify` scope.

- `401`: missing/invalid access token at start, deleted local account, or invalid,
  expired, mismatched, denied, or reused callback authorization.
- `409`: Discord belongs to another user, or the current user already linked a
  different Discord account. Each user can have one identity per provider.
- Linking the same identity again with a fresh authorization is idempotent.
- `502` / `503`: provider failure / configuration error, as with Discord login.

`DELETE /auth/discord/link` requires `Authorization: Bearer <accessToken>` and
returns `204 No Content`. It removes the Discord identity from the current
account. A passwordless account cannot unlink its only provider until it sets a
password or connects another sign-in method.

Register **both** callback URLs in the Discord developer portal. Then run
`npx prisma migrate deploy` and `npx prisma generate` before restarting the service.
The migration adds the linking state owner/purpose and provider uniqueness constraint.

Start linking from the frontend with a request, then a browser navigation:

```js
const response = await fetch(`${API_URL}/auth/discord/link`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  credentials: 'include', // Save the temporary linking cookie across the ports.
});
const result = await response.json();
if (!response.ok) throw new Error(result.message);
window.location.assign(result.authorizationUrl);
```

Use the same hostname for frontend, API, and callbacks during local testing
(all `localhost`, or all `127.0.0.1`). The API allows credentialed requests from
the two configured Vite origins. Do not put an access token or local user ID in
the authorization URL. Login and linking have separate cookies and purposes;
their callbacks are not interchangeable. Each purpose permits only the latest
attempt started in that browser to complete.

### Refresh Tokens

`POST /auth/refresh`

No access token is required. Send the refresh token in the body:

```json
{
  "refreshToken": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc.<43-character-base64url-secret>"
}
```

A successful request revokes the submitted refresh token, creates a new refresh token, and returns a new token pair.

Responses:

- `200 OK`: new user and token pair
- `400 Bad Request`: malformed body or token
- `401 Unauthorized`: unknown, expired, revoked, or incorrect refresh token

### Logout

`POST /auth/logout`

Send the refresh token that should be revoked:

```json
{
  "refreshToken": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc.<43-character-base64url-secret>"
}
```

The endpoint returns success without revealing whether the token was already invalid. The client should discard both the access and refresh tokens locally.

Responses:

- `204 No Content`: logout request accepted
- `400 Bad Request`: malformed body or token

### List Users

`GET /accounts?page=1&limit=10`

Public endpoint; no access token required.

Pagination parameters:

- `page`: integer from 1 to 1,000,000; defaults to `1`
- `limit`: integer from 1 to 100; defaults to `10`

Response (`200 OK`):

```json
{
  "users": [
    {
      "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
      "username": "player1",
      "displayName": "Player One",
      "avatarUrl": null,
      "bannerUrl": null,
      "status": "OFFLINE",
      "createdAt": "2026-09-29T12:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

Invalid query parameters return `400 Bad Request`.

### Current Account

`GET /accounts/me`

Requires an access token:

```http
Authorization: Bearer <accessToken>
```

Response (`200 OK`):

```json
{
  "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
  "email": "user@example.com",
  "username": "player1",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "displayName": "Ada",
  "avatarUrl": "/accounts/2f1c2d1e-3c5a-4d6a-8b1c-123456789abc/avatar",
  "bannerUrl": null,
  "status": "OFFLINE",
  "emailVerifiedAt": null,
  "createdAt": "2026-09-29T12:00:00.000Z",
  "updatedAt": "2026-09-29T12:00:00.000Z"
}
```

Other responses:

- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: authenticated user no longer exists

### Update Current Account

`PATCH /accounts/me`

Requires an access token. Send only the fields to change; omitted fields remain unchanged. `firstName`, `lastName`, and `displayName` can be cleared with `null`.

Request:

```json
{
  "username": "new-player-name",
  "email": "new@example.com",
  "firstName": "Ada",
  "lastName": null,
  "displayName": "Ada"
}
```

Validation:

- `username`: optional, 3-30 characters
- `email`: optional, valid email address
- `firstName`, `lastName`, `displayName`: optional string or `null`, 1-50 characters when present
- At least one field must be provided.
- Role, image URLs, password, status, verification fields, and IDs cannot be changed here. Unknown fields are rejected even when included alongside valid fields. The target account comes from the verified JWT, not the body.

Supplying a different email clears `emailVerifiedAt`. Sending the same email, or omitting it, preserves verification. Both self-service and admin updates follow this rule. Email verification itself is not implemented or enforced yet; login immediately uses the updated address.

Responses:

- `200 OK`: updated private account
- `400 Bad Request`: invalid, empty, or protected-field body
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: account does not exist
- `409 Conflict`: email or username is already in use

### Delete Current Account

`DELETE /accounts/me`

Requires an access token. Deletes the account and its refresh tokens and linked authentication providers. Images, two-factor settings, and recovery codes are also deleted through database cascades. Superadmins must use the superadmin deletion endpoint instead (403 here).

Responses:

- `204 No Content`: account deleted
- `403 Forbidden`: superadmin attempting self-service deletion
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: account does not exist

### Upload Avatar

`PUT /accounts/me/avatar`

Requires an access token. Use `multipart/form-data` with exactly one file field named `file`.

```bash
curl -X PUT http://localhost:3000/accounts/me/avatar \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@avatar.png"
```

Accepted input formats are JPEG, PNG, and WebP. Animated images are rejected. Input is limited to 1 MiB and 20 megapixels. Images are auto-oriented, center-cropped/resized to `256x256`, and converted to WebP. The stored result is also capped at 1 MiB. Uploading again replaces the avatar.

Response (`200 OK`): updated private account.

Other responses:

- `400 Bad Request`: missing, malformed, unsupported, animated, or over-pixel-limit image
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: account does not exist
- `413 Payload Too Large`: upload or processed image exceeds 1 MiB

### Upload Banner

`PUT /accounts/me/banner`

Requires an access token. Use the same multipart format as avatar upload, with a file field named `file`.

Input is limited to 5 MiB and 20 megapixels. Images are center-cropped/resized to `1500x500` and converted to WebP. The stored result is also capped at 5 MiB. Uploading again replaces the banner.

Response (`200 OK`): updated private account.

Other responses are the same as avatar upload, with `413 Payload Too Large` applying to the 5 MiB banner limit.

### Public Avatar Image

`GET /accounts/:id/avatar`

Public endpoint; no access token is required. `:id` must be a UUID.

Returns the stored image bytes with `Content-Type: image/webp`, `Content-Disposition: inline`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`.

Responses:

- `200 OK`: image bytes
- `400 Bad Request`: invalid UUID
- `404 Not Found`: image does not exist

### Public Banner Image

`GET /accounts/:id/banner`

Public endpoint with the same behavior and response headers as the avatar route.

Responses:

- `200 OK`: image bytes
- `400 Bad Request`: invalid UUID
- `404 Not Found`: image does not exist

### User by ID

`GET /accounts/:id`

`:id` must be a UUID.

Public endpoint. Response (`200 OK`): the same public profile fields as each entry in `GET /accounts`: `id`, `username`, `displayName`, `avatarUrl`, `bannerUrl`, `status`, and `createdAt`. Email, first/last names, verification fields, timestamps other than `createdAt`, and authentication data are excluded.

Other responses:

- `400 Bad Request`: invalid UUID
- `404 Not Found`: user does not exist

The former `/auth/users`, `/auth/user/:id`, and `/auth/user/me` routes have been removed. Auth exposes register, login, refresh, logout, and Discord OAuth login/link flows.

## Example Flow

```bash
# Register or login and save the returned accessToken and refreshToken.
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"correct horse battery staple"}'

# Refresh. Replace both tokens with the pair returned by this request.
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-id>.<refresh-secret>"}'

# Access a protected endpoint.
curl http://localhost:3000/accounts/me \
  -H "Authorization: Bearer <accessToken>"

# Upload an avatar.
curl -X PUT http://localhost:3000/accounts/me/avatar \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@avatar.png"

# Logout using the current refresh token.
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-id>.<refresh-secret>"}'
```

## Discord OAuth login

| Method | Endpoint               | Purpose                                                     |
| ------ | ---------------------- | ----------------------------------------------------------- |
| GET    | /auth/discord          | Start Discord authorization (302 redirect)                  |
| GET    | /auth/discord/callback | Validate callback, log in/register, return token JSON (200) |
| POST   | /auth/discord/link | Start linking for the authenticated user (200 URL JSON) |
| GET    | /auth/discord/link/callback | Complete linking (200 JSON or 302 frontend redirect) |

GitHub exposes the same login and linking routes under `/auth/github`. Its
callback obtains the user's primary verified email through GitHub's `user:email`
scope before creating or linking a local account. `DELETE /auth/github/link`
removes the linked GitHub identity and, like Discord, refuses to remove the
user's only sign-in method unless a password or another provider is available.

### Application setup

Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
Under OAuth2, register both development redirect URIs:

```text
http://localhost:3000/auth/discord/callback
http://localhost:3000/auth/discord/link/callback
```

Fill the placeholders in the local ignored .env file, then restart the service:

```dotenv
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
DISCORD_LINK_REDIRECT_URI=http://localhost:3000/auth/discord/link/callback
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback
GITHUB_LINK_REDIRECT_URI=http://localhost:3000/auth/github/link/callback
AUTH_FRONTEND_URL=http://localhost:5173
```

The client secret stays on the backend. HTTPS is required for production;
HTTP is permitted only on loopback hosts during development. An incomplete
configuration makes the Discord routes return 503 without disabling local login.
Use the same hostname to start and finish the flow; localhost and 127.0.0.1 do
not share cookies. Apply migrations and regenerate Prisma when checking out this
change: the OAuthState table and linking migration are required. If
`DISCORD_LINK_REDIRECT_URI` is omitted, it defaults to `/auth/discord/link/callback`
on the origin of `DISCORD_REDIRECT_URI`.

### Browser flow

1. Open http://localhost:3000/auth/discord in a browser.
2. The service saves hashes of a random state and browser secret, sets a ten-minute
   HttpOnly/SameSite=Lax cookie, and redirects to Discord with identify/email scopes.
3. Discord redirects back with a code and state. The service checks the browser
   cookie and atomically consumes the unexpired state record before exchanging the code.
4. The strategy exchanges the code and fetches Discord's user profile. Provider
   errors and secrets are not forwarded to the browser.
5. The callback returns our usual user/accessToken/refreshToken/tokenType/expiresIn/
   refreshExpiresIn JSON. Use those tokens with existing protected, refresh, and
   logout endpoints. For requests accepting `text/html`, the service instead
   redirects to the frontend with accessToken/refreshToken in its URL fragment.

The testing frontend reads those tokens and removes the fragment. Fragments are
readable by page JavaScript; they are not encryption or a secure token store.
Begin in the same browser that receives the callback; a copied callback URL in
Postman will lack the browser cookie. Only the latest started flow in one browser
can complete; start again after cancellation, expiry, failure, or a lost callback
response. The state is consumed once and expires after ten minutes; expired rows
are cleaned when new authorizations start. A Secure cookie is used with HTTPS.

### Local account rules

- A linked Discord ID logs in to its existing local account even if Discord's
  email changes. Existing username, email, role, and verification are preserved.
- A new identity requires a valid email that Discord reports as verified. The new
  local account starts with role USER, no password, and emailVerifiedAt set from
  that verified provider response. Local username is a sanitized Discord name
  plus a random suffix; it can be edited later. Display name is copied on signup.
- The user, DISCORD provider record, and initial refresh session are saved together.
- An email already used by another local account returns 409, including case-only
  matches. No automatic account linking or merging occurs.
- Explicit linking uses the protected POST and separate callback documented above.
- Discord access/refresh tokens are not persisted or returned. Discord login sets
  avatarUrl from Discord's CDN when available. Returning logins fill it only when
  the account has no avatar URL; existing avatar URLs are preserved.
  Linking preserves the current avatar. Banner images are not imported.

Errors: 401 for invalid/expired/reused state, denied authorization, rejected code,
or a new user without a verified Discord email; 409 for an account conflict;
502 for Discord outages or malformed responses; 503 for missing/invalid configuration.
All responses use no-store and no-referrer policies.

The implementation follows Discord's [authorization-code flow and state guidance](https://docs.discord.com/developers/topics/oauth2).

## Superadmin API

Every endpoint requires `Authorization: Bearer <accessToken>` and the current
`SUPERADMIN` database role. Missing/invalid credentials return 401; ordinary
users receive 403. Responses use `Cache-Control: no-store`.

| Method | Endpoint                     | Action                            |
| ------ | ---------------------------- | --------------------------------- |
| GET    | `/superadmin/stats`          | Dashboard counters                |
| GET    | `/superadmin/users`          | Filtered, sorted, paginated users |
| GET    | `/superadmin/users/:id`      | User details                      |
| POST   | `/superadmin/users`          | Create a user (201)               |
| PATCH  | `/superadmin/users/:id`      | Edit allowed profile fields       |
| PATCH  | `/superadmin/users/:id/role` | Change role                       |
| DELETE | `/superadmin/users/:id`      | Permanently delete user (204)     |

Stats return `totalUsers`, `regularUsers`, `superadmins`, `newUsersLast7Days`,
`newUsersLast30Days`, and `asOf`. Registration counts use rolling 7/30-day windows
ending at `asOf`, counting currently existing accounts. They are not login/activity
counts. Ban statistics and live presence are not implemented.

### Search and filters

Example:

```http
GET /superadmin/users?search=alex&role=USER&sortBy=username&sortOrder=asc&page=1&limit=20
```

- `search`: up to 100 characters; case-insensitive substring of username, email,
  or display name. Send plain text, not surrounding `%` characters. User-supplied
  `%`, `_`, and backslashes are escaped to match literally.
- `role`: `USER` or `SUPERADMIN`.
- `createdFrom`, `createdTo`: inclusive ISO date/time bounds. Date-only values
  mean midnight UTC; use full timestamps when including an entire final day.
  Reversed ranges return 400.
- `sortBy`: `createdAt` (default), `updatedAt`, `username`, `email`, or `role`.
- `sortOrder`: `asc` or `desc` (default). User ID breaks ties consistently.
- `page`: 1-1,000,000 (default 1); `limit`: 1-100 (default 10).

Returns `{ users, total, page, limit, totalPages }`. The total uses the same
filters as the list. List entries and detail responses include id, username,
email, role, firstName, lastName, displayName, avatarUrl, bannerUrl, status,
emailVerifiedAt, createdAt, and updatedAt. Password hashes, tokens, image bytes,
and two-factor secrets are never included.

### Create, edit, and delete

Create body:

```json
{
  "username": "new_player",
  "email": "player@example.com",
  "password": "long-password",
  "role": "USER"
}
```

Role is optional and defaults to USER. Password validation matches registration.
Creation hashes the password but does not issue tokens or create a login session.

Profile PATCH accepts username, email, firstName, lastName, and displayName.
Omitted fields stay unchanged; optional names can be cleared with null. Email
changes clear verification, while resubmitting the same email preserves it.
Password, role, status, URLs, and verification timestamps are rejected here.

Role PATCH accepts `{ "role": "SUPERADMIN" }` or `{ "role": "USER" }`.
Duplicate email/username returns 409; invalid bodies/UUIDs return 400; a missing
user returns 404.

Deletion removes refresh tokens and provider records; images, two-factor settings,
and recovery codes cascade. The last superadmin cannot be deleted or demoted
(409). Admin mutations share a PostgreSQL transaction advisory lock so competing
requests cannot both remove the final admins; the caller's role is rechecked
inside that transaction. Superadmins must use this guarded deletion endpoint,
not `DELETE /accounts/me`, to preserve that protection.

No accounts are automatically promoted. To promote an existing testing account, run
`npm run bootstrap:superadmin -- existing-user@example.com` from the service directory.
The script reads the database settings from `.env`, preserves the password, and is
safe to rerun. Register the account first if it does not exist. The role guard
checks the database, so an existing valid access token works immediately. Ban/unban,
MQ notifications, and the admin dashboard frontend are deferred.

### Dashboard response example

`GET /superadmin/stats` returns 200:

```json
{
  "totalUsers": 12,
  "regularUsers": 11,
  "superadmins": 1,
  "newUsersLast7Days": 3,
  "newUsersLast30Days": 8,
  "asOf": "2026-09-29T12:00:00.000Z"
}
```

### User details and edit examples

`GET /superadmin/users/:id` returns the same full admin user shape as
list entries. Create, profile edit, and role edit also return this shape:

```json
{
  "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
  "username": "player1",
  "email": "user@example.com",
  "role": "USER",
  "firstName": "Ada",
  "lastName": null,
  "displayName": "Ada",
  "avatarUrl": null,
  "bannerUrl": null,
  "status": "OFFLINE",
  "emailVerifiedAt": null,
  "createdAt": "2026-09-29T12:00:00.000Z",
  "updatedAt": "2026-09-29T12:00:00.000Z"
}
```

Profile update (200):

```http
PATCH /superadmin/users/2f1c2d1e-3c5a-4d6a-8b1c-123456789abc
Authorization: Bearer <superadmin-access-token>
Content-Type: application/json

{"displayName":"New display name","lastName":null}
```

Role update (200):

```http
PATCH /superadmin/users/2f1c2d1e-3c5a-4d6a-8b1c-123456789abc/role
Authorization: Bearer <superadmin-access-token>
Content-Type: application/json

{"role":"SUPERADMIN"}
```

Delete uses the same user URL with DELETE and no body; success returns 204 with
an empty response. Deleting or demoting the last superadmin returns 409.
An admin may delete/demote themselves through these endpoints if another
superadmin remains. Subsequent admin requests check the current database role.
Private account responses and superadmin user responses include role.
Registration/login and public account responses do not.

### Testing the superadmin endpoints

1. Register a testing account using the normal registration endpoint.
2. Run `npm run bootstrap:superadmin -- existing-user@example.com` locally.
3. Use that account's valid access token in Postman's Bearer Token authorization.
4. Try GET stats, then search/list, then user details and edits.
5. Use a separate USER account to verify the admin endpoints return 403.

The bootstrap command changes only the role and update timestamp. It does not
create an account, reset a password, or issue tokens. It matches the supplied
email exactly after trimming surrounding spaces.

## Deferred behavior and current limitations

- Local email/password registration does not verify email ownership. It creates an active account
  immediately; a unique email can therefore be occupied by an unverified signup.
- Before public signup, implement expiring pending registrations, single-use email
  verification, and safe signup restart for the actual email owner with their own
  password. Do not activate a password selected by an unverified third party.
- Email-change password confirmation and verification are deferred. No verification,
  resend, pending-registration, or password-recovery endpoints exist yet.
- Ban/unban, API keys, MQ events, provider unlinking, and other OAuth providers are not implemented.
- Rate limiting is planned for the Nginx integration phase.
- JWTs remain cryptographically valid until expiry after logout or account deletion.
  This service's account reads fail for deleted users, but other services must
  enforce account deletion separately when MQ integration is added.
- Images are public and currently use no-store; there is no individual image
  deletion endpoint. Presence status is stored but not maintained by live tracking.

## Validation commands

- `npm run build` and `npm run lint`
- `npm run prisma:validate`
- `npm run test:auth`
- `npm run test:accounts`
- `npm run test:superadmin`
- `npm run test:discord` (mocked Discord responses and database; real JWT signing)
- `npm run test:discord:postgres` (real PostgreSQL linking races and constraints in a temporary schema)

These suites use mocked database access with real JWT/bcrypt/image processing.
The separate `npm run test:auth:postgres` needs a migrated test database; see
[test/README.md](test/README.md). The default `npm test` is still configured for
Vitest spec files and does not run these suites.
