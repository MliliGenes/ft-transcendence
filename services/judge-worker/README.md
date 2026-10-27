# Private Judge worker

## Overview

The `arena-judge-worker` workspace is the private execution process used by
Game. Its shell entrypoint prepares Docker and runner images before replacing
itself with the launch command. The runtime exposes readiness and authenticated
visible/sealed judging through a bounded queue.

## Interface

- [src](./src/README.md) documents the HTTP server, queue and readiness checks.
- [docker-entrypoint.sh](./docker-entrypoint.sh) checks Docker and the configured
  Python/GCC images, reuses present images, pulls missing ones and then `exec`s
  the supplied command.
- [package.json](./package.json) defines an ESM workspace with `build`, `start`,
  `test` and `typecheck`, depending on the engine's supported Judge interface.
- [Dockerfile](./Dockerfile) prepares the service image;
  [Compose](../../docker-compose.yml) defines its private topology.
- [Game](../game/README.md) is the caller. See the engine's
  [entry-point contract](../../packages/README.md) for package boundaries.

## Invariants

- Docker and runner-image preparation must succeed before launch. Readiness
  requires the daemon and configured images; there is no fallback Judge.
- In the current Compose topology, only this worker receives the Docker socket.
  It joins `judge-internal`, has no published host port and has no Nginx route.
- Authenticated execution requires worker readiness and the shared Bearer
  secret. The default aggregate HTTP request body cap is 2 MiB.
- Queue deadlines bound caller waits. A timeout of active work does not cancel
  that execution or release its slot until the underlying job settles.
- Worker liveness does not prove execution readiness, Game runtime ownership
  or successful end-to-end gameplay.

## Side Effects

- Startup runs Docker information/image inspections and may download images.
  It replaces the entrypoint process with the launch command.
- The runtime opens HTTP, schedules jobs/timers and calls the container Judge.
- Execution uses the Docker daemon; this process is an intentional privileged
  host boundary rather than a browser-facing service.

## Verification

From the repository root with Node 22:

```sh
sh -n services/judge-worker/docker-entrypoint.sh
npm run typecheck --workspace arena-judge-worker
npm test --workspace arena-judge-worker
```

The first command parses the shell without running it. Build package dependencies
and use the [manual guide](../../docs/manual-game-testing.md) for executable-test
and Docker prerequisites. Do not run the entrypoint merely to check documentation.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. The entrypoint and direct
runtime source were fully sampled. No image pulls, tests or services ran here.
