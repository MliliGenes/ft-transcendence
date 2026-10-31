import { InMemoryCollabPersist, type CollabRow } from "./collab.js";
import type { MatchRecord, RevealSnapshot, SubmissionRecord } from "./records.js";
import {
  DuplicateError,
  InMemoryMatchStore,
  InMemoryRevealStore,
  InMemorySubmissionStore,
} from "./store.js";
import type {
  EvaluationClaim,
  MatchPersistence,
  MatchPersistenceAdapters,
} from "./persistence-types.js";

function immutableSubmissionView(record: SubmissionRecord): string {
  return JSON.stringify({
    submissionId: record.submissionId,
    evaluationId: record.evaluationId,
    matchId: record.matchId,
    roundId: record.roundId,
    sideId: record.sideId,
    problemVersionId: record.problemVersionId,
    language: record.language,
    source: record.source,
    sourceHash: record.sourceHash,
    documentRevision: record.documentRevision ?? null,
    submittedAt: record.submittedAt,
    elapsedMatchMs: record.elapsedMatchMs,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/**
 * Adapter implementation used by both production and tests.
 *
 * Keeping this orchestration here gives ArenaEngine one small seam while
 * preserving the current MatchStore/SubmissionStore/RevealStore adapters
 * during the migration. It also centralizes idempotency rules that used to be
 * scattered across the engine and database implementations.
 */
export class StoreBackedMatchPersistence implements MatchPersistence {
  private readonly localClaims = new Map<string, Promise<void>>();

  constructor(private readonly adapters: MatchPersistenceAdapters) {}

  loadMatch(matchId: string): Promise<MatchRecord | undefined> {
    return this.adapters.matches.load(matchId);
  }

  saveMatch(match: MatchRecord, expectedRevision?: number): Promise<void> {
    return this.adapters.matches.save(match, expectedRevision);
  }

  listMatchIds(): Promise<string[]> {
    return this.adapters.matches.listIds();
  }

  listActiveMatchIds(): Promise<string[]> {
    if (this.adapters.matches.listActiveIds) {
      return this.adapters.matches.listActiveIds();
    }
    return this.adapters.matches.listIds();
  }

  private async findExistingSubmission(submissionId: string, evaluationId: string): Promise<SubmissionRecord | undefined> {
    const bySubmission = await this.adapters.submissions.getBySubmissionId(submissionId);
    if (bySubmission) return bySubmission;
    return await this.adapters.submissions.getByEvaluationId(evaluationId);
  }

  private assertSubmissionMatches(existing: SubmissionRecord, target: SubmissionRecord): SubmissionRecord {
    if (immutableSubmissionView(existing) !== immutableSubmissionView(target)) {
      throw new DuplicateError("submission or evaluation id is already bound to different data");
    }
    return existing;
  }

  private async handleUniqueInsertConflict(error: unknown, record: SubmissionRecord): Promise<SubmissionRecord> {
    if (!isUniqueViolation(error)) throw error;
    const winner = await this.findExistingSubmission(record.submissionId, record.evaluationId);
    if (!winner) throw error;
    return this.assertSubmissionMatches(winner, record);
  }

  async recordSubmission(record: SubmissionRecord): Promise<SubmissionRecord> {
    const existing = await this.findExistingSubmission(record.submissionId, record.evaluationId);
    if (existing) {
      return this.assertSubmissionMatches(existing, record);
    }

    try {
      await this.adapters.submissions.append(record);
    } catch (error) {
      return await this.handleUniqueInsertConflict(error, record);
    }

    const stored = await this.findExistingSubmission(record.submissionId, record.evaluationId);
    if (!stored) return record;
    return this.assertSubmissionMatches(stored, record);
  }

  updateSubmission(record: SubmissionRecord): Promise<void> {
    return this.adapters.submissions.update(record);
  }

  findSubmissionById(submissionId: string): Promise<SubmissionRecord | undefined> {
    return this.adapters.submissions.getBySubmissionId(submissionId);
  }

  findSubmissionByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined> {
    return this.adapters.submissions.getByEvaluationId(evaluationId);
  }

  listRoundSubmissions(matchId: string, roundId: string): Promise<SubmissionRecord[]> {
    return this.adapters.submissions.listRound(matchId, roundId);
  }

  listPendingSubmissions(): Promise<SubmissionRecord[]> {
    return this.adapters.submissions.listPending();
  }

  async claimPendingEvaluation(evaluationId: string): Promise<EvaluationClaim | undefined> {
    if (this.adapters.claimPendingEvaluation) {
      return this.adapters.claimPendingEvaluation(evaluationId);
    }

    const previous = this.localClaims.get(evaluationId) ?? Promise.resolve();
    let releaseQueued!: () => void;
    const queued = previous.then(
      () =>
        new Promise<void>((resolve) => {
          releaseQueued = resolve;
        }),
    );
    this.localClaims.set(evaluationId, queued);
    await previous;

    try {
      const stored = await this.adapters.submissions.getByEvaluationId(evaluationId);
      if (!stored || stored.status !== "pending") {
        releaseQueued();
        if (this.localClaims.get(evaluationId) === queued) this.localClaims.delete(evaluationId);
        return undefined;
      }
    } catch (error) {
      releaseQueued();
      if (this.localClaims.get(evaluationId) === queued) this.localClaims.delete(evaluationId);
      throw error;
    }

    let released = false;
    return {
      evaluationId,
      assertActive: () => {},
      release: async () => {
        if (released) return;
        released = true;
        releaseQueued();
        await queued;
        if (this.localClaims.get(evaluationId) === queued) this.localClaims.delete(evaluationId);
      },
    };
  }

  async commitClaimedEvaluation(claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord): Promise<void> {
    claim.assertActive();
    if (this.adapters.commitClaimedEvaluation) {
      await this.adapters.commitClaimedEvaluation(claim, match, submission);
      return;
    }
    if (submission) await this.updateSubmission(submission);
    await this.saveMatch(match);
  }

  publishReveal(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void> {
    return this.adapters.reveals.record(matchId, roundId, snapshot);
  }

  findReveal(matchId: string, roundId: string): Promise<RevealSnapshot | undefined> {
    return this.adapters.reveals.get(matchId, roundId);
  }

  loadTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
  ): Promise<{ appRevision: number; language: string; stateB64: string } | undefined> {
    return this.adapters.collab.load(matchId, roundId, sideId);
  }

  saveTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
    appRevision: number,
    language: string,
    stateB64: string,
  ): Promise<void> {
    return this.adapters.collab.save(matchId, roundId, sideId, appRevision, language, stateB64);
  }

  async commitMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[], expectedRevision?: number): Promise<void> {
    if (this.adapters.commitMatchAndTeamDocuments) {
      await this.adapters.commitMatchAndTeamDocuments(match, rows, expectedRevision);
      return;
    }
    // In-memory implementations are already serialized by ArenaEngine's
    // match lock. Production supplies the one-transaction implementation.
    await this.saveMatch(match, expectedRevision);
    for (const row of rows) {
      await this.saveTeamDocument(match.id, row.roundId, row.sideId, row.appRevision, row.language, row.stateB64);
    }
  }
}

export function inMemoryPersistence(): MatchPersistence {
  return new StoreBackedMatchPersistence({
    matches: new InMemoryMatchStore(),
    submissions: new InMemorySubmissionStore(),
    reveals: new InMemoryRevealStore(),
    collab: new InMemoryCollabPersist(),
  });
}
