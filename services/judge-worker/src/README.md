# Private Judge worker runtime

## Overview

This directory serves authenticated judging requests on a private HTTP process.
It checks Docker readiness and bounds admission through a FIFO job queue. Game
uses this boundary for visible Run and sealed evaluation.

## Interface

- [http-server.ts](./http-server.ts) exports `createJudgeWorkerServer`.
  [main.ts](./main.ts) starts it on `0.0.0.0:3010` by default.
- `GET /health` reports process liveness; `GET /ready` reports execution
  readiness. They do not themselves prove a complete judging request succeeds.
- `POST /v1/run-visible` and `POST /v1/evaluate-sealed` are authenticated
  execution endpoints. Bearer secrets are compared through SHA-256 digests
  with a timing-safe comparison.
- Requests carry source, tests and limits for C, C++ or Python, with `snippet`
  or `stdio` drivers and optional entrypoint/class/signature metadata.
- [job-queue.ts](./job-queue.ts) supplies bounded FIFO scheduling;
  [readiness.ts](./readiness.ts) checks the daemon and configured runner images.
- The [worker package](../README.md) documents the preparation entrypoint and
  private Compose boundary. Execution adapters belong to the engine's public
  [Judge entry point](../../../packages/arena-game/src/judge.ts).

### Request and process configuration

Both execution endpoints require `language`, `driver`, `source` and `limits`.
Visible Run supplies `tests`; sealed evaluation supplies `groups` and string
`evaluationId`, `submissionId`, `problemVersionId`, `hiddenSuiteId`. Test items
have string `id`, `input`, `expected`; groups have a name, finite non-negative
weight and test array. Optional `entrypoint`/`className` must be identifiers;
the supported signature is `int64-array`.

The six limit fields are `compileWallMs`, `runWallMs`, `runMemoryMb`,
`runOutputBytes`, `runCpus` and `runPids`; each must be finite and greater than
zero. `BoundedJobQueue` owns admission; `DockerImageReadiness` owns readiness.

| Environment input | Default or requirement |
| --- | --- |
| `JUDGE_WORKER_TOKEN` | Required private Bearer secret; do not log it. |
| `JUDGE_DOCKER_BIN` | `docker`. |
| `JUDGE_PYTHON_IMAGE` | `python:3.12-slim`. |
| `JUDGE_GCC_IMAGE` | `gcc:14-bookworm`. |
| `JUDGE_WORKER_PORT` | 3010. |
| `JUDGE_WORKER_CONCURRENCY` | 2. |
| `JUDGE_WORKER_MAX_QUEUE` | 8. |
| `JUDGE_WORKER_QUEUE_TIMEOUT_MS` | 30,000. |
| `JUDGE_WORKER_JOB_TIMEOUT_MS` | 900,000. |

## Invariants

- Execution requires valid authentication and a ready worker. Missing Docker
  or runner images cannot silently select another Judge.
- The default aggregate HTTP request body cap is 2 MiB. It applies to the whole
  request, including combined test data, rather than separately to each case.
- Defaults are two active jobs, eight waiting jobs, a 30,000 ms queue-wait
  deadline and a 900,000 ms execution deadline.
- A waiting request can expire before admission. Timeout of a started job
  rejects its caller but is not cancellation: the active slot remains occupied
  until the underlying job settles. HTTP timeout is not proof execution stopped.
- `/health` and `/ready` answer different questions. Docker/image checks do
  not establish Game ownership, application database health or browser access.

Execution errors map to 400 (invalid request/validation), 401 (authentication),
413 (aggregate body too large), 429 (queue full), 503 (not ready, queue wait
expired or Judge infrastructure failure), 504 (started-job timeout), or a
generic 500 (unknown failure). Successful `/health` does not bypass any of
these execution gates.

## Side Effects

- Opens an HTTP listener, reads request bodies and sends JSON responses.
- Runs Docker information/image-inspection processes during readiness checks
  and calls the configured Judge for accepted jobs.
- Schedules queue and execution timers. Process signal handlers close the
  server; they do not establish guaranteed cancellation of active execution.

## Verification

From the repository root with Node 22:

```sh
npm run typecheck --workspace arena-judge-worker
npm test --workspace arena-judge-worker
```

Build package dependencies first and follow the
[manual guide](../../../docs/manual-game-testing.md) for disposable fixtures and
Docker prerequisites. Do not substitute a live application environment for test
fixtures or treat a liveness response as an execution test.

Source checkpoint: `Aimane` at `67fc6b0`, 2026-10-27. All four direct source files
were fully sampled. ContainerJudge implementation is outside this directory.
No tests, Docker jobs or services were run for this documentation pass.
