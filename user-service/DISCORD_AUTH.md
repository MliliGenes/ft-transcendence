# Discord OAuth Strategy: Login and Linking Explained

Notes on the hand-rolled `DiscordStrategy` (NestJS + Prisma). It implements the OAuth 2.0 **authorization code flow** directly, without Passport.

The strategy never logs anyone in by itself. It only proves: *"this browser really completed a Discord login, and here is the Discord profile."* The controller then decides what to do (issue a JWT, create a user, store a link).

---

## 1. The core idea

Your app never sees the user's Discord password.

1. You send the browser to Discord.
2. Discord sends it back with a one-time `code`.
3. Your server swaps the code for an access token (server to server).
4. Your server uses the token to read the profile.

Most of the code exists to stop attackers from abusing the redirect.

---

## 2. The two secrets

`begin()` generates two random values (32 bytes each, base64url, always 43 characters):

| Secret | Where it travels | Purpose |
|---|---|---|
| `state` | In the URL, through Discord, echoed back on the callback | Says "this callback belongs to a flow we started" |
| `browser` | In an `httpOnly` cookie, never sent to Discord | Says "and it's *this* browser that started it" |

Only the **SHA-256 hashes** are stored in the `oAuthState` table, so a DB leak gives an attacker nothing usable.

**Why both?** `state` travels through the URL, so it can leak or be embedded in a link an attacker sends. An attacker can hand a victim a callback URL with a valid `state`, but cannot plant your httpOnly cookie in the victim's browser.

Both secrets serve your security. `state` rides the public route; the cookie stays private between browser and your API.

### Cookie properties

- `httpOnly`: JavaScript can't read it.
- `sameSite: 'lax'`: still sent on the top-level redirect back from Discord.
- `secure`: set when the redirect URI is HTTPS.
- `path: '/auth/discord'`: not sent to the rest of your API.
- `maxAge`: 10 minutes, matching the DB row expiry.

---

## 3. Login flow

```
Browser            Your API                 Discord
   | GET /auth/discord  |                      |
   |------------------->| begin('LOGIN')       |
   |                    | - make state+browser |
   |                    | - save hashes in DB  |
   |<-------------------| set cookie + URL     |
   | redirect --------------------------------->| user approves
   |<--------------------------------- ?code&state
   | GET /callback (cookie sent automatically)   |
   |------------------->| complete('LOGIN')    |
   |                    | verify + consume state
   |                    |--- POST /token ----->|
   |                    |<-- access_token -----|
   |                    |--- GET /users/@me -->|
   |                    |<-- profile ----------|
   |<-------------------| profile -> controller|
```

### Phase 1: `authorize()` → `begin()`

1. `settings()` validates env config (503 if missing or insecure).
2. Generate `state` and `browser`.
3. Delete expired state rows (opportunistic cleanup).
4. Store a row: both hashes, 10-minute expiry, `purpose`, `userId` (null for login).
5. Set the cookie.
6. Build the Discord authorize URL and return it; the controller redirects.

Scopes: login asks for `identify email`; link asks only for `identify`.

### Phase 2: `authenticate()` → `complete()`

A series of gates:

1. **Cookie extraction.** Parse the header by hand; require *exactly one* cookie with the expected name (rejects duplicates / cookie injection). Clear it immediately so it is single-use.
2. **Format check.** `state` and `browser` must both match the 43-char base64url shape. Rejects garbage before touching the DB.
3. **Lookup by `hash(state)`.** Check `purpose` matches. `LINK` requires a `userId`; `LOGIN` requires none. This prevents replaying a login state at the link callback, or the reverse.
4. **Atomic consume** (the key step):
   ```ts
   deleteMany({ where: { tokenHash, browserHash, expiresAt > now, purpose, userId } })
   if (count !== 1) reject
   ```
   One query checks the browser hash, expiry, purpose and owner, and deletes the row. If two requests race, exactly one gets `count === 1`. The state is truly single-use, even across multiple server instances. The earlier `findUnique` is only a peek; winning this delete is what authorizes.
5. **Error and code checks.** If Discord sent `?error=` (user cancelled), throw. `code` must be a non-empty string of sane length.
6. **Token exchange.** Server-to-server POST with the code and `client_secret`. Validate the response has a bearer `access_token`.
7. **Profile fetch.** `GET /users/@me` with the token. Validate: id is a 17–20 digit snowflake, username is sane.
8. **Normalization.** Truncate names to 50 chars, validate email with `isEmail`, build the avatar URL only if the hash matches a safe regex (`.gif` if it starts with `a_`), pass through `verified`.

---

## 4. Linking flow

Same machine, different `purpose`. Scenario: a user is already logged into your app and wants to attach their Discord account.

**The problem:** the callback is a redirect from Discord, so it carries no `Authorization` header with your JWT. How does it know which local account to attach to?

**The answer:** `authorizeLink(userId)` stores the `userId` *inside the state row*. The JWT guard validated that user when the flow began. On callback, `stored.userId` comes from your own DB, not from the query string, so an attacker can't change which account gets linked by editing the URL.

