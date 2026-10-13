# Browser authentication

`browser-auth` is a dependency-free ESM package. Import its supported interface
from `browser-auth` (or `src/client.js` inside package tests). Its memory session
and HTTP helpers are available from that same entry point.

```js
import { createBrowserAuthClient } from 'browser-auth';

const auth = createBrowserAuthClient({
  apiBase: '/api',
  locks: navigator.locks,
  channel: new BroadcastChannel('fieldnote-auth-session'),
});
await auth.restore();
```

Web Locks serialize cookie login, refresh and logout across the origin. Use the
same channel name and origin storage in each SPA and tab. `storage` optionally
injects a `getItem` / `setItem` / `removeItem` adapter; the browser default is
`localStorage`. Non-browser tests should inject shared storage when exercising
multiple clients.

The only persistent auth value is a random, credential-free logout intent under
`browser-auth:logout-pending`. Access tokens stay in memory; the refresh token
stays in the HttpOnly cookie. Snapshots and control messages contain no tokens.
Logout clears the local session immediately and writes its intent before any
network work. Failed logout leaves that intent in place across reloads and SPAs.
Every restore and renewal checks it under the origin lock, including
`restore(true)`. A matching confirmed logout or a deliberate successful login
clears it; an older acknowledgement cannot erase a newer intent.

A deliberate login or `signed-in` control message begins a new identity
generation, invalidating older requests and profile callbacks. Those callbacks
reject with `SESSION_CHANGED` instead of replacing the newer session or its
status. Token renewal within the current identity keeps the generation and
increments `tokenRevision`. `dispose()` also invalidates pending work and removes
listeners, without signing out a shared memory store.

`auth.fetch(path, options)` sends each request once by default. A 401 may renew
authentication once, but the original operation rejects with
`ApiError.code === 'RETRY_REQUIRED'` so its caller can deliberately retry. Only
GET and HEAD requests that set `retrySafeRead: true` can replay, at most once,
after renewal or a network/5xx failure. Mutations never replay, even if that
option is accidentally supplied. A confirmed failed renewal or a second 401
expires the session; outages retain it as unavailable.

```js
const profile = await auth.fetch('/accounts/me', { retrySafeRead: true });
await auth.fetch('/accounts/me/password', { method: 'PATCH', json: values });
// Handle RETRY_REQUIRED by asking the caller to retry the mutation deliberately.
```

Run the complete public-entry suite with `npm test --workspace browser-auth`
using the repository's supported Node version.
