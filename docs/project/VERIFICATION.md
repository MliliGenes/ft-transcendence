# Repeatable project verification

## Setup (Linux/macOS)

Use Node 22 or newer, npm, Git, tar and a running Docker daemon. Install the locked dependencies for the root workspace, Client, Chat and User:

```sh
npm ci
npm ci --prefix client
npm ci --prefix chat-service
npm ci --prefix user-service
npm run checks:setup
```

`checks:setup` installs Gitleaks 8.30.1 into ignored `.tools/`, verifies its archive against the pinned upstream SHA-256 digest, and configures repository-local `.githooks`. Existing custom hooks are preserved: setup refuses to overwrite them and tells you to integrate the scanner manually. Git's hook configuration is shared by linked worktrees; the relative `.githooks` path resolves inside the worktree where Git runs. Install hooks in each clone. CI does not depend on contributors enabling local hooks.

## Commands

```sh
npm run check              # Full project gate, including real disposable integration tests
npm run lint               # Client, Chat and User's real linters
npm run test:integration   # Build/setup and run only disposable database/socket suites
npm run secrets:staged     # Scan the index, including staged content hidden by unstaged edits
npm run secrets:ci         # Scan the index and new history after the rollout baseline
```

The full gate explicitly calls the commands defined by each component, including Node-based User tests, backup regressions, workspace typechecks/tests, service builds and the client production build. Root `npm test` remains the Arena workspace suite with application database variables removed and legacy engine database probes pointed at an unavailable test target; use `npm run check` for the whole product. A failure stops the run and produces a nonzero exit. Stage results and durations are written to ignored `.verification/latest.json`.

Default Arena tests can report skips for database suites and optional external judge providers. The full gate then exercises the required database/reconnect cases separately using its own services; optional third-party judge-provider checks still require their own environment. A successful full gate does not claim those optional providers were exercised.

## Disposable service boundary

The runner creates uniquely named, labeled PostgreSQL 18 and RabbitMQ 4 containers on dynamically allocated loopback ports. It creates separate engine, Game, Chat and User test databases, applies the User and Chat migrations, and supplies those connection settings directly to test processes. It does not read connection settings from `envs/*.env`, start the application Compose stack, run a live restore, or drop application databases. Cleanup removes only the names created by this run, including their anonymous volumes, on normal completion, test failure or handled interruption. An uncatchable process/host failure can still require manual removal of containers labeled `nook.verification`.

The Chat and User migrations are applied to their disposable databases with `prisma migrate deploy`, so a migration is exercised by the required check and not only through the DDL the test suites generate.

The Game real-socket suites use fixed test listener ports (3217/3218 as defined in their fixtures); run one full/integration gate at a time on a host. Their default timeout is raised to 30 seconds for real Docker/SQL/socket work; explicit longer restart deadlines remain in the tests.

## Secret prevention and historical exposure

Pre-commit scans the exact Git index; ignored local credentials are not copied into the scan. Pre-push scans outgoing history, so adding then deleting a secret in separate commits is rejected. Credential env files, private-key files and recognizable credential archives are blocked by pathname; Gitleaks default rules and a private-key rule scan contents and nested archives. Scanner output is redacted. Example env files remain permitted, but their contents are still scanned.

The explicit rollout boundary is reviewed integration commit `ecbbfdda3fa52538bd00a192a311f3f8f36ff11e`. CI scans the tracked index and every later commit, including merge diffs. New branches must descend from that boundary. Preserve the integration history with a merge commit; squashing/rebasing it requires a deliberate review and update of the rollout boundary rather than silently bypassing it. This prevents newly introduced leaks; it does **not** certify earlier history as secret-free or resolve the [published credential incident](INTEGRATION_STATUS.md#credential-exposure-operator-action-required). No general finding allowlist or whole-file test exemption is configured. One inline annotation identifies the numeric synthetic public Discord application ID required by its validation tests; it is not a credential. A deliberate bypass of local hooks remains possible; require the CI check through repository branch protection if you want server-side enforcement.

The [GitHub workflow](../../.github/workflows/verify.yml) runs the same full gate for pull requests and pushes to main, with read-only repository permissions and without application secrets. It installs dependencies from all four lockfiles, then provisions its own disposable services. The workflow must run successfully on GitHub before describing hosted CI as verified; local validation alone is insufficient. Repository admins control Actions availability, branch protection and the separate Vercel project permissions.

## Tool references

- [Gitleaks CLI and archive scanning](https://github.com/gitleaks/gitleaks)
- [Pinned Gitleaks release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
- [Node setup action](https://github.com/actions/setup-node)

Keep this document as the navigation entry for checks. The scripts define the exact command list; avoid copying another full matrix into agent steering files.
