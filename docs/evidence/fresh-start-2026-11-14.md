# Fresh-data startup rehearsal — 2026-11-14 UTC

Antigravity tested main `27c4d8ab4492a42efce851582a86ef4b0ed6eed2` in an isolated
child worktree. The successful final attempt included one repair: executable mode
`100755` for `infra/postgres/10-monitoring-role.sh`. Its contents were unchanged.
The coordinator reviewed the raw attempt metadata, permission witness, readiness
records and functional results before accepting this conclusion.

## Result

After configuring synthetic environment files and JWT keys, the repaired candidate
built and started with the existing Makefile target:

```sh
make up COMPOSE="docker compose -p freshstart20261114 -f compose.yaml -f .scratch/fresh-start/compose.override.yaml"
```

The ignored override isolated host ports and added Mailpit for test email. It did
not replace the database initializer in the final attempt, disable monitoring, or
alter application entrypoints and healthchecks. Child-owned storage started empty.

| Attempt | Initializer | Startup result |
| --- | --- | --- |
| 1 | Unmodified tracked file, mode 0644 | `make up` exited 2; User DB exited 126. |
| 2 | Executable copy supplied by test override | Startup exited 0; workaround evidence only. |
| 3 | Normal tracked mount, mode 0755, empty data | Startup exited 0 in 51 seconds, 23:33:05–23:33:56 UTC. |

All 19 containers were accounted for after the final attempt: 14 healthy, 4 running
without healthchecks, and the MinIO initializer successfully exited 0. This includes
the application, databases, broker, judge, storage and configured monitoring stack.
cAdvisor was healthy but reported Docker Desktop host-metrics limitations; full
monitoring coverage was not established.

## Permission failure and repair

A minimal witness used identical script contents with 0644 and 0755 host permissions.
On the tested Docker Desktop bind mount, as PostgreSQL UID 70, Bash's executable
test returned true for 0644, but direct execution failed126 with “Permission denied.”
The 0755 copy executed successfully. Executable checks on the container's overlay
filesystem behaved normally. This supports the mode-only correction for the
observed host/mount interaction. The exact syscall mechanism was not traced.

Git records the executable bit, so a normal checkout receives the correction.
This test does not establish behavior on every host or on a 42 Linux school machine.

## Functional checks

- Real registration, email verification through Mailpit, login and current-user API.
- Attachment upload through the Chat/S3 flow and byte-for-byte verified download.
- Real 1v1 lobby creation and match startup, then passing C, C++ and Python visible
  Runs on a stdio problem through the HTTP judge worker.
- Two Python hidden submissions completed, persisted and revealed 100:100 in
  `SCORE_REVEAL`. C/C++ hidden submissions were not separately exercised.

These are HTTP checks using the stack certificate as a CA. Browser rendering,
external OAuth, remote-computer gameplay and public deployment were not tested.
The host shared its Docker daemon and build cache; this was fresh application data
and checkout configuration, not a separate physical machine or empty-cache test.

## Evidence and cleanup

Raw artifacts remain in the rehearsal child's ignored `.scratch/fresh-start/`:
`01-make-up*.raw.log`, matching attempt metadata, `witness-results.log`,
`02-readiness-attempt3.json`, and `03-functional-smoke.json`. The helper's printed
PASS label alone is insufficient: the coordinator checked the recorded individual
language results, scoring completion and 100:100 scores directly.

The disposable project was removed after verification. A coordinator Docker query
confirmed no remaining containers for `freshstart20261114`. Existing Nook stacks
were not rebuilt as part of this isolated rehearsal.

This report proves the bounded startup and functional observations above. It is
not a full-project verification pass or production-readiness certification.
