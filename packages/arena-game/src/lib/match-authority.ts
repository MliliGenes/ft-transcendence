import type { AuthenticatedPrincipal } from "./principal.js";
import type { EvaluationClaim, MatchPersistence } from "./persistence-types.js";
import type { CollabRow } from "./collab.js";
import type { MatchRecord, RoundState, SideId, SubmissionRecord } from "./records.js";

export class NotMemberError extends Error {
  readonly code = 403;
  constructor(matchId: string) {
    super(`principal is not a participant of match ${matchId}`);
    this.name = "NotMemberError";
  }
}

export class IllegalStateError extends Error {
  readonly code = 409;
  constructor(message: string) {
    super(message);
    this.name = "IllegalStateError";
  }
}

export interface MatchLockResult<T> {
  value: T;
  /** Latest revision from a successful read or acknowledged durable write. */
  revision?: number;
}

/**
 * Match authority owns the shared command mechanics around Match state:
 * membership resolution, per-Match serialization, and revision stamping.
 * It does not know about sockets, judge execution, or database adapters.
 */
export class MatchAuthority {
  private readonly matchLocks = new Map<string, Promise<void>>();
  private readonly lockRevision = new Map<string, number>();
  private readonly lockBaseRevision = new Map<string, number | undefined>();
  private readonly lockPersisted = new Set<string>();
  private readonly lockLastState = new Map<string, string | null>();
  private readonly lockSnapshots = new Map<string, MatchRecord>();

  constructor(
    private readonly persistence: MatchPersistence,
    /** Called under the lock with durable state, before the next command enters. */
    private readonly settled?: (match: MatchRecord) => void,
  ) {}

  /**
   * Serialize short Match mutations. Long judge calls stay outside this
   * lock; callers re-enter for the final accepted result. The persistence
   * module performs the durable write and this module supplies the revision
   * used by events emitted during the command.
   */
  async withLock<T>(matchId: string, fn: () => Promise<T>): Promise<MatchLockResult<T>> {
    const { prev, tail, release } = this.acquireLockSlot(matchId);
    await prev;
    let durable: MatchRecord | undefined;
    try {
      await this.enterLockState(matchId);
      const result = await fn();
      durable = await this.loadDurableState(matchId);
      return { value: result, revision: durable?.revision };
    } finally {
      this.cleanupLock(matchId, tail, release, durable);
    }
  }

