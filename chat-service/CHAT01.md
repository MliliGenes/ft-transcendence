# CHAT-01: identity and deployment foundation

## Current integration status

The User-service endpoint/module added during this checkpoint was removed at the
user's request. User service is maintained by the teammate. Its source is unchanged.
The internal REST contract below is a dependency to agree with that teammate, not
an endpoint this branch currently implements. Chat requires a compatible running
User service, its public signing key, URL and internal secret before real-login
integration can pass. CHAT-01 is pending that integration.

Earlier successful full-stack results below describe the implementation before
removing the User-service endpoint. They do not prove the current branch integrates
with the teammate's running service. The full acceptance test remains as a future
integration check and will fail until the compatible endpoint is supplied.

## What this checkpoint does

The browser still uses the existing User-service login. Chat verifies the returned
RS256 access token, then confirms the caller through authenticated User-service
REST and ensures its own local ChatUser exists. No second login screen, token
storage, cross-database join, or User database credential is introduced.

- Local `GET /session` and `GET /chat/session` are protected. The signed caller's
  first request creates their public profile copy before returning `{ userId }`.
- Local `/health` and `/chat/health` remain public liveness endpoints.
- Shared gateway: `https://localhost/api/chat/session` and `/api/chat/health`.
- `/internal/*`, `/api/internal/*`, and `/api/chat/internal/*` are blocked by Nginx,
  including case variants. A browser token cannot authenticate internal endpoints.
- Other Chat REST features are not implemented by this checkpoint.

## Internal contract

