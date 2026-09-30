# Understanding the Discord authentication strategy

The strategy handles the conversation with Discord: it sends the user there, checks the callback, and retrieves their Discord identity. Then `AuthService` uses that identity to create or log in our user and issue our own tokens.

Here, **strategy** is the name of an ordinary Nest injectable class. We implemented the OAuth authorization-code flow directly, without Passport. The controller explicitly calls its methods.

Read alongside:

- [Discord strategy](src/auth/strategies/discord.strategy.ts)
- [Discord controller](src/auth/discord.controller.ts)
- [Authentication service](src/auth/auth.service.ts)
- [API documentation and setup](API.md)

## The whole login flow

```text
Browser opens GET /auth/discord
    |
    v
Strategy saves a temporary login attempt and sets a browser cookie
    |
    v
Controller redirects the browser to Discord
    |
    v
User authorizes our application on Discord
    |
    v
Discord redirects the browser to /auth/discord/callback?code=...&state=...
    |
    v
Strategy checks and consumes the temporary login attempt
    |
    v
Backend exchanges the code for a Discord access token
    |
    v
Backend uses that token to fetch the Discord profile
    |
    v
AuthService finds or creates our user and issues our access/refresh tokens
```

The browser follows the redirects. Our backend makes the token exchange and profile requests directly to Discord.

## 1. Nest supplies the dependencies

```ts
constructor(
  private readonly config: ConfigService,
  private readonly prisma: PrismaService,
) {}
```

`@Injectable()` allows Nest to manage this class. Because it is registered as a provider in `AuthModule`, Nest creates it and supplies its dependencies:

- `ConfigService` reads the Discord configuration loaded from `.env`.
- `PrismaService` stores and checks temporary login attempts.

The private `settings()` method reads these variables:

| Variable | Purpose |
| --- | --- |
| `DISCORD_CLIENT_ID` | Identifies your application to Discord. |
| `DISCORD_CLIENT_SECRET` | Authenticates our backend when exchanging the authorization code. |
| `DISCORD_REDIRECT_URI` | Tells Discord where to send the browser afterward. |

It checks that the configuration exists and that the callback URL uses HTTPS. HTTP is allowed on localhost during development; production requires HTTPS. It also rejects callback URLs containing credentials, query parameters, or a fragment.

Missing or invalid configuration produces `503 Service Unavailable`. These checks happen when a Discord route is used, so leaving the Discord configuration empty does not prevent ordinary password login.

## 2. `authorize()` prepares the login attempt

This method runs when the browser visits `GET /auth/discord`.

First, it generates two independent random values:

```ts
const state = randomBytes(32).toString('base64url');
const browser = randomBytes(32).toString('base64url');
```

They have different jobs:

- **`state`** identifies this login attempt. We send it to Discord, which returns it in the callback.
- **`browser`** is a separate secret placed in a browser cookie. It ties the callback to the browser that started the attempt.

We store their hashes together in the database:

```ts
await this.prisma.oAuthState.create({
  data: {
    tokenHash: hash(state),
    browserHash: hash(browser),
    expiresAt: new Date(now.getTime() + STATE_TTL_MS),
  },
});
```

`STATE_TTL_MS` is ten minutes. `hash()` uses SHA-256:

```ts
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
```

Later, we hash the returned values and look for a matching row. We do not need to store the original values. These are random strings, not JWTs, and hashing is not encryption.

Before creating the row, the method deletes expired attempts with `deleteMany()`.

### The browser cookie

The method sets a cookie named `discord_oauth_browser` containing the browser secret. The cookie options mean:

| Option | Purpose |
| --- | --- |
| `httpOnly: true` | Page JavaScript cannot read the cookie. |
| `sameSite: 'lax'` | Allows the cookie on the normal top-level GET navigation back from Discord. |
| `secure` | Requires HTTPS when the configured callback uses HTTPS. |
| `path: '/auth/discord'` | Limits the request paths where the browser sends this cookie. |
| `maxAge` | Expires the cookie after ten minutes. |

This is a temporary login cookie. Our application access and refresh tokens are issued later.

### The authorization URL

Finally, the method builds a URL pointing to `https://discord.com/oauth2/authorize`, with these parameters:

```ts
{
  client_id: settings.clientId,
  redirect_uri: settings.redirectUri,
  response_type: 'code',
  scope: 'identify email',
  state,
}
```

`identify email` requests access to the user's identity and email. `response_type: 'code'` asks Discord to return an authorization code.

`URLSearchParams` formats and URL-encodes the parameters. The strategy returns the URL, and the controller redirects the browser there:

```ts
response.redirect(await this.discord.authorize(response));
```

## 3. `authenticate()` checks the callback

After authorization, Discord sends the browser back to an address resembling:

```text
/auth/discord/callback?code=...&state=...
```

The method reads the browser cookie and the query parameters. It clears the cookie because the attempt should be used once.

The cookie is read from `request.headers.cookie`. The code accepts exactly one cookie with the expected name. Its value uses a fixed alphabet, so this implementation does not require cookie-parser middleware.