Link-specific details:

- **`FOR UPDATE` transaction.** Locks the user row, confirms the user still exists, then creates the state. Prevents creating a state pointing at an account being deleted at that moment.
- **Separate cookie name** (`discord_oauth_link_browser`) and **separate callback URL** (`/auth/discord/link/callback`, derived automatically unless `DISCORD_LINK_REDIRECT_URI` is set). A login flow and a link flow in the same browser can't clobber each other.
- **Attack the cookie stops:** an attacker starts a link flow with *their* Discord account, grabs the callback URL, and tricks a logged-in victim into opening it. Without the cookie binding, the victim's account would be linked to the attacker's Discord, letting the attacker log in as the victim. With it, the victim's browser lacks the matching secret and the consume step fails.

---

## 5. What happens on Discord's side

Your app is mostly a spectator here.

### Step 1: The browser lands on Discord

Discord validates the request before showing anything:

- `client_id` belongs to a real registered application.
- `redirect_uri` **exactly matches** a URI registered in the Developer Portal. If not, Discord shows an error and does **not** redirect, so codes can't be sent to an attacker's domain.
- `scope` is valid for your app.

### Step 2: Discord identifies the user

If not logged in, the user sees Discord's own login page (the password never touches your app). Then the consent screen shows your app name, icon, and the scopes in plain language.

### Step 3: The user clicks Authorize

Discord:

1. Records a **grant** (this user authorized this app with these scopes). This shows up in the user's authorized-apps settings, where they can revoke it.
2. Generates a short-lived, single-use **authorization code**, bound to the user, your `client_id`, the scopes, and the exact `redirect_uri`.

Then it 302-redirects to `redirect_uri?code=XXXX&state=YYYY`. The `state` is echoed verbatim without being interpreted. On Cancel, the redirect carries `error=access_denied` plus `state`.

### Step 4: Your server redeems the code

Discord checks:

- `client_id` and `client_secret` are correct.
- The code exists, is unused, and is unexpired.
- `redirect_uri` is identical to the one from step 1.

On success it marks the code consumed and returns an `access_token` (plus a refresh token you ignore, since you only need the profile once). A stolen `code` is nearly worthless alone because redeeming it needs your `client_secret`.

### Step 5: Your server reads the profile

`GET /users/@me` returns only what the token's scopes allow:

- `identify`: id, username, global name, avatar.
- `email`: adds `email` and `verified`.

If you only requested `identify`, `profile.email` is missing, which is why the code treats it as nullable.

> If a user already authorized your app with the same scopes, Discord may shortcut the consent screen later, depending on the `prompt` parameter. This code doesn't set it, so the default applies.

---

## 6. Supporting pieces

- **`settings()`**: validates config; redirect URI must be HTTPS (HTTP only on localhost), with no credentials, hash or query; HTTPS required in production.
- **`discordJson()`**: 10-second timeout and `redirect: 'error'` (never follows redirects, closing off SSRF-style tricks). Maps 400/401/403 to a 401 for your client; network errors and 5xx to 502.
- **`record()`**: type guard. Discord's JSON is `unknown`, so it is validated at runtime rather than trusted.

---

## 7. What the controller must still do

The strategy returns a profile. The controller does the rest:

- **Login / register** (same endpoint, since Discord can't tell you in advance whether this person has an account): look up a user by `profile.id` (the Discord ID, not email or username, which can change). If found, issue your JWT; if not, create the user, then issue the JWT.
- **Link:** store `profile.id` against the `userId` from the state row, and ensure that Discord ID isn't already linked to a different account.
- **Email caution:** only trust `profile.email` if `profile.verified` is true. Auto-merging accounts by an unverified email is an account-takeover hole.

---

## 8. Failure cases (test your understanding)

| Situation | Why it's rejected |
|---|---|
| Attacker sends victim a callback URL with a valid `state` | Victim's browser has no matching cookie, so `browserHash` doesn't match and the delete removes nothing |
| Victim opens the same callback twice (back button, double click) | First request deletes the row and clears the cookie; the second finds nothing |
| User waits 15 minutes on Discord's consent screen | Cookie `maxAge` and row `expiresAt` have both lapsed; flow must restart |
| Login state replayed at the link callback | `purpose` mismatch (and `userId` null vs required) |
| Attacker edits the callback URL to target another account | Account comes from `stored.userId` in the DB, not the URL |
| Two simultaneous requests with the same state | Only one `deleteMany` returns `count === 1` |

---

## 9. Mental model

- **`state`** says "this callback belongs to a flow we started."
- **The cookie** says "and it's this browser that started it."
- **The DB row** ties the two together; the atomic delete succeeds only if both match the *same* row, within expiry, with the right purpose and owner.
- **Discord** never learns anything about your sessions, cookies or JWTs. It only knows a user said yes to an app and it issued a code.
- **Only after** the state is consumed does the server-to-server exchange happen (code → token → profile), and only then does the controller decide: login, register, or link.