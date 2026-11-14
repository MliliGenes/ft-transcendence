# Branch completeness audit — 2026-11-14

This is a bounded branch and feature comparison, not proof that every historical
change has been ported. Commit counts do not establish feature equivalence after
the adapted Nook import at `16fa0ed`.

## Included work

- Delivery `ae6a3aa`, published console fixes `5635641`, feed changes `fdc912e`,
  and the PR #4 candidate are ancestors of integration `f72a743`.
- Latest checked main `c52c1d4` (Saad's email-verification resend endpoint and UI)
  is included by normal merge `afe99b8`, with parents `f72a743` and `c52c1d4`.
- Full verification passed 22/22 on clean commit `afe99b8` at
  `2026-11-14T17:21:18.644Z`: 114 client tests and 95 User tests passed.
  Subsequent `99eb16b` changes only evidence documentation and removal of an
  unused test callback parameter; the five affected component tests passed again.
- No stashes exist. Four dirty console-review files contain earlier versions of
  pending-action UI and tests already covered by integration. They were left intact.

## Historical branches kept separate

| Branch | Checked head | Assessment |
| --- | --- | --- |
| `Aimane`, `aymanysr/chore-continue` | `6af7257` | Same head; 122 commits outside integration ancestry. Contains standalone frontend/auth architecture, refactors, fixes, setup scripts and evaluation docs. Some behavior is mapped into Nook; complete feature equivalence has not been established. |
| `game-service-revised` | `0e669f5` | Older standalone game work, 55 commits outside integration ancestry. Not proven wholly superseded or redundant. |
| `amal` | `b490a59` | Standalone game chat/admin prototypes; not bulk merged into the current client. Product parity needs owner assessment if these prototypes are intended for delivery. |
| `chat-foundation` | `6f1e530` | Earlier Chat identity, authentication and persistent DM work. Current Chat has those feature areas; full behavioral equivalence was not verified. |

Local learning/extraction branches are historical work, and the Documents and
learning worktrees contain untracked diagrams or experiments. Private env files
were not inspected. None of these files were changed or removed.

PR #3 is the current integration-to-main proposal. PR #5's candidate is already
included in integration; PR #1 targets the older Arena lineage. No PR was closed
as part of this audit, and no historical branch was bulk merged.

## Resolved findings (verified 2026-11-14)

1. **Source-limit byte admission resolved (TICKET-13):** [engine validation](../../packages/arena-game/src/engine.ts)
   now checks UTF-8 byte length via `Buffer.byteLength(source, "utf8")` against
   `maxSourceBytes` (default 100 KiB) across both Run and Submit paths. Multibyte
   payloads exceeding the byte bound are rejected prior to attempt mutation or judge
   dispatch. Verified by 3 focused regressions in `source-byte-admission.test.ts`.
2. **Judge payload transport & cleanup resolved (TICKET-14):** [container judge](../../packages/arena-game/src/container-judge.ts)
   replaces Docker CLI base64 `-e` arguments with bounded stdin streaming (`SOURCE_BYTES\nINPUT_BYTES\nDRIVER_BYTES\n`
   headers followed by raw byte streams read by `head -c` into memory-backed `/dev/shm`).
   An upper transport limit of 8 MiB (`MAX_CASE_PAYLOAD_BYTES`) protects against memory exhaustion
   while preserving the normal 100 KiB source admission contract. Containers are uniquely named
   (`arena-judge-<uuid>`) with `--label arena-judge-owned=true`; on orchestrator timeout (`outerTimeoutMs`
   or killed process), an explicit bounded `docker rm -f <containerName>` cleans the container,
   settling cleanly as `JudgeInfraError` with zero container leaks. Real Docker runner framing validation
   (exit code 70 on truncated/corrupted input) and stdio execution with binary NUL/multibyte payloads
   are verified by 15 tests in `judge-payload.test.ts` and 5 tests in `container-judge-trust.test.ts`.

## Remaining findings

1. **Socket token expiry:** server-enforced expiry of active sockets remains a
   separately documented design concern. Client renewal does not prove that idle
   server connections expire. This audit did not establish an exploit or repair it.
2. **Setup and evaluation material:** `scripts/play.sh` still references the absent
   `arena-frontend` workspace. README/Compose setup and the Nook handbook already
   exist; adapting the old one-command setup/seeding and evaluation guides is an
   optional scoped improvement, not a wholesale documentation port.

The reported chat-draft race is **not confirmed through normal interaction**:
[TeamChat](../../client/components/arena/TeamChat.tsx) disables its input while
sending. Unconditional clearing alone does not establish the claimed scenario.

The separate-computer G02 demonstration, Saad's shared deployment/provider checks,
and current CI runner status remain owner actions. Browser evidence in the
[delivery note](arena-delivery-2026-11-14.md) predates these reconciliation merges.
Main has not been updated by this work.
