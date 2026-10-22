# Documentation index

Reviewed 2026-10-22 against Aimane at `97e7492`. Start with current guides;
use dated evidence for what was tested and historical plans for why it changed.

## Current guides

| Need | Start here |
| --- | --- |
| Install and open Account → Play | [Root README](../README.md) |
| Run Game, Compose, Judge and database fixtures | [Local runbook](game-local-run.md) |
| Test manually, inspect logs or run automated suites | [Manual testing guide](manual-game-testing.md) and [20-stage wizard](../scripts/manual-game-test.sh) |
| Find source files and remaining work visually | [Repository map](../.agent-native/visual-docs/repo-overview/plan.mdx) and [viewer instructions](../.agent-native/README.md) |
| Check game rules and shared terms | [Game context](../CONTEXT.md) |
| Understand wider Nook product direction | [Project context](../PROJECT_CONTEXT.md), dated product direction rather than proof of implemented features |
| Connect User Service identity to Game | [Auth/Game contract](auth-game-contract.md) |
| Find package public interfaces | [Package guide](../packages/README.md) |
| Check 42 candidate modules and evidence gaps | [Compliance matrix](42-subject-compliance.md) and [subject PDF](../requirements/ft_transcendence-v21.2.pdf) |

## Dated evidence

- [Frontend repairs, 2026-10-22](frontend-repair-evidence.md): stable editor
  warnings, forfeit result, 811 root passes and focused two-browser proof.
- [Starter and transport repairs, 2026-10-19/20](starter-execution-repair-evidence.md):
  Python/C/C++ execution, maximum-input limits, full 1v1/2v2 network proofs.
- [Auth integration, 2026-10-14](auth-integration-repair-evidence.md) and
  [independent sign-off](superpowers/reviews/2026-10-14-auth-integration-signoff.md):
  real password login, renewal, expiry recovery, account change and logout.

Counts belong to their stated source/date. New evidence does not imply that
all earlier standalone suites or external-provider journeys were rerun.
The complete human four-player pass and final team acceptance remain open.

## Architecture and history

- [ADRs](adr/): recorded architecture decisions. Start with
  [one Game owner, deadline and event convergence](adr/0013-match-deadline-lobby-and-event-convergence.md)
  and [snapshot provenance](adr/0014-code-arena-extraction.md).
- [Original auth connection plan](superpowers/plans/2026-10-13-connect-saads-login-to-game.md)
  and [auth repair plan](superpowers/plans/2026-10-13-auth-integration-repairs.md):
  historical execution records; use the evidence above for completed gates.
- [Frozen Arena interaction reference](reference/code-arena-ui.html): design
  reference, not a live application or test result.
- [Imported User Service setup plan](../user-service/COMPOSE_SETUP_PLAN.md):
  historical upstream layout; its `compose.yaml`, `envs/`, `volumes/` and reset
  notes are not the current Aimane setup. Use the root README/runbook instead.

Private manual-test notes, QA accounts and local bridge state stay ignored.
Do not publish `.env`, credentials, `.plan-url`, comments or session traces.
