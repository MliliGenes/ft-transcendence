import { Pool, type PoolClient } from "pg";
import { saveMatchTx } from "./match-write.js";
import type { MatchRecord, RevealSnapshot, SubmissionRecord } from "./records.js";
import type { CollabPersist, CollabRow } from "./collab.js";
import {
  EvaluationClaimLostError,
  type EvaluationClaim,
  type MatchPersistence,
} from "./persistence-types.js";
import { StoreBackedMatchPersistence } from "./persistence-module.js";
import { DuplicateError, type MatchStore, type RevealStore, type SubmissionStore } from "./store.js";

export const GAME_SCHEMA = `
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS rounds (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  round_id TEXT NOT NULL UNIQUE,
  problem_version_id TEXT NOT NULL,
  PRIMARY KEY (match_id, idx)
);
CREATE TABLE IF NOT EXISTS round_sides (
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(round_id) ON DELETE CASCADE,
  side_id TEXT NOT NULL,
  activity TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  counted_score INTEGER,
  scoring_time_ms BIGINT,
  PRIMARY KEY (match_id, round_id, side_id)
);
CREATE TABLE IF NOT EXISTS submissions (
  submission_id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL UNIQUE,
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS reveals (
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  published_at BIGINT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (match_id, round_id)
);
CREATE TABLE IF NOT EXISTS match_failures (
  match_id TEXT NOT NULL,
  idx SERIAL PRIMARY KEY,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collab_documents (
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  side_id TEXT NOT NULL,
  app_revision INTEGER NOT NULL,
  language TEXT NOT NULL,
  ydoc_state TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (match_id, round_id, side_id)
);
`;

/**
 * Postgres-backed stores (ticket 09): unique match/round/submission/evaluation
 * identities, one counted row per side per round, one reveal row per round.
 * A match saves as one JSONB row (single-statement atomicity); submissions
 * move pending->terminal via update; reveals insert once (primary key rejects
 * duplicates). Idempotent retries read the stored row first, so a restart
 * changes nothing: same ids return the same outcome with no new attempt, and
 * a pending row left by a crash is re-driven under its original ids.
 */
import { LobbyStore, LOBBY_SCHEMA } from "./lobby-store.js";
import { GuardedSql } from "./guarded-sql.js";
import { RuntimeOwnership, RuntimeOwnershipLostError } from "./runtime-ownership.js";
import { randomUUID } from "node:crypto";

class ClaimClientHandle {
  lockHeld = false;
  private released = false;
  private failure?: EvaluationClaimLostError | RuntimeOwnershipLostError;
  private releasePromise?: Promise<void>;
  private readonly onError: (error: Error) => void;

  constructor(
    readonly evaluationId: string,
    readonly client: PoolClient,
    private readonly assertRuntime: () => void,
    private readonly forget: () => void,
  ) {
    this.onError = (error) => this.destroy(new EvaluationClaimLostError(evaluationId, error));
    client.on("error", this.onError);
  }

  assertActive(): void {
    if (this.failure) throw this.failure;
    this.assertRuntime();
    if (this.released) throw new EvaluationClaimLostError(this.evaluationId);
  }

  destroy(error: EvaluationClaimLostError | RuntimeOwnershipLostError): void {
    if (this.released) return;
    this.failure = error;
    this.released = true;
    this.forget();
    // Retain the listener on a destroyed client so a late connection error is handled.
    this.client.release(true);
  }

  release(): Promise<void> {
    if (!this.releasePromise) {
      this.releasePromise = (async () => {
        if (this.released) return;
        let destroy = false;
        try {
          if (this.lockHeld) {
            await this.client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [this.evaluationId]);
          }
        } catch {
          destroy = true;
        } finally {
          if (!this.released) {
            this.released = true;
            this.forget();
            this.client.removeListener("error", this.onError);
            this.client.release(destroy);
          }
        }
      })();
    }
    return this.releasePromise;
  }
}

