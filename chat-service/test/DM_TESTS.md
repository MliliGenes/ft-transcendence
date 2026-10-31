# DM endpoint tests

Run from the chat-service directory with Docker Desktop running:

```powershell
docker start chat-postgres-test
powershell -NoProfile -File test/run-dm-postgres.ps1
```

The runner builds current sources and runs `dm.postgres.test.mjs` using Node's built-in test runner. It uses the existing `node:24-alpine` image as a temporary TCP forwarder on a free host port, because Windows PostgreSQL also listens on port 5432 here. It creates a disposable database/login in `chat-postgres-test` and removes them and the forwarder in `finally`. Existing database passwords and tables are not modified. The PostgreSQL container stays running. The runner assumes the default Docker bridge network and local `psql` admin access inside the container.

For another reachable test database, set `TEST_DATABASE_URL`, run `npm run build`, then `node --test test/dm.postgres.test.mjs`. The suite creates and drops only its own random schema. The database login needs permission to create schemas. The suite uses the real Prisma schema plus `prisma/constraints.sql`, real controller/service/guard, generated RSA tokens, and the application's validation settings. It does not start the gateway, RabbitMQ, or User service. Fixtures stand in for already synchronized users; social eligibility/deletion policies need separate tests once those contracts exist.

The tests expect Nest's current POST status of 201 for both a newly created and an existing DM. Change that expectation if we deliberately choose a different response contract.

## Run on 2026-10-31

- Build passed.
- 2 tests passed: invalid credentials rejected; invalid/missing body fields and caller-ID injection rejected.
- 6 tests failed with HTTP 500: creation, repeat/reversed pair, uppercase IDs, self-DM, unknown recipient, and concurrent creation.
- Failures are left visible for the learning workflow; application code was not rewritten.

Start with `ChatService`: the compound unique key belongs in `findUnique`, and creation must use `dmUserAId`/`dmUserBId`, not `participants`. Normalize/sort before lookup and creation. Use `BadRequestException` for self-DMs. After basic creation works, the repeated and concurrent tests will check uniqueness behavior rather than failing at the initial query.
