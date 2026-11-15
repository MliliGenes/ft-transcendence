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
import { isCompetitiveVerdict, type ExecutionStatus } from "./judge.js";
import { IllegalStateError } from "./match-authority.js";
import type { CountedResult, GroupResult, MatchRecord, RevealSnapshot, RoundState, SideId, SideProgress } from "./records.js";

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

export interface SideAdvance {
  finished: boolean;
  previousRoundId: string;
  newRoundId?: string;
  activityResets: SideId[];
}

export interface RevealInput {
  scores: Partial<Record<SideId, number>>;
  groups: RevealSnapshot["groups"];
  totals: Partial<Record<SideId, number>>;
  publishedAt: number;
  cause?: RevealCause;
  noSubmission?: Partial<Record<SideId, boolean>>;
}

function matchSides(match: MatchRecord): [SideId, SideId] {
  const fromActivities = Object.keys(match.rounds[0]?.activities ?? {});
  if (fromActivities.length === 2) return [fromActivities[0]!, fromActivities[1]!];

  const fromParticipants: SideId[] = [];
  for (const p of match.participants ?? []) {
    if (p.sideId && !fromParticipants.includes(p.sideId)) {
      fromParticipants.push(p.sideId);
    }
  }
  if (fromParticipants.length === 2) return [fromParticipants[0]!, fromParticipants[1]!];

  const fromCounted = Object.keys(match.rounds[0]?.counted ?? {});
  if (fromCounted.length === 2) return [fromCounted[0]!, fromCounted[1]!];

  throw new Error("Cannot determine match sides: match record must have exactly two distinct sides");
}

export function computeFinal(match: MatchRecord): FinalResult {
  const sides = matchSides(match);
  const [left, right] = sides;

  if (match.forfeit) {
    const scores: Partial<Record<SideId, number>> = {};
    for (const side of sides) {
      scores[side] = matchSum((match.rounds ?? []).map((round) => round.counted?.[side]?.score ?? 0));
    }
    const winner = match.forfeit.winner;
    return {
      scores,
      outcome: winner === left ? "left" : winner === right ? "right" : "draw",
      winner,
      forfeit: { ...match.forfeit },
    };
  }

  const contributions = (side: SideId) =>
    (match.rounds ?? []).map((round) => ({
      score: round.counted?.[side]?.score ?? 0,
      scoringTimeMs: round.counted?.[side]?.scoringTimeMs ?? 0,
      submissions: round.attempts?.[side] ?? 0,
    }));
  const outcome = compareSides(contributions(left), contributions(right));
  const scores: Partial<Record<SideId, number>> = {};
  for (const side of sides) scores[side] = matchSum(contributions(side).map((contribution) => contribution.score));
  return { scores, outcome, winner: outcome === "draw" ? null : outcome === "left" ? left : right, forfeit: null };
}

/**
 * Match/Round state machine rules that do not need persistence, sockets, or
 * judge execution. ArenaEngine keeps the transport-facing facade and owns
 * locking/events; this module owns the deeper Round transitions and scoring
 * invariants behind that facade.
 */
export class RoundLifecycle {
  startRound(match: MatchRecord): void {
    if (!canTransition(match.roundPhase, "ROUND_INTRO")) {
      throw new IllegalStateError(`cannot start round in ${match.roundPhase}`);
    }
    match.roundPhase = "ROUND_INTRO";
  }

  beginCoding(match: MatchRecord, startedAtMs: number, problemCapMs: number): void {
    if (match.roundPhase !== "CODING" && !canTransition(match.roundPhase, "CODING")) {
      throw new IllegalStateError(`cannot begin coding in ${match.roundPhase}`);
    }
    match.roundPhase = "CODING";
    const matchDeadline = match.startedAt + match.durationMs;
    match.sideProgress ??= {};
    for (const side of this.matchSides(match)) {
      if (!match.sideProgress[side]) {
        match.sideProgress[side] = {
          currentRound: 1,
          stage: "CODING",
          problemDeadlineMs: Math.min(startedAtMs + problemCapMs, matchDeadline),
          finishedAtMs: null,
        };
      } else if (match.sideProgress[side]!.stage === "CODING" && match.sideProgress[side]!.problemDeadlineMs == null) {
        match.sideProgress[side]!.problemDeadlineMs = Math.min(startedAtMs + problemCapMs, matchDeadline);
      }
      match.rounds[0]!.activities[side] = "coding";
    }
    this.syncCurrentRound(match);
  }

