import {
  canTransition,
  compareSides,
  groupEarnedBp,
  matchSum,
  publishRoundReveal,
  type RevealCause,
  roundScoreBp,
  roundScoreFromBp,
} from "arena-model";
import { isCompetitiveVerdict, type ExecutionStatus } from "./judge-types.js";
import { IllegalStateError } from "./match-authority.js";
import type { CountedResult, GroupResult, MatchRecord, RevealSnapshot, RoundState, SideId } from "./records.js";

/** Judge output that the Game turns into a scored Match result. */
export interface SealedVerdict {
  groups: Array<{
    name: string;
    weight: number;
    results: Array<{ id: string; passed: boolean; status: ExecutionStatus; runtimeMs: number }>;
  }>;
}

export interface ScoredVerdict {
  score: number;
  scoreBp: number;
  groups: GroupResult[];
  testStatuses: ExecutionStatus[];
}

export interface FinalResult {
  scores: Partial<Record<SideId, number>>;
  outcome: "left" | "right" | "draw";
  winner: SideId | null;
  forfeit: MatchRecord["forfeit"];
}

export interface RoundAdvance {
  completed: boolean;
  previousRoundId: string | null;
  activityResets: SideId[];
}

export interface RevealInput {
  groups: RevealSnapshot["groups"];
  publishedAt: number;
}

/**
 * Match/Round state machine rules that do not need persistence, sockets, or
 * judge execution. ArenaEngine keeps the transport-facing facade and owns
 * locking/events; this module owns the deeper Round transitions and scoring
 * invariants behind that facade.
 */
function getMatchSides(match: MatchRecord): SideId[] {
  const firstRound = match.rounds[0];
  if (!firstRound) return [];
  return Object.keys(firstRound.activities);
}

function computeSideScores(rounds: RoundState[], sides: SideId[]): Partial<Record<SideId, number>> {
  const scores: Partial<Record<SideId, number>> = {};
  for (const side of sides) {
    scores[side] = matchSum(rounds.map((round) => {
      const counted = round.counted[side];
      return counted ? counted.score : 0;
    }));
  }
  return scores;
}

function computeForfeitResult(
  match: MatchRecord,
  sides: SideId[],
  forfeit: NonNullable<MatchRecord["forfeit"]>,
): FinalResult {
  const scores = computeSideScores(match.rounds, sides);
  const [left, right] = sides;
  const winner = forfeit.winner;
  let outcome: FinalResult["outcome"] = "draw";
  if (winner === left) outcome = "left";
  else if (winner === right) outcome = "right";

  return {
    scores,
    outcome,
    winner,
    forfeit: { ...forfeit },
  };
}

function buildSideContributions(rounds: RoundState[], side: SideId) {
  return rounds.map((round) => {
    const counted = round.counted[side];
    return {
      score: counted ? counted.score : 0,
      scoringTimeMs: counted ? counted.scoringTimeMs : 0,
      submissions: round.attempts[side] || 0,
    };
  });
}

function resolveWinner(outcome: FinalResult["outcome"], left: SideId, right: SideId): SideId | null {
  if (outcome === "left") return left;
  if (outcome === "right") return right;
  return null;
}

function computeCompetitiveResult(match: MatchRecord, sides: SideId[]): FinalResult {
  const [left, right] = sides;
  const leftContrib = buildSideContributions(match.rounds, left);
  const rightContrib = buildSideContributions(match.rounds, right);
  const outcome = compareSides(leftContrib, rightContrib);
  const scores = computeSideScores(match.rounds, sides);

  return {
    scores,
    outcome,
    winner: resolveWinner(outcome, left, right),
    forfeit: null,
  };
}

export class RoundLifecycle {
  startRound(match: MatchRecord): void {
    if (!canTransition(match.roundPhase, "ROUND_INTRO")) {
      throw new IllegalStateError(`cannot start round in ${match.roundPhase}`);
    }
    match.roundPhase = "ROUND_INTRO";
  }

  beginCoding(match: MatchRecord): void {
    if (!canTransition(match.roundPhase, "CODING")) {
      throw new IllegalStateError(`cannot begin coding in ${match.roundPhase}`);
    }
    match.roundPhase = "CODING";
    const round = this.currentRound(match);
    for (const side of Object.keys(round.activities)) round.activities[side] = "coding";
  }

  beginReveal(match: MatchRecord): void {
    const round = this.currentRound(match);
    if (match.roundPhase !== "CODING") {
      throw new IllegalStateError(`reveal rejected in ${match.roundPhase}`);
    }
    // A deadline reveal with zero submissions is valid. The flag closes the
    // acceptance gate while in-flight evaluations finish during grace.
    round.closing = true;
  }

  prepareReveal(
    match: MatchRecord,
    settledEvaluationIds: ReadonlySet<string>,
    inFlightEvaluationIds: readonly string[],
  ): void {
    const round = this.currentRound(match);
    if (match.roundPhase !== "CODING") {
      throw new IllegalStateError(`reveal rejected in ${match.roundPhase}`);
    }
    round.cutoffPassed = true;
    for (const evaluationId of inFlightEvaluationIds) {
      if (!settledEvaluationIds.has(evaluationId)) round.superseded.push(evaluationId);
    }
  }