class PostgresEvaluationClaim implements EvaluationClaim {
  constructor(
    readonly evaluationId: string,
    readonly client: PoolClient,
    private readonly assertFn: () => void,
    private readonly releaseFn: () => Promise<void>,
  ) {}

  assertActive(): void {
    this.assertFn();
  }

  release(): Promise<void> {
    return this.releaseFn();
  }
}

export class PostgresStores {
  readonly persistence: MatchPersistence;
  readonly matches: MatchStore;
  readonly submissions: SubmissionStore;
  readonly reveals: RevealStore;
  readonly collab: CollabPersist;
  readonly lobby: LobbyStore;
  private readonly pool: Pool;
  private readonly claimPool: Pool;
  private readonly runtime?: RuntimeOwnership;
  private readonly sql: GuardedSql;
  private readonly fixture: boolean;
  private closing = false;
  private closePromise?: Promise<void>;
  private readonly claimClients = new Set<ClaimClientHandle>();

  constructor(connectionString: string, options: {
    runtimeOwnership?: "required" | "fixture";
  } = {}) {
    this.fixture = options.runtimeOwnership === "fixture";
    this.runtime = this.fixture ? undefined : new RuntimeOwnership(connectionString);
    this.pool = new Pool({ connectionString });
    this.claimPool = new Pool({ connectionString });
    this.pool.on("error", () => console.error("Game write pool error"));
    this.claimPool.on("error", () => console.error("Game claim pool error"));
    this.sql = new GuardedSql(
      this.pool,
      () => this.assertRuntimeActive(),
      async (client) => { await this.runtime?.guard(client); },
    );
    this.matches = new PostgresMatchStore(this.pool, this.sql);
    this.submissions = new PostgresSubmissionStore(this.pool, this.sql);
    this.reveals = new PostgresRevealStore(this.pool, this.sql);
    this.collab = new PostgresCollabStore(this.pool, this.sql);
    this.lobby = new LobbyStore(this.pool, Date.now, randomUUID, this.sql);
    this.persistence = new StoreBackedMatchPersistence({
      matches: this.matches, submissions: this.submissions,
      reveals: this.reveals, collab: this.collab,
      commitMatchAndTeamDocuments: (match, rows, expectedRevision) => this.saveMatchAndCollab(match, rows, expectedRevision),
      claimPendingEvaluation: (evaluationId) => this.claimPendingEvaluation(evaluationId),
      commitClaimedEvaluation: (claim, match, submission) => this.commitClaimedEvaluation(claim, match, submission),
    });
  }

  async acquireRuntime(options: {
    onLost?: (error: RuntimeOwnershipLostError) => void;
  } = {}): Promise<void> {
    if (this.fixture || this.closing || !this.runtime) {
      throw new RuntimeOwnershipLostError("This store cannot acquire production runtime ownership");
    }
    await this.runtime.acquire((error) => {
      for (const handle of [...this.claimClients]) handle.destroy(error);
      options.onLost?.(error);
    });
  }

  assertRuntimeActive(): void {
    if (this.closing) throw new RuntimeOwnershipLostError("Game stores are closing");
    this.runtime?.assertActive();
  }

  get runtimeActive(): boolean {
    return !this.closing && (this.fixture || this.runtime?.active === true);
  }

  get raw(): Pool {
    if (!this.fixture) throw new Error("Raw SQL requires runtimeOwnership: fixture");
    return this.pool;
  }

  async ensureSchema(): Promise<void> {
    await this.sql.transaction(async (client) => {
      await client.query(GAME_SCHEMA);
      await client.query(LOBBY_SCHEMA);
    });
  }

  async recordFailure(matchId: string, message: string): Promise<void> {
    await this.sql.transaction(async (client) => {
      await client.query("INSERT INTO match_failures (match_id, message) VALUES ($1, $2)", [matchId, message]);
    });
  }