  private acquireLockSlot(matchId: string): { prev: Promise<void>; tail: Promise<void>; release: () => void } {
    const prev = this.matchLocks.get(matchId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prev.then(() => mine);
    this.matchLocks.set(matchId, tail);
    return { prev, tail, release };
  }

  private async enterLockState(matchId: string): Promise<void> {
    const beforeRow = await this.persistence.loadMatch(matchId);
    this.lockBaseRevision.set(matchId, beforeRow?.revision);
    this.lockRevision.set(matchId, (beforeRow?.revision ?? 0) + 1);
    this.lockPersisted.delete(matchId);
    this.lockLastState.set(matchId, beforeRow ? this.stateText(beforeRow) : null);
    if (beforeRow) this.lockSnapshots.set(matchId, structuredClone(beforeRow));
  }

  private async loadDurableState(matchId: string): Promise<MatchRecord | undefined> {
    try {
      return await this.persistence.loadMatch(matchId);
    } catch (error) {
      const fallback = this.lockSnapshots.get(matchId);
      if (!fallback) throw error;
      console.error("Match revision read failed; using confirmed state", error);
      return fallback;
    }
  }

  private resolveFinalDurable(matchId: string, durable?: MatchRecord): MatchRecord | undefined {
    const confirmed = this.lockSnapshots.get(matchId);
    if (confirmed && (!durable || confirmed.revision >= durable.revision)) {
      return confirmed;
    }
    return durable;
  }

  private cleanupLock(matchId: string, tail: Promise<void>, release: () => void, durable?: MatchRecord): void {
    const finalDurable = this.resolveFinalDurable(matchId, durable);
    try {
      if (finalDurable) this.settled?.(finalDurable);
    } catch {
      // Resource retirement is retryable on the next locked read.
    }
    release();
    this.lockRevision.delete(matchId);
    this.lockBaseRevision.delete(matchId);
    this.lockPersisted.delete(matchId);
    this.lockLastState.delete(matchId);
    this.lockSnapshots.delete(matchId);
    if (this.matchLocks.get(matchId) === tail) this.matchLocks.delete(matchId);
  }

  revisionFor(matchId: string): number | undefined {
    return this.lockRevision.get(matchId);
  }

  /** Persist an ordinary Match mutation through the active optimistic lock. */
  async saveMatch(match: MatchRecord): Promise<void> {
    const nextRevision = this.lockRevision.get(match.id);
    if (nextRevision === undefined) {
      await this.persistence.saveMatch(match);
      return;
    }
    const state = this.stateText(match);
    if (this.lockLastState.get(match.id) === state) return;
    const expectedRevision = this.lockPersisted.has(match.id)
      ? nextRevision
      : this.lockBaseRevision.get(match.id);
    const committedRevision = this.lockPersisted.has(match.id) ? nextRevision + 1 : nextRevision;
    match.revision = committedRevision;
    await this.persistence.saveMatch(match, expectedRevision);
    this.lockRevision.set(match.id, committedRevision);
    this.lockPersisted.add(match.id);
    this.lockLastState.set(match.id, state);
    this.lockSnapshots.set(match.id, structuredClone(match));
  }

  /** Persist Match + shared-document rows through the active optimistic lock. */
  async saveMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[]): Promise<void> {
    const nextRevision = this.lockRevision.get(match.id);
    if (nextRevision === undefined) {
      await this.persistence.commitMatchAndTeamDocuments(match, rows);
      return;
    }
    const state = this.stateText(match);
    if (this.lockLastState.get(match.id) === state) return;
    const expectedRevision = this.lockPersisted.has(match.id)
      ? nextRevision
      : this.lockBaseRevision.get(match.id);
    const committedRevision = this.lockPersisted.has(match.id) ? nextRevision + 1 : nextRevision;
    match.revision = committedRevision;
    await this.persistence.commitMatchAndTeamDocuments(match, rows, expectedRevision);
    this.lockRevision.set(match.id, committedRevision);
    this.lockPersisted.add(match.id);
    this.lockLastState.set(match.id, state);
    this.lockSnapshots.set(match.id, structuredClone(match));
  }

  /** Keep claim-session commits and their confirmed revision in one command operation. */
  async commitClaimedEvaluation(claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord): Promise<void> {
    match.revision = Math.max(this.lockRevision.get(match.id) ?? 0, match.revision + 1);
    await this.persistence.commitClaimedEvaluation(claim, match, submission);
    this.lockRevision.set(match.id, match.revision);
    this.lockPersisted.add(match.id);
    this.lockLastState.set(match.id, this.stateText(match));
    this.lockSnapshots.set(match.id, structuredClone(match));
  }

  private stateText(match: MatchRecord): string {
    const snapshot = structuredClone(match);
    snapshot.revision = 0;
    return JSON.stringify(snapshot);
  }

  async requireMember(principal: AuthenticatedPrincipal, matchId: string): Promise<MatchRecord> {
    const match = await this.loadOrThrow(matchId);
    if (!match.participants.some((participant) => participant.userId === principal.userId)) {
      throw new NotMemberError(matchId);
    }
    return match;
  }

  async loadOrThrow(matchId: string): Promise<MatchRecord> {
    const match = await this.persistence.loadMatch(matchId);
    if (!match) throw new NotMemberError(matchId);
    if (this.lockBaseRevision.has(matchId) && !this.lockPersisted.has(matchId)) {
      this.lockSnapshots.set(matchId, structuredClone(match));
    }
    return match;
  }

  sideOf(match: MatchRecord, principal: AuthenticatedPrincipal): SideId {
    const participant = match.participants.find((candidate) => candidate.userId === principal.userId);
    if (!participant) throw new NotMemberError(match.id);
    return participant.sideId;
  }

  currentRound(match: MatchRecord): RoundState {
    const round = match.rounds[match.currentRound - 1];
    if (!round) throw new IllegalStateError(`match ${match.id} has no current round`);
    return round;
  }
}