The required teammate-owned contract is `GET /internal/users?ids=uuid,uuid`. It requires
`x-internal-key: <INTERNAL_API_SECRET>` and returns an array with exactly one
entry per unique, normalized requested UUID (1–100 IDs). The endpoint selects
and serializes public fields only; responses use `Cache-Control: no-store`.

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "username": "alice",
    "displayName": "Alice",
    "avatarUrl": null,
    "updatedAt": "2026-10-18T10:00:00.000Z",
    "deleted": false
  }
]
```

Missing/physically deleted accounts return the same fields with public names and
avatar null, `deleted: true`, and `updatedAt` set to the lookup observation time.
That timestamp is not a recovered original deletion time. User IDs must never be
reused. The current User schema has no account-disable state or disable endpoint;
this implementation does not pretend that feature already exists.

The teammate must supply the internal endpoint and its authentication settings.
Chat requires its URL/key at startup.
Use HTTPS for remote service origins. Local HTTP is limited to loopback or the
explicit Docker hostname `user-service`; redirects are refused. Requests time out
after two seconds, bodies are capped at 256 KiB, batch shape/IDs are validated,
and simultaneous identical lookups share only the in-flight request.

## Local profile lifecycle

`ensureUsers(ids)` uses a ten-minute profile TTL, as in the merged plan. `syncedAt`
is Chat's fetch time. `sourceUpdatedAt` is the owning User service's profile version.

- Concurrent inserts use `createMany(skipDuplicates)`; profile updates require a
  strictly newer source timestamp. Old responses cannot replace newer names.
- A deleted local row is terminal and cannot be restored by a delayed response.
  Deletion clears username, display name, and avatar while retaining the UUID.
- A protected request forces a live check of its caller. Metadata TTL is never
  used as permission to operate. An unavailable dependency returns 503; an absent
  caller returns 401. Known profiles may still be used as display data by future
  callers, but cached metadata alone does not authorize a request.
- Account deletion retains authored messages and their ordering with a cleared
  author profile. This is the explicit baseline retention policy, not an erasure
  implementation or a claim that all message content is anonymous.
- Deleted users lose memberships in the same transaction. If no active member
  remains, the group is deleted. Otherwise, if needed, the earliest joined active
  member (UUID breaks ties) becomes ADMIN. Every affected group is transaction-
  locked in stable order. Future CHAT-04 membership operations must use the same
  `lockGroup` helper. Live group notifications belong to CHAT-03/04.

The new migration adds `syncedAt`, `lastMessageAt`, group storage, nullable DM
participants for channels, and the DM/channel CHECK constraint. Existing DMs keep
kind DM, existing history is retained, and `lastMessageAt` is backfilled from
messages. Existing projections are marked stale for their next refresh. CHAT-02
must update lastMessageAt transactionally when saving messages.

## Configure actual local files

`.env.example` files are templates only. No runtime code loads them. Actual
files are ignored by Git; do not put shared secrets in browser/public settings.

For the shared Docker stack, create these real files from the templates:

- `envs/chat-db.env`: separate PostgreSQL admin and Chat-role passwords.
- `envs/chat-service.env`: Chat database URL and User-service public key.
- `envs/internal-api.env`: Chat’s INTERNAL_API_SECRET; the teammate configures the matching value in User service.

Generate the internal secret locally with `openssl rand -hex 32`. Put the result
only in the real `internal-api.env`. Copy the public key matching the existing
User service signer into Chat's real config; never copy the private signing key.
The Chat-role password in DATABASE_URL must match CHAT_DB_PASSWORD. URL-encode
special password characters. Leave existing User-service/RabbitMQ/frontend setup
in place, including its existing first-run superadmin settings.

The shared Compose database services have no published host ports. Chat joins its
own data network and the service network, but never joins User's data network.
Do not reuse the local helper's localhost URL inside a Docker container.

After reviewing the migration and settings, from the repository root:

```sh
docker compose up -d --build
```

For standalone development instead, Chat reads `chat-service/.env`. Add
USER_SERVICE_URL (direct User-service origin) and INTERNAL_API_SECRET there; the
same secret must be present in the real User-service configuration. The public
HTTPS gateway intentionally cannot be used for the internal lookup. The older
local DB helper remains available. Run the new migration before starting Chat
against an existing local database; never reset the database to apply it.

## Acceptance checks

Regular checks from `chat-service`:

```sh
npm run lint
npm test
npm run test:e2e
npm run test:postgres
npm run build
```

For the full acceptance check, build the three test images from the repository
root (ordinary Docker build; no BuildKit-only option is required):

```sh
docker build -t nook-user-chat-check:local ./user-service
docker build -t nook-chat-foundation-check:local ./chat-service
docker build -t nook-gateway-chat-check:local ./nginx
cd chat-service
npm run test:foundation
```

The acceptance test requires the User-service dependencies locally for bcrypt.
It uses dedicated temporary PostgreSQL containers, accounts, keys and networks.
It does not load either project's local .env. It exercises the existing real
login, HTTPS gateway with a trusted test certificate, first-request profile
creation, bad/expired tokens, public internal-route blocking, account deletion,
and inability to connect from Chat to the User database. It then removes its own
containers, volumes and temporary key/config files. It does not run a broker or
test MQ delivery; that belongs to CHAT-03.

## Plan alignment

Based on `origin/chat-service` at `1086b41`, fetched on 2026-10-18, and the supplied
CHAT-01 card. The header is `x-internal-key`, lookup is batch REST, and metadata TTL
is ten minutes. No gRPC is introduced. The array's explicit deleted flag is the
concrete implementation of the plan's proposed status/deleted entry. Immediate
account checks fail closed; future profile-only UI fallback must not grant access.

## Historical results before User-service removal (2026-10-18)

- Chat: 46 unit tests and 19 HTTP end-to-end tests passed; lint and build passed.
- User-service internal endpoint: nine HTTP tests passed; lint and build passed.
- PostgreSQL suite: eight subtests passed, including upgrade preservation,
  concurrent projection refresh, deletion cleanup and last-admin recovery.
- Full isolated Docker acceptance: five subtests passed against the actual User,
  Chat and Nginx images, including HTTPS login and database network isolation.
- Shared Compose configuration and whitespace checks passed. Temporary acceptance
  resources were removed; the existing local Chat database was left running.

The pre-existing User-service auth suite still has four failing test files due
missing SMTP_HOST / RABBITMQ_HOST in its fixtures. The same failures were reproduced
on untouched origin/main; these are not a passing acceptance claim or a change
introduced by this checkpoint.

The integration proof used temporary credentials and signing keys, not the team's
real configuration. Existing actual .env files were not edited. Configure the
real files above before starting the integrated stack locally. Nothing in this
checkpoint was committed or pushed automatically.