  async saveMatchAndCollab(match: MatchRecord, rows: CollabRow[], expectedRevision?: number): Promise<void> {
    await this.sql.transaction(async (client) => {
      await saveMatchTx(client, match, expectedRevision);
      for (const row of rows) {
        await client.query(
          `INSERT INTO collab_documents (match_id, round_id, side_id, app_revision, language, ydoc_state, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (match_id, round_id, side_id) DO UPDATE SET
             app_revision = EXCLUDED.app_revision, language = EXCLUDED.language,
             ydoc_state = EXCLUDED.ydoc_state, updated_at = EXCLUDED.updated_at`,
          [match.id, row.roundId, row.sideId, row.appRevision, row.language, row.stateB64, Date.now()],
        );
      }
    });
  }


  async claimPendingEvaluation(evaluationId: string): Promise<EvaluationClaim | undefined> {
    this.assertRuntimeActive();
    const client = await this.claimPool.connect();
    let handle!: ClaimClientHandle;
    handle = new ClaimClientHandle(evaluationId, client,
      () => this.assertRuntimeActive(), () => this.claimClients.delete(handle));
    this.claimClients.add(handle);
    try {
      // A close may have happened while pool acquisition was pending.
      handle.assertActive();
      await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [evaluationId]);
      handle.lockHeld = true;
      handle.assertActive();
      const stored = await this.sql.onClient(client, async (claimedClient) => {
        const result = await claimedClient.query("SELECT data FROM submissions WHERE evaluation_id = $1", [evaluationId]);
        return result.rows[0]?.data as SubmissionRecord | undefined;
      });
      handle.assertActive();
      if (!stored || stored.status !== "pending") {
        await handle.release();
        return undefined;
      }
      return new PostgresEvaluationClaim(evaluationId, client,
        () => handle.assertActive(), () => handle.release());
    } catch (error) {
      // Force-destroy releases waiting/held locks without a pending-row mutation.
      let failure: EvaluationClaimLostError | RuntimeOwnershipLostError =
        error instanceof RuntimeOwnershipLostError || error instanceof EvaluationClaimLostError
          ? error : new EvaluationClaimLostError(evaluationId, error);
      try { handle.assertActive(); }
      catch (recorded) {
        if (recorded instanceof RuntimeOwnershipLostError || recorded instanceof EvaluationClaimLostError) failure = recorded;
      }
      handle.destroy(failure);
      throw failure;
    }
  }

  async commitClaimedEvaluation(claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord): Promise<void> {
    this.assertRuntimeActive();
    if (!(claim instanceof PostgresEvaluationClaim)) {
      throw new Error("Postgres persistence requires a Postgres evaluation claim");
    }
    claim.assertActive();
    await this.sql.onClient(claim.client, async (client) => {
      claim.assertActive();
      if (submission) {
        const updated = await client.query(
          "UPDATE submissions SET data = $2 WHERE evaluation_id = $1 AND data->>'status' = 'pending'",
          [submission.evaluationId, JSON.stringify(submission)],
        );
        if (updated.rowCount !== 1) throw new EvaluationClaimLostError(claim.evaluationId);
      }
      await saveMatchTx(client, match);
      claim.assertActive();
    });
  }

  close(): Promise<void> {
    if (!this.closePromise) {
      this.closing = true;
      this.runtime?.stopAdmission();
      const reason = new RuntimeOwnershipLostError("Game stores were closed");
      for (const handle of [...this.claimClients]) handle.destroy(reason);
      this.closePromise = (async () => {
        try {
          const outcomes = await Promise.allSettled([this.pool.end(), this.claimPool.end()]);
          const failed = outcomes.find((result) => result.status === "rejected");
          if (failed?.status === "rejected") throw failed.reason;
        } finally {
          // Normal stop holds startup admission while ordinary writes drain.
          await this.runtime?.close();
        }
      })();
    }
    return this.closePromise;
  }

}

class PostgresMatchStore implements MatchStore {
  constructor(private readonly pool: Pool, private readonly sql: GuardedSql) {}

