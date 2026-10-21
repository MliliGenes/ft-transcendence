# Game round progression behavior

## Summary

Round progression in a 1v1 match depends on both players submitting, while a single player's **Next round** action advances the shared match for both players. This can make the match feel blocked while waiting for the opponent, then move both players forward as soon as either one continues.

## Observed behavior

1. Start a round and submit a solution as one player.
2. If the other player has not submitted, the first player does not see the score reveal or a way to continue to the next round.
3. After both players submit, the score reveal appears.
4. When either player clicks **Next round**, both players are transferred to the next round.

## Leaving a match does not show the forfeit result

**Observed behavior:** When a player chooses **Leave match**, the other player sees a stale screen with the **Match complete** status, but the page does not declare a winner or loser.

**Steps to reproduce:**

1. Start a match.
2. Have one player choose **Leave match** and confirm.
3. Check the other player's match page.

**Expected behavior:** The match should end and both players should see the forfeit outcome, identifying the winner and the player who left. The leaving player should see that they forfeited.

**Code evidence:** The engine records the leaving side and the opposing side as loser and winner, and sets the match phase to `MATCH_COMPLETE` in `packages/arena-game/src/lib/engine.ts` (`leaveMatch()` / `recordForfeit()`). The engine also computes a terminal result with the forfeit outcome. However, the match-complete result section in `frontend/src/components/ArenaPage.tsx` is rendered only when `snapshot.reveal` exists. A forfeit can end the match without publishing a round reveal, so the result UI may not render even though the server has recorded the winner and loser.

## Expected behavior to confirm

Please confirm the intended rules for these two steps:

- Should a submitted player have to wait for the opponent to submit before the round can be revealed or continued? If so, what should happen when the opponent does not submit?
- Should one player's **Next round** click advance the match for both players immediately, or should the game wait for both players to confirm before advancing?

## Code references

- `services/game/src/game/game.service.ts`, `maybeAutoReveal()`: publishes the score reveal only when every side has a counted result.
- `frontend/src/components/ArenaPage.tsx`: shows the **Next round** button only after the score reveal.
- `packages/arena-game/src/lib/engine.ts`, `nextRound()`: advances the shared match state and emits `round.advanced` after one authorized player calls advance.
- `frontend/src/arena/socket.ts`, `advance()`: sends that player's advance request to the server and refreshes their state.
- `packages/arena-game/src/lib/engine.ts`, `leaveMatch()` / `recordForfeit()`: ends a match immediately and records its winner and loser.
- `packages/arena-game/src/lib/round-lifecycle.ts`, `computeFinal()`: calculates the terminal forfeit result.
- `frontend/src/components/ArenaPage.tsx`: gates the match-complete result UI on `snapshot.reveal`, which may be absent after a forfeit.

## Notes

This report describes the behavior observed during play and the corresponding code paths. The intended round progression rules still need confirmation before treating either round behavior as a defect. The missing forfeit result appears inconsistent with the server's recorded winner and loser.
