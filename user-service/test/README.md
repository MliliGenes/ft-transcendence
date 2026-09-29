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
