import type { MatchRecord, RevealSnapshot, SubmissionRecord } from "./records.js";
import type { CollabPersist, CollabRow } from "./collab.js";
import type { MatchStore, RevealStore, SubmissionStore } from "./store.js";
export { MatchRevisionConflictError } from "./store.js";

/** Exclusive ownership of one pending evaluation until judge/commit finishes. */
export interface EvaluationClaim {
  evaluationId: string;
  /** Throws when the durable ownership session has been lost. */
  assertActive(): void;
  release(): Promise<void>;
}

export class EvaluationClaimLostError extends Error {
  constructor(readonly evaluationId: string, readonly cause?: unknown) {
    super(`evaluation claim lost for ${evaluationId}`);
    this.name = "EvaluationClaimLostError";
  }
}

/**
 * Durable Match state owned by one module.
 *
 * ArenaEngine decides whether a state transition is valid. This interface
 * decides how that transition, a Submission, a Reveal, or a shared document
 * becomes durable. The interface is intentionally domain-shaped: callers do
 * not know whether the implementation uses Postgres, maps, or another adapter.
 */
export interface MatchPersistence {
  loadMatch(matchId: string): Promise<MatchRecord | undefined>;
  saveMatch(match: MatchRecord, expectedRevision?: number): Promise<void>;
  listMatchIds(): Promise<string[]>;
  listActiveMatchIds(): Promise<string[]>;

  recordSubmission(record: SubmissionRecord): Promise<SubmissionRecord>;
  updateSubmission(record: SubmissionRecord): Promise<void>;
  findSubmissionById(submissionId: string): Promise<SubmissionRecord | undefined>;
  findSubmissionByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined>;
  listRoundSubmissions(matchId: string, roundId: string): Promise<SubmissionRecord[]>;
  listPendingSubmissions(): Promise<SubmissionRecord[]>;
  /** Claim a pending evaluation before invoking the judge; terminal rows return no claim. */
  claimPendingEvaluation(evaluationId: string): Promise<EvaluationClaim | undefined>;
  /** Persist the verdict-side Match and Submission changes on the claim owner. */
  commitClaimedEvaluation(claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord): Promise<void>;

  publishReveal(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void>;
  findReveal(matchId: string, roundId: string): Promise<RevealSnapshot | undefined>;

  loadTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
  ): Promise<{ appRevision: number; language: string; stateB64: string } | undefined>;
  saveTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
    appRevision: number,
    language: string,
    stateB64: string,
  ): Promise<void>;
  /** MatchRecord and shared-document rows commit together when supported. */
  commitMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[], expectedRevision?: number): Promise<void>;
}

export interface MatchPersistenceAdapters {
  matches: MatchStore;
  submissions: SubmissionStore;
  reveals: RevealStore;
  collab: CollabPersist;
  /** Postgres implementation supplies the real transaction. */
  commitMatchAndTeamDocuments?: (match: MatchRecord, rows: CollabRow[], expectedRevision?: number) => Promise<void>;
  /** Postgres implementation supplies cross-process evaluation ownership. */
  claimPendingEvaluation?: (evaluationId: string) => Promise<EvaluationClaim | undefined>;
  /** Postgres implementation commits the evaluation and Match on the claim session. */
  commitClaimedEvaluation?: (claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord) => Promise<void>;
}
