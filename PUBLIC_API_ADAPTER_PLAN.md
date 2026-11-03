# Deferred Public API Adapter

**Status:** Deferred until the application has enough useful endpoints that are safe to expose to external API clients.

## Goal

Add one public entry point for external API clients. The adapter manages API-key lifecycle, validates each key, applies per-key rate limits, checks allowed scopes, and routes approved requests to internal User or Chat service endpoints.

```text
External client
    -> Nginx (TLS, request size limits, optional coarse IP protection)
    -> Public API adapter (API key, scope, per-key rate limit, route allowlist)
    -> private User / Chat service endpoints
```

The adapter is the only public path for these API routes. It must not become an unrestricted proxy to arbitrary internal URLs or methods. Existing browser routes keep their User-service access-token flow; external API keys are a separate client credential.

## Defer implementation until

- [ ] The core app and service APIs are stable enough to identify resources external clients should use.
- [ ] Each candidate endpoint has a clear data owner, authorization rule, request/response contract, and intended audience.
- [ ] The team can name at least five database-backed endpoints, including GET, POST, PUT, and DELETE operations, without exposing private chat data by default.

## API-key lifecycle

- [ ] Generate high-entropy opaque keys with a recognizable non-secret prefix and show the secret only once.
- [ ] Store a cryptographic hash of each key, never its plaintext value.
- [ ] Associate each key with an owner, allowed scopes, creation time, expiry, and revocation state.
- [ ] Provide authenticated key creation, listing (metadata only), rotation, and revocation. Never return an existing secret again.
- [ ] Keep key management access separate from the public API routes and protect it with the normal user session plus any required admin checks.

## Request handling and security

- [ ] Accept keys through one documented header; reject missing, invalid, expired, or revoked keys before routing.
- [ ] Apply per-key quotas in the adapter, with route-specific limits for expensive operations and uploads. Return `429` and `Retry-After` when a quota is exceeded.
- [ ] Enforce scopes and resource ownership. Possession of a key must not grant access to unrelated users' private data.
- [ ] Route only through an explicit method/path allowlist. Do not accept a destination URL or arbitrary downstream path from the client.
- [ ] Keep User and Chat services off public ports for these routes; only the adapter receives external API traffic.
- [ ] Authenticate adapter-to-service requests. A private Docker network helps isolate traffic but is not, by itself, service authentication.
- [ ] Keep payload-size limits at Nginx and validate request bodies again in the service that owns the data.
- [ ] Log key IDs and request outcomes for audit, never raw API keys or sensitive request bodies.

## W06 completion checklist

The tracker describes the Public API module as requiring database interaction through a secured API key, rate limiting, documentation, and at least five endpoints covering GET, POST, PUT, and DELETE.

- [ ] Publish at least five useful, documented endpoints across the required HTTP methods.
- [ ] Document authentication, scopes, request/response schemas, pagination, errors, and rate-limit behavior in OpenAPI or equivalent documentation.
- [ ] Demonstrate successful calls, rejected credentials, insufficient scopes, ownership denial, and rate limiting.
- [ ] Add the public API route prefix to the deployment gateway only after the adapter and authorization checks are ready.
- [ ] Recheck the exact subject wording and demonstrate the complete module before claiming W06.

## Build order when resumed

1. Pick the public resources and write the endpoint contract.
2. Add the adapter's key table, key management, validation, scopes, and rate-limit storage.
3. Add explicit routes that call the owning service through authenticated internal APIs.
4. Publish documentation and add the API route prefix to Nginx.
5. Verify the positive and denied cases above, then assess W06 against the subject.

Do not build the key issuer or expose placeholder endpoints before there are stable API use cases.
