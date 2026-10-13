# Authentication checks

`npm run test:auth` builds the service and runs the HTTP/service tests with mocked
database access, real password hashes, and real JWT signatures.

`npm run test:auth:postgres` tests refresh/logout ordering with real PostgreSQL
transactions. Create a separate database with a name ending in `_test` and apply
the project's migrations to it first. Then run, for example in PowerShell:

```powershell
$env:AUTH_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/user_service_auth_test'
npm run test:auth:postgres
```

This command uses `AUTH_TEST_DATABASE_URL`, not the application's `.env` database
settings. Tests create their own users and remove only their own records. They
verify both logout/refresh orders, concurrent replay, old-token logout, and
preservation of other login sessions. The test database role must be able to
inspect its own connections in `pg_stat_activity` to confirm lock waits.

`npm run test:discord` checks Discord login and account linking over HTTP with
mocked Discord/database access and real JWT verification.

`npm run test:discord:postgres` verifies concurrent provider claims, idempotency,
single-use state, state ownership constraints, and deletion cascades on PostgreSQL.
It reads the root `.env` database settings, or `AUTH_TEST_DATABASE_URL` if set.
Unlike the refresh race suite, it creates a unique `discord_link_test_<uuid>`
schema, applies all migrations there, and drops only that schema afterward.
The database role must be allowed to create schemas. Existing application tables
and records are not modified; no real Discord requests are sent.

## Browser session regressions

`test/browser-session-contract.test.mjs` checks trusted source and custom-header
requirements, equivalent route forms, root-cookie deletion and duplicate-cookie
rejection. Existing HTTP auth fixtures send the same browser headers.

Run standalone tests with Node 24. Set explicit fixture mail settings and
`AUTH_FRONTEND_URL=http://localhost:5173`; no real mail is sent by the unit
fixtures. For the full PostgreSQL suite, set both `AUTH_TEST_DATABASE_URL` and
the `POSTGRES_*` fields to your separate migrated test database. Set
`DOTENV_CONFIG_PATH=/dev/null` and empty `GITHUB_LINK_REDIRECT_URI` and
`DISCORD_LINK_REDIRECT_URI` for deterministic local provider fixtures. Never use
the application database for these checks.
