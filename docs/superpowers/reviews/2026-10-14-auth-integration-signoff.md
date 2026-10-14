# Bounded clock-skew fix review — 2026-10-14

Branch: Aimane. Base: `0ca9c9c`. Head: `bf540d0` (source `9ceebad`, proof/docs `bf540d0`). This review covers the accepted P2 slow-browser-clock finding and the small correction only. The earlier full repair review and first scoped idle-expiry report remain separate and are not repeated or overwritten.

## Strengths

- `frontend/src/arena/socket.ts:537` and `frontend/src/arena/lobby.ts:248` now start recovery on an authenticated `io server disconnect` without asking the browser clock whether expiry occurred. This fixes the exact failure mechanism rather than enlarging a clock-skew allowance.
- Both recovery methods now compare the current token with the attached token. The same token invokes deduplicated auth renewal; an already rotated token is reused. Neither refresh selection nor server-disconnect recognition depends on local JWT age. Existing lifetime assertions, missing-token closure, shared socket/baseline recovery, command gating and retained state remain intact.
- Parameterizing the two passive recovery tests keeps the original clock-ahead case and adds the failing 60-second-behind condition. Assertions still require no command-driven refresh, fresh baseline/membership, retained state and no HTTP mutation replay.
- The actual-browser proof now sets an advancing browser clock 60 seconds slow before waiting through the real signed 900-second lifetime. It keeps host/server time and token TTL unchanged. It still observes real disconnect/refresh, fresh Match/Collaboration/Chat/Lobby baselines, stable client objects, retained code/chat/Match ID, enabled Run and a later guest's passive room update.
- Documentation preserves the earlier normal-clock proof and explicitly records the forced-disconnect tradeoff: a different forced-disconnect reason can cost one extra auth refresh. It does not claim replay or relaxation of server authorization.

## Addressed and open findings

**Addressed:** the first scoped review's P2 slow-browser-clock liveness finding. Both outer disconnect gates and the recovery refresh decisions were corrected. The added clock-offset regressions fail before the fix according to the executor's witnessed RED result (2 failed, 28 passed), and independently pass after the fix in this review.

**Open:** none found in the reviewed correction.

## Issues

### Critical (Must Fix)

None found.

### Important (Should Fix)

None remaining in this bounded diff. The accepted P2 is addressed.

### Minor (Nice to Have)

No actionable Minor finding.

## Bounded recovery check

I specifically checked the prior recommendation to prevent server refusals from causing an unbounded renewal loop. A read-only in-memory bundle used the exact current Match/Lobby source and existing TestSocket seam. Both clients first admitted their normal baseline; the browser then read `exp - 60_000` while the modeled server sent `io server disconnect`. Each replacement socket was also server-disconnected before its authorized baseline could complete. The reproduction returned:

```json
{"scenario":"server rejects replacement before authorized baseline","matchRenewals":1,"lobbyRenewals":1,"socketsAfterRecovery":4,"socketsAfterFurtherDrain":4,"matchConnection":"offline","matchConnectionError":"Arena room refused","lastLobbyConnected":false}
```

Thus each client made one refresh and one replacement for the recovery attempt; additional microtask draining did not produce more sockets or refreshes. The in-flight expiry-recovery promise deduplicates the second signal, the replacement-baseline rejection terminates the attempt, and Match reports a failure reachable through its existing Try again UI. No mutation was invoked or replayed. This is a bounded socket-seam check, not another live-service run.

## Verification boundary

- Read the exact `0ca9c9c..bf540d0` diff and the immediate affected recovery/command methods. Integration conclusions use the already inspected stable App token-revision subscriptions and authorized-baseline callers; no unrelated source audit was repeated.
- Independently ran the two affected existing frontend files: auth-renewal 30/30 and ArenaPage 3/3, total **33/33**, exit zero. The user-authorized test command only needed permission for Vitest's temporary configuration cache.
- Independently ran `git diff --check 0ca9c9c..bf540d0`: exit zero.
- Independently ran the bounded replacement-refusal reproduction above: exit zero.
- Executor-supplied fresh verification: full frontend **125/125** plus build; final root **764 passed / 19 default optional skips**, repository checks, builds, lint and type checks all exited zero; Game **141/141**. The earlier unchanged-source 47-case optional-fixture run covers all 19 skips, yielding **783 distinct root cases**. Earlier User Service **108/108**, Account **23/23** and actual Account browser **4/4** evidence remains unchanged.
- Executor-supplied new real HTTPS slow-clock proof: **five groups passed in 16.1 minutes**, execution 13311 exited zero. Its described observations match the inspected test: true 900-second idle expiry at an advancing browser Date 60 seconds slow, real Match/Lobby disconnect and refresh, all fresh baselines, stable references/state, enabled Run, no idle HTTP mutations and a later passive Lobby hint/member update. Other password UI/Play/1v1/2v2/Judge, renewal/raw-expiry, unavailable/retry, identity, migration and logout groups remain green. The prior normal-clock five-group run is retained separately.
- Long root/real-service runs were not repeated by this reviewer. No private fixture material, token, cookie, key or auth-state file was read or printed; no service, product file, index or HEAD was changed. Only this authorized report was written.
- Actual usage at review entry: **50% five-hour / 55% weekly**, below the 95% stop threshold.

## Declined to judge

- Re-auditing `99a493e..65e666a` or `65e666a..0ca9c9c`: already completed independent reviews; this gate is the clock-skew correction only.
- Live external OAuth and SMTP: separate configured-provider integration work explicitly ruled on in the evidence, unchanged by this fix.
- Public certificate trust/deployment, policy/module acceptance and team branch acceptance: separate delivery work, not new blockers for this local scoped gate.
- Multiple Game servers and remote Socket.IO adapters: excluded by the approved single-owner model; the client fix does not alter that model.
- A new actual-service accepted-evaluation/auth-expiry race: server/runtime/accepted-evaluation behavior is unchanged and has earlier bounded evidence; this new browser case makes no exact-race claim.
- General/security audits, unrelated UI, and unsupported browser/storage policies: outside the authorized correction; no demonstrated recovery defect was dismissed under this boundary.
- Diagnosing the earlier overlapping-workload restart fixture failure: source/grace remains unchanged, isolated and full reruns passed, and contention is still an unconfirmed hypothesis rather than a conclusion of this review.
- Repeating long real/root suites or inspecting private fixtures: expressly outside this bounded read-only review; supplied completed results are identified rather than silently treated as independently rerun.

## Recommendations

No further correction is requested by this review. Preserve the earlier reports and evidence distinction during delivery. No broad provider/deployment proof is newly required for this gate.

## Assessment

**Ready for the user-authorized safe push / scoped delivery gate? Yes, at `bf540d0`.**

The accepted P2 is corrected on both clients, affected regressions pass independently, replacement refusal terminates without a refresh loop, and the inspected slow-clock browser case matches the completed real-service evidence. No Critical, Important or actionable Minor finding remains in this bounded correction. This passes the scoped independent review gate; it does not claim public deployment or team acceptance.