  async save(match: MatchRecord, expectedRevision?: number): Promise<void> {
    await this.sql.transaction((client) => saveMatchTx(client, match, expectedRevision));
  }

  async load(matchId: string): Promise<MatchRecord | undefined> {
    const res = await this.pool.query("SELECT data FROM matches WHERE id = $1", [matchId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as MatchRecord;
  }

  async listIds(): Promise<string[]> {
    const res = await this.pool.query("SELECT id FROM matches");
    return res.rows.map((r) => r.id as string);
  }
}

class PostgresSubmissionStore implements SubmissionStore {
  constructor(private readonly pool: Pool, private readonly sql: GuardedSql) {}

  async append(record: SubmissionRecord): Promise<void> {
    await this.sql.transaction(async (client) => {
      await client.query(
        `INSERT INTO submissions (submission_id, evaluation_id, match_id, round_id, data)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (submission_id) DO NOTHING`,
        [record.submissionId, record.evaluationId, record.matchId, record.roundId, JSON.stringify(record)],
      );
    });
  }

  async update(record: SubmissionRecord): Promise<void> {
    await this.sql.transaction(async (client) => {
      await client.query("UPDATE submissions SET data = $2 WHERE submission_id = $1", [record.submissionId, JSON.stringify(record)]);
    });
  }

  async getBySubmissionId(submissionId: string): Promise<SubmissionRecord | undefined> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE submission_id = $1", [submissionId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as SubmissionRecord;
  }

  async getByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE evaluation_id = $1", [evaluationId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as SubmissionRecord;
  }

  async listRound(matchId: string, roundId: string): Promise<SubmissionRecord[]> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE match_id = $1 AND round_id = $2", [
      matchId,
      roundId,
    ]);
    return res.rows.map((r) => r.data as SubmissionRecord);
  }

  async listPending(): Promise<SubmissionRecord[]> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE data->>'status' = 'pending'");
    return res.rows.map((r) => r.data as SubmissionRecord);
  }
}

class PostgresCollabStore implements CollabPersist {
  constructor(private readonly pool: Pool, private readonly sql: GuardedSql) {}

  async save(matchId: string, roundId: string, sideId: string, appRevision: number, language: string, stateB64: string): Promise<void> {
    await this.sql.transaction(async (client) => {
      await client.query(
        `INSERT INTO collab_documents (match_id, round_id, side_id, app_revision, language, ydoc_state, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id, round_id, side_id) DO UPDATE SET
           app_revision = EXCLUDED.app_revision, language = EXCLUDED.language,
           ydoc_state = EXCLUDED.ydoc_state, updated_at = EXCLUDED.updated_at`,
        [matchId, roundId, sideId, appRevision, language, stateB64, Date.now()],
      );
    });
  }

  async load(matchId: string, roundId: string, sideId: string) {
    const res = await this.pool.query(
      "SELECT app_revision, language, ydoc_state FROM collab_documents WHERE match_id = $1 AND round_id = $2 AND side_id = $3",
      [matchId, roundId, sideId],
    );
    if (res.rowCount === 0) return undefined;
    const row = res.rows[0];
    return { appRevision: row.app_revision as number, language: row.language as string, stateB64: row.ydoc_state as string };
  }
}

class PostgresRevealStore implements RevealStore {
  constructor(private readonly pool: Pool, private readonly sql: GuardedSql) {}

  async record(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void> {
    try {
      await this.sql.transaction(async (client) => {
        await client.query("INSERT INTO reveals (match_id, round_id, published_at, data) VALUES ($1, $2, $3, $4)",
          [matchId, roundId, snapshot.publishedAt, JSON.stringify(snapshot)]);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new DuplicateError(`reveal already published for round ${roundId}`);
      }
      throw error;
    }
  }

  async get(matchId: string, roundId: string): Promise<RevealSnapshot | undefined> {
    const res = await this.pool.query("SELECT data FROM reveals WHERE match_id = $1 AND round_id = $2", [
      matchId,
      roundId,
    ]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as RevealSnapshot;
  }
}
