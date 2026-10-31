# Game repository and development scripts

## Overview

This directory contains repository-boundary checking and local Game utilities.
The certificate, smoke and play scripts have environment effects. The manual
wizard records human observations; use the current guide to choose fixtures
and distinguish observed results from untested stages.

## Interface

| Script | Entry point and purpose |
| --- | --- |
| [check-repository-boundary.mjs](./check-repository-boundary.mjs) | `npm run check:repository`; checks extraction, package/context layout and links in its selected Markdown inputs. |
| [setup.sh](./setup.sh) | `npm run setup`; one-command fresh host setup (certs, RSA keys in `.env`, Docker stack, seeds Alice & Bob). |
| [setup-env.mjs](./setup-env.mjs) | Generates 2048-bit RSA keys via Node.js crypto and initializes `.env`. |
| [gen-dev-certs.sh](./gen-dev-certs.sh) | `npm run certs`; generates a local certificate and key. |
| [https-smoke.sh](./https-smoke.sh) | `SMOKE_BASE=https://localhost bash scripts/https-smoke.sh`; legacy gateway probes. |
| [manual-game-test.sh](./manual-game-test.sh) | `--help`, `--list`, `--group 1` through `--group 5`, or `--from 1` through `--from 20`; manual observation workflow. |
| [play.sh](./play.sh) | `npm run play`; builds and launches the development-identity preview path. |

The [manual guide](../docs/manual-game-testing.md) is the current command and
fixture reference; the [runbook](../docs/game-local-run.md) describes Game setup.

`play.sh` accepts `local` (default) or `lan`. `GAME_PORT` defaults to 3220 and
`WEB_PORT` to 4173. `lan` changes the printed hostname after IP discovery; it
does not change the listener binding policy. `DATABASE_URL` selects storage;
when absent, the script can autodetect the local PostgreSQL `arena_test`
fixture on port 5433. Follow the guide to select disposable storage explicitly.

## Invariants

- The boundary checker enforces repository/package constraints; it does not
  establish application behavior or a successful Match.
- Wizard results require explicit human PASS, FAIL or SKIP. Completing a wizard
  or a partial group is not proof that every stage passed.
- `play.sh` selects `DEV_PRINCIPAL=true` and production preview. The current
  development query-identity flow needs the DEV Vite fixture in the guide;
  normal manual play uses the documented real-auth environment.
- Legacy smoke uses TLS bypass and fixed-origin/default-Compose assumptions.
  It does not prove certificate trust or current full authentication behavior;
  the guide records its stale cookie assertion and other limits.
- Keep credentials and private observation reports local and out of Git.

## Side Effects

- Certificate generation overwrites local certificate/key files. Invoke it
  deliberately when the guide's certificate prerequisites require it.
- Play builds assets and starts processes. Smoke sends credential/health/network
  probes and reads logs; probes can affect request limits and service logs.
- The wizard opens a browser and writes ignored settings/results under
  `.scratch/manual-game-testing/`. It records observations rather than starting
  services or declaring an automatic gameplay pass.

Play starts Game on `0.0.0.0` and preview with `--host` in both modes; `local`
does not restrict them to loopback. When PostgreSQL is selected, Game acquires
runtime ownership, ensures its schema and recovers saved Matches. Do not run
this development-identity path against an application database.

## Verification

Safe syntax and repository checks from the repository root with Node 22:

```sh
node --check scripts/check-repository-boundary.mjs
bash -c 'for task_script in scripts/*.sh; do bash -n "$task_script" || exit 1; done'
npm run check:repository
```

The repository command checks boundaries. Runtime and manual verification need
separately prepared fixtures from the guide; executable database tests require
disposable databases. Do not run certs, smoke or play just to parse these files.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. The manual wizard scout
stopped at line 300; later stages and whether sampled helper definitions are
invoked were not fully inspected. Other listed scripts were sampled completely.
Documentation checks parse scripts without executing them. No runtime tests,
certificate generation or launches ran for this pass.

The checker scans links in root README/CONTEXT/PROJECT_CONTEXT files and
Markdown under `docs/`; it does not scan every directory README added by EGM.
Check those links separately. `npm run lint:boundaries`, a separate command,
checks package imports and dependency cycles.
