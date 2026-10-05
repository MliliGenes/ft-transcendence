import type { PoolClient } from "pg";
import type { MatchRecord } from "../records.js";
import { MatchRevisionConflictError } from "../store.js";

/** Match-row writes against an already-open transaction client. */
export async function saveMatchTx(client: PoolClient, match: MatchRecord, expectedRevision?: number): Promise<void> {
  const storedMatch =
    expectedRevision !== undefined && match.revision <= expectedRevision
      ? { ...structuredClone(match), revision: expectedRevision + 1 }
      : match;
  if (expectedRevision === undefined) {
    await client.query(`INSERT INTO matches (id, data) VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [storedMatch.id, JSON.stringify(storedMatch)]);
  } else {
    const updated = await client.query(
      `UPDATE matches
       SET data = $2
       WHERE id = $1 AND COALESCE((data->>'revision')::integer, 0) = $3`,
      [storedMatch.id, JSON.stringify(storedMatch), expectedRevision],
    );
    if (updated.rowCount !== 1) {
      const current = await client.query("SELECT data FROM matches WHERE id = $1", [storedMatch.id]);
      const actualRevision = current.rowCount === 1 ? (current.rows[0].data as MatchRecord).revision : undefined;
      throw new MatchRevisionConflictError(storedMatch.id, expectedRevision, actualRevision);
    }
  }
  for (let idx = 0; idx < storedMatch.rounds.length; idx++) {
    const round = storedMatch.rounds[idx]!;
    await client.query(
      `INSERT INTO rounds (match_id, idx, round_id, problem_version_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id, idx) DO UPDATE SET round_id = EXCLUDED.round_id, problem_version_id = EXCLUDED.problem_version_id`,
      [storedMatch.id, idx, round.roundId, round.problemVersionId],
    );
    for (const [sideId, activity] of Object.entries(round.activities)) {
      const counted = round.counted[sideId];
      await client.query(
        `INSERT INTO round_sides (match_id, round_id, side_id, activity, attempts, counted_score, scoring_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id, round_id, side_id) DO UPDATE SET
           activity = EXCLUDED.activity, attempts = EXCLUDED.attempts,
           counted_score = EXCLUDED.counted_score, scoring_time_ms = EXCLUDED.scoring_time_ms`,
        [storedMatch.id, round.roundId, sideId, activity ?? "coding", round.attempts[sideId] ?? 0, counted?.score ?? null, counted?.scoringTimeMs ?? null],
      );
    }
  }
}