  prepareDeadlineReveal(
    match: MatchRecord,
    settledEvaluationIds: ReadonlySet<string>,
    inFlightEvaluationIds: readonly string[],
  ): void {
    if (match.roundPhase === "CODING") {
      this.prepareReveal(match, settledEvaluationIds, inFlightEvaluationIds);
      return;
    }
    if (match.roundPhase !== "MATCH_FOUND" && match.roundPhase !== "ROUND_INTRO") {
      throw new IllegalStateError(`deadline reveal rejected in ${match.roundPhase}`);
    }
    const round = this.currentRound(match);
    round.cutoffPassed = true;
    for (const evaluationId of inFlightEvaluationIds) {
      if (!settledEvaluationIds.has(evaluationId) && !round.superseded.includes(evaluationId)) {
        round.superseded.push(evaluationId);
      }
    }
  }

  createReveal(match: MatchRecord, input: RevealInput): RevealSnapshot {
    const round = this.currentRound(match);
    const scores: Partial<Record<SideId, number>> = {};
    const totals: Partial<Record<SideId, number>> = {};
    for (const side of Object.keys(round.activities)) {
      scores[side] = round.counted[side]?.score ?? 0;
      totals[side] = this.totalScore(match, side);
    }
    return Object.freeze({
      round: match.currentRound,
      roundId: round.roundId,
      scores: Object.freeze(scores),
      groups: Object.freeze({ ...input.groups }),
      totals: Object.freeze(totals),
      publishedAt: input.publishedAt,
    }) as RevealSnapshot;
  }

  commitReveal(match: MatchRecord, snapshot: RevealSnapshot, cause: RevealCause = "REVEAL_CONDITION_MET"): void {
    const round = this.currentRound(match);
    round.reveal = snapshot;
    round.closing = false;
    match.roundPhase = publishRoundReveal(match.roundPhase, cause);
  }

  finishAtDeadline(match: MatchRecord): boolean {
    if (match.roundPhase === "MATCH_COMPLETE") return false;
    if (match.roundPhase !== "SCORE_REVEAL" && match.roundPhase !== "ROUND_COMPLETE") {
      throw new IllegalStateError(`cannot finish expired Match in ${match.roundPhase}`);
    }
    if (!canTransition(match.roundPhase, "MATCH_COMPLETE")) {
      throw new IllegalStateError(`cannot finish expired Match in ${match.roundPhase}`);
    }
    match.roundPhase = "MATCH_COMPLETE";
    return true;
  }

  advance(match: MatchRecord): RoundAdvance {
    const target = match.currentRound >= match.totalRounds ? "MATCH_COMPLETE" : "ROUND_INTRO";
    if (!canTransition(match.roundPhase, target)) {
      throw new IllegalStateError(`cannot advance from ${match.roundPhase}`);
    }
    match.roundPhase = target;
    if (target === "MATCH_COMPLETE") {
      return { completed: true, previousRoundId: null, activityResets: [] };
    }

    const previousRound = this.currentRound(match);
    match.currentRound += 1;
    const round = this.currentRound(match);
    round.counted = {};
    round.attempts = {};
    round.runTests = {};
    round.reveal = null;
    round.closing = false;
    round.cutoffPassed = false;
    round.superseded = [];
    if (match.mode === "2v2") {
      round.readiness = {};
      round.teamDocs ??= {};
      for (const side of Object.keys(round.activities)) {
        round.teamDocs[side] = { revision: 1, language: previousRound.teamDocs?.[side]?.language ?? "Python" };
      }
    }

    return {
      completed: false,
      previousRoundId: previousRound.roundId,
      activityResets: Object.keys(round.activities).filter((side) => this.activityOf(round, side) !== "coding"),
    };
  }

  scoreVerdict(verdict: SealedVerdict): ScoredVerdict | undefined {
    const testStatuses = verdict.groups.flatMap((group) => group.results.map((result) => result.status));
    if (!testStatuses.every(isCompetitiveVerdict)) return undefined;

    const counts = verdict.groups.map((group) => ({
      weight: group.weight,
      passed: group.results.filter((result) => result.passed).length,
      total: group.results.length,
    }));
    const scoreBp = roundScoreBp(counts);
    const groups = verdict.groups.map((group, index) => {
      const count = counts[index]!;
      const earnedBp = groupEarnedBp(group.weight, count.passed, count.total);
      return {
        name: group.name,
        weight: group.weight,
        earned: roundScoreFromBp(earnedBp),
        earnedBp,
      };
    });
    return { score: roundScoreFromBp(scoreBp), scoreBp, groups, testStatuses };
  }

  computeFinal(match: MatchRecord): FinalResult {
    const sides = getMatchSides(match);
    if (match.forfeit) {
      return computeForfeitResult(match, sides, match.forfeit);
    }
    return computeCompetitiveResult(match, sides);
  }

  totalScore(match: MatchRecord, side: SideId): number {
    return matchSum(match.rounds.slice(0, match.currentRound).map((round) => round.counted[side]?.score ?? 0));
  }

  private currentRound(match: MatchRecord): RoundState {
    const round = match.rounds[match.currentRound - 1];
    if (!round) throw new IllegalStateError(`match ${match.id} has no current round`);
    return round;
  }

  private activityOf(round: RoundState, side: SideId): string {
    return round.activities[side] ?? "coding";
  }
}
