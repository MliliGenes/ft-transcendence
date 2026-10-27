# Game principal client

## Overview

This directory supplies Game's client for the external verified-principal API.
It translates a Bearer access token into the identity and expiry used by Game
adapters. Identity issuance and the User Service implementation remain outside
this Game-side boundary.

## Interface

- [auth-principal-client.ts](./auth-principal-client.ts) exports
  `AuthPrincipalClient.verify(accessToken): Promise<VerifiedPrincipal>`.
- `VerifiedPrincipal` contains `userId` and `expiresAt`.
- `UnauthorizedError` represents a rejected token; `VerificationUnavailableError`
  represents an unavailable or unusable verification response.
- Verification calls `GET /auth/principal` on the configured User Service base.
  See the [integration contract](../../../../docs/auth-game-contract.md).
- The [process contract](../README.md) and
  [Game adapters](../game/README.md) describe consumers of this client.

Test-only [test-helpers.ts](./test-helpers.ts) exports
`createTestAppWithVerifier(fakeVerify, extra)`. It installs a fake verifier and
optional controllers/providers; `extra.applyMiddleware` runs in module
`configure()` before routes. Close the returned Nest app after each fixture.
This helper does not issue or prove a real principal.

## Invariants

- Concurrent verification requests for the same token share one in-flight
  promise. Settled results are removed rather than retained as an identity cache.
- Only HTTP 401 becomes `UnauthorizedError`. Network failures, other status
  codes, invalid JSON and malformed or expired principals become unavailable.
- A principal must have a UUID-shaped user ID and a safe-integer expiry in the
  future. A successful HTTP status alone is insufficient.
- Game derives identity from the verified principal rather than trusting a
  request's claimed user ID. Development identities are an explicit fixture.

## Side Effects

- Sends an outbound HTTP request carrying the access token as Bearer auth.
- Uses a 2,000 ms abort signal for the request and a transient token-keyed map
  to share concurrent work.
- Does not implement login, token issuance, profile storage or account changes.

## Verification

From the repository root with Node 22, the configured commands are:

```sh
npm run typecheck --workspace arena-game
npm test --workspace arena-game
```

Prepare built package dependencies and disposable PostgreSQL/Docker prerequisites
using the [manual guide](../../../../docs/manual-game-testing.md) before running
executable tests. Never use an application database for database-clearing tests.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. The client and shared
test-helper seam were read. The helper remains test-only. No executable tests
were run for this documentation pass.