  advanceSide(match: MatchRecord, side: SideId, nowMs: number, problemCapMs: number): SideAdvance {
    if (match.roundPhase !== "CODING") throw new IllegalStateError(`cannot advance side in ${match.roundPhase}`);
    const progress = match.sideProgress?.[side];
    if (!progress || progress.stage !== "CODING") throw new IllegalStateError(`side ${side} is not coding`);
    const previous = match.rounds[progress.currentRound - 1];
    if (!previous) throw new IllegalStateError(`side ${side} has no current round`);
    previous.activities[side] = "locked";
    if (progress.currentRound >= match.totalRounds) {
      progress.stage = "FINISHED";
      progress.finishedAtMs = nowMs;
      progress.problemDeadlineMs = null;
      this.syncCurrentRound(match);
      return { finished: true, previousRoundId: previous.roundId, activityResets: [] };
    }
    progress.currentRound += 1;
    progress.problemDeadlineMs = Math.min(nowMs + problemCapMs, match.startedAt + match.durationMs);
    const next = match.rounds[progress.currentRound - 1];
    if (!next) throw new IllegalStateError(`side ${side} has no next round`);
    next.activities[side] = "coding";
    next.runTests[side] = undefined;
    if (match.mode === "2v2") {
      const users = new Set(match.participants.filter((participant) => participant.sideId === side).map((participant) => participant.userId));
      for (const userId of users) delete next.readiness?.[userId];
      next.teamDocs ??= {};
      const language = previous.teamDocs?.[side]?.language ?? "Python";
      next.teamDocs[side] = { revision: 1, language };
    }
    this.syncCurrentRound(match);
    return { finished: false, previousRoundId: previous.roundId, newRoundId: next.roundId, activityResets: [side] };
  }

  bothFinished(match: MatchRecord): boolean {
    return this.matchSides(match).every((side) => match.sideProgress?.[side]?.stage === "FINISHED");
  }

  expiredSides(match: MatchRecord, nowMs: number): SideId[] {
    return this.matchSides(match).filter((side) => {
      const progress = match.sideProgress?.[side];
      return progress?.stage === "CODING" && progress.problemDeadlineMs != null && nowMs >= progress.problemDeadlineMs;
    });
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
    return Object.freeze({
      round: match.currentRound,
      roundId: round.roundId,
      scores: Object.freeze({ ...input.scores }),
      groups: Object.freeze({ ...input.groups }),
      totals: Object.freeze({ ...input.totals }),
      publishedAt: input.publishedAt,
      ...(input.cause ? { cause: input.cause } : {}),
      ...(input.noSubmission ? { noSubmission: Object.freeze({ ...input.noSubmission }) } : {}),
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
    round.codingDeadlineMs = null;
    if (match.mode === "2v2") {
      round.readiness = {};
      round.teamDocs ??= {};
      for (const side of Object.keys(round.activities)) {
        round.teamDocs[side] = { revision: 1, language: round.teamDocs[side]?.language ?? "Python" };
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
    return computeFinal(match);
  }

  totalScore(match: MatchRecord, side: SideId): number {
    return matchSum(match.rounds.map((round) => round.counted[side]?.score ?? 0));
  }

  private matchSides(match: MatchRecord): SideId[] {
    const sides = Object.keys(match.sideProgress ?? {});
    if (sides.length === 2) return sides;
    return Object.keys(match.rounds[0]?.activities ?? {});
  }

  private syncCurrentRound(match: MatchRecord): void {
    match.currentRound = Math.max(1, ...Object.values(match.sideProgress ?? {}).map((progress) => progress?.currentRound ?? 1));
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