This regular expression checks the format of `state` and the browser secret:

```ts
/^[A-Za-z0-9_-]{43}$/
```

It expects exactly 43 characters containing only letters, digits, underscores, or hyphens: the format produced by encoding our 32 random bytes as base64url.

**Matching the format does not prove the values are valid.** The database check does that:

```ts
const consumed = await this.prisma.oAuthState.deleteMany({
  where: {
    tokenHash: hash(state),
    browserHash: hash(browser),
    expiresAt: { gt: new Date() },
  },
});

if (consumed.count !== 1) {
  throw new UnauthorizedException(
    'Discord login state is invalid or expired; start again',
  );
}
```

This finds and deletes an attempt only when both hashes match and it has not expired. `gt` means "greater than": the expiry must be later than the current time.

### Why delete the row to validate it?

The deletion makes the attempt **single-use**. If two callbacks arrive with the same values, only one can delete the row successfully. The other gets a count of zero and is rejected.

Because checking and consuming happen in one database operation, there is no gap between a separate read and delete. This also works across multiple service containers sharing the database.

The state-and-cookie check helps prevent login CSRF: someone trying to make another browser finish a login that the attacker started. A callback URL alone is insufficient; it must match the secret in the initiating browser's cookie.

The method then rejects a Discord cancellation/error or a missing or invalid authorization code. Once an attempt is consumed, an error requires starting a new login attempt.

## 4. The backend exchanges the code for a Discord access token

The strategy makes a POST request to:

```text
https://discord.com/api/oauth2/token
```

It sends these fields as URL-encoded form data:

```ts
{
  grant_type: 'authorization_code',
  code,
  client_id: settings.clientId,
  client_secret: settings.clientSecret,
  redirect_uri: settings.redirectUri,
}
```

**This is where the client secret is used.** It travels from our backend to Discord over HTTPS. It is not included in the browser's authorization URL.

The authorization code represents the authorization just granted. Our backend exchanges it for a Discord access token, which permits the authorized API requests.

The strategy checks that the response contains a nonempty `access_token` and a `token_type` of Bearer.

## 5. The strategy fetches and validates the Discord profile

Using the Discord access token, the backend calls:

```text
GET https://discord.com/api/v10/users/@me
Authorization: Bearer <Discord access token>
```

It validates the response and returns a smaller object:

```ts
export type DiscordProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  verified: boolean;
};
```

The current checks and conversions are:

- The Discord ID must be a string containing 17–20 digits.
- The username must be a nonempty string of at most 100 characters.
- The display name uses `global_name`, falling back to the username, capped at 50 characters.
- Missing or invalid email becomes `null`.
- `verified` is true only when Discord explicitly returns the boolean `true`.

The `record()` helper first checks that a response is an object, rather than `null` or an array:

```ts
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
```

Its TypeScript return type helps us inspect the object's fields safely. Individual field checks are still necessary: external JSON does not automatically satisfy a TypeScript type.

The Discord access token is used to fetch this profile. Our code neither persists it nor returns it to the client.

## 6. `discordJson()` centralizes HTTP requests and errors

Both Discord requests use this helper. It applies:

- A ten-second timeout through `AbortSignal.timeout(10000)`.
- `redirect: 'error'`, which rejects unexpected HTTP redirects.
- Conversion of Discord `400`, `401`, and `403` responses into our `401 Unauthorized`.
- Conversion of network problems, other unsuccessful responses, and invalid JSON into `502 Bad Gateway`.

The helper returns parsed JSON as `unknown`. The caller then validates the expected token or profile fields. Provider error bodies and tokens are not included in the error messages returned to the client.

## 7. The controller hands the profile to `AuthService`

The callback controller connects the two responsibilities:

```ts
const profile = await this.discord.authenticate(request, response);
return this.auth.loginWithDiscord(profile);
```

At this point, the strategy has obtained the Discord identity. `loginWithDiscord()` handles our application's rules:

- An already-linked Discord identity logs in to its existing local account.
- A new Discord identity needs a verified email to create an account. The new account defaults to `USER`.
- If that email already belongs to another local account, the request returns `409`. We do not automatically link accounts based on matching email.
- A successful login issues our own access and refresh tokens using the existing authentication logic.

Explicit linking of Discord to an existing account is a separate flow that has not been implemented yet. The callback currently returns our usual authentication JSON; it does not redirect to a frontend page.

## Keep these values separate when reading the code

| Value | What it does |
| --- | --- |
| OAuth `state` | Identifies the temporary login attempt sent through Discord. |
| Browser cookie secret | Binds that attempt to the browser that started it. |
| Authorization `code` | Lets our backend obtain a Discord access token after authorization. |
| Discord access token | Lets our backend request the user's Discord profile. |
| Our access token | Authenticates requests to our application's protected endpoints. |
| Our refresh token | Lets the client obtain a new pair of our application tokens through our refresh endpoint. |

There is one browser cookie for this flow. Starting another Discord login in the same browser replaces it, so the latest attempt is the one to complete.
