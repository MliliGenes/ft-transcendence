import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { type SubmissionRecord } from "../src/index.js";
import {
  PostgresStores,
  RuntimeAlreadyOwnedError,
  RuntimeOwnershipLostError,
  type EvaluationClaim,
} from "../src/persistence.js";
import { setup, SOLVED_PY, tick } from "./setup.js";

const url = process.env.TEST_PG_URL;
const tables = [
  "matches", "rounds", "round_sides", "submissions", "reveals",
  "match_failures", "collab_documents", "arena_queue_entries",
  "arena_private_rooms", "arena_private_room_members",
] as const;

async function until(check: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 4000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("database barrier did not arrive");
    await tick();
  }
}

describe.runIf(Boolean(url))("one production runtime per PostgreSQL database", () => {
  let observer: PostgresStores;
  const stores: PostgresStores[] = [];
  let barrier: PoolClient | undefined;

  function required(): PostgresStores {
    if (!url) throw new Error("TEST_PG_URL is required");
    const store = new PostgresStores(url);
    stores.push(store);
    return store;
  }

  async function owner(onLost?: (error: RuntimeOwnershipLostError) => void) {
    const store = required();
    await store.acquireRuntime({ onLost });
    await store.ensureSchema();
    return store;
  }

  async function savedRows(): Promise<unknown[]> {
    return Promise.all(tables.map(async (table) => {
      const rows = await observer.raw.query(
        `SELECT row_to_json(t) AS row FROM ${table} t ORDER BY row_to_json(t)::text`,
      );
      return rows.rows;
    }));
  }

  async function terminateLeader(): Promise<void> {
    const found = await observer.raw.query(
      `SELECT a.pid FROM pg_stat_activity a
       WHERE a.datname = current_database()
         AND a.application_name = 'arena-game-runtime-owner'`,
    );
    expect(found.rowCount).toBe(1);
    await observer.raw.query("SELECT pg_terminate_backend($1)", [found.rows[0]!.pid]);
  }

  function pending(matchId: string, roundId: string): SubmissionRecord {
    const key = randomUUID();
    return {
      submissionId: `submission-${key}`, evaluationId: `evaluation-${key}`,
      matchId, roundId, sideId: "left", problemVersionId: "even-ledger",
      language: "Python", source: SOLVED_PY, sourceHash: `hash-${key}`,
      documentRevision: null, submittedAt: 1_000_000, elapsedMatchMs: 0,
      status: "pending", score: null, scoreBp: null, groups: null,
      testStatuses: null, failureCode: null,
    };
  }

  beforeEach(async () => {
    if (!url) throw new Error("TEST_PG_URL is required");
    observer = new PostgresStores(url, { runtimeOwnership: "fixture" });
    await observer.ensureSchema();
    await observer.raw.query(`TRUNCATE ${tables.join(", ")} CASCADE`);
  });

  afterEach(async () => {
    if (barrier) {
      await barrier.query("ROLLBACK").catch(() => {});
      barrier.release();
      barrier = undefined;
    }
    await Promise.all(stores.splice(0).map((store) => store.close()));
    await observer.close();
  });

  it("requires acquisition, blocks a duplicate before schema work, and admits restart", async () => {
    const first = required();
    expect(first.runtimeActive).toBe(false);
    expect(() => first.assertRuntimeActive()).toThrow(RuntimeOwnershipLostError);
    await expect(first.ensureSchema()).rejects.toBeInstanceOf(RuntimeOwnershipLostError);
    await first.acquireRuntime();
    await first.acquireRuntime(); // No second reentrant lock acquisition.
    await first.ensureSchema();
    const before = (await observer.raw.query("SELECT boot_id FROM arena_runtime_ownership")).rows;
    const rows = await savedRows();
    const second = required();
    await expect(second.acquireRuntime()).rejects.toBeInstanceOf(RuntimeAlreadyOwnedError);
    expect(second.runtimeActive).toBe(false);
    await expect(second.ensureSchema()).rejects.toBeInstanceOf(RuntimeOwnershipLostError);
    expect(await savedRows()).toEqual(rows);
    expect((await observer.raw.query("SELECT boot_id FROM arena_runtime_ownership")).rows).toEqual(before);
    expect(() => first.raw).toThrow(/fixture/);
    await first.close();
    await first.close();
    const replacement = await owner();
    expect(replacement.runtimeActive).toBe(true);
    expect((await observer.raw.query("SELECT boot_id FROM arena_runtime_ownership")).rows).not.toEqual(before);
  });

  it("keeps fixture stores independent and prevents reopening a closed required store", async () => {
    const first = await owner();
    await observer.ensureSchema();
    const fx = await setup([], { persistence: observer.persistence });
    expect(await observer.matches.load(fx.matchId)).toBeDefined();
    await first.close();
    expect(first.runtimeActive).toBe(false);
    await expect(first.acquireRuntime()).rejects.toBeInstanceOf(RuntimeOwnershipLostError);
    expect(observer.runtimeActive).toBe(true);
  });

  it("waits for an admitted shared-row transaction before a new boot becomes active", async () => {
    const lost: RuntimeOwnershipLostError[] = [];
    const first = await owner((error) => lost.push(error));
    barrier = await observer.raw.connect();
    await barrier.query("BEGIN");
    await barrier.query("SELECT boot_id FROM arena_runtime_ownership WHERE singleton_id = 1 FOR SHARE");
    const before = (await observer.raw.query("SELECT boot_id FROM arena_runtime_ownership")).rows;
    await terminateLeader();
    await until(() => !first.runtimeActive);
    const replacement = required();
    const acquired = replacement.acquireRuntime();
    // Observe PostgreSQL waiting, instead of assuming a delay proves a lock.
    await until(async () => {
      const res = await observer.raw.query(
        `SELECT 1 FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock'
           AND application_name = 'arena-game-runtime-owner'
           AND query LIKE '%FOR UPDATE%'`,
      );
      return res.rowCount === 1;
    });
    expect(replacement.runtimeActive).toBe(false);
    expect((await observer.raw.query("SELECT boot_id FROM arena_runtime_ownership")).rows).toEqual(before);
    await barrier.query("COMMIT");
    barrier.release();
    barrier = undefined;
    await acquired;
    expect(replacement.runtimeActive).toBe(true);
    expect(lost).toHaveLength(1);
    await expect(first.ensureSchema()).rejects.toBeInstanceOf(RuntimeOwnershipLostError);
  });

  it("destroys owned and waiting claim clients before draining pools", async () => {
    const first = await owner();
    const fx = await setup([], { persistence: first.persistence });
    const match = (await first.matches.load(fx.matchId))!;
    const active = pending(match.id, match.rounds[0]!.roundId);
    const blocked = pending(match.id, match.rounds[0]!.roundId);
    await first.persistence.recordSubmission(active);
    await first.persistence.recordSubmission(blocked);
    const owned = (await first.persistence.claimPendingEvaluation(active.evaluationId))!;
    const otherClaim = (await observer.persistence.claimPendingEvaluation(blocked.evaluationId))!;
    const waiting = first.persistence.claimPendingEvaluation(blocked.evaluationId);
    const rejected = expect(waiting).rejects.toBeInstanceOf(RuntimeOwnershipLostError);
    await until(async () => {
      const res = await observer.raw.query(
        `SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
         AND wait_event_type = 'Lock' AND query LIKE 'SELECT pg_advisory_lock%'`,
      );
      return (res.rowCount ?? 0) > 0;
    });
    await first.close();
    await first.close();
    await rejected;
    expect(() => owned.assertActive()).toThrow();
    await owned.release();
    await owned.release();
    const recovered = await observer.persistence.claimPendingEvaluation(active.evaluationId);
    expect(recovered).toBeDefined();
    await recovered!.release();
    await otherClaim.release();
    expect((await observer.persistence.findSubmissionByEvaluationId(active.evaluationId))?.status).toBe("pending");
    expect((await observer.persistence.findSubmissionByEvaluationId(blocked.evaluationId))?.status).toBe("pending");
  }, 6000);

  it("loses ownership while judging, releases the claim and preserves the pending row", async () => {
    const first = await owner();
    const fx = await setup([{ defer: true }], { persistence: first.persistence });
    const key = randomUUID();
    const resultEvents: string[] = [];
    fx.engine.on((event, payload) => {
      if (event === "player.statusChanged" && (payload as { status?: string }).status === "coding") resultEvents.push(event);
    });
    const submission = fx.engine.submit(fx.left, fx.matchId, {
      code: SOLVED_PY, language: "Python", submissionId: `s-${key}`, evaluationId: `e-${key}`,
    });
    const rejected = expect(submission).rejects.toThrow();
    await until(() => fx.judge.evalCalls === 1);
    await terminateLeader();
    await until(() => !first.runtimeActive);
    const reclaim = await observer.persistence.claimPendingEvaluation(`e-${key}`);
    expect(reclaim).toBeDefined();
    await reclaim!.release();
    fx.judge.release({ score: 100 });
    await rejected;
    expect(resultEvents).toEqual([]);
    expect((await observer.persistence.findSubmissionByEvaluationId(`e-${key}`))?.status).toBe("pending");
  });

  const operations = [
    "schema", "match", "submission-insert", "submission-update", "reveal",
    "failure", "document", "match-document", "evaluation", "queue-join",
    "queue-cancel", "queue-match", "room-create", "room-join", "room-leave",
    "room-side", "room-ready", "room-start", "lobby-schema",
  ] as const;

  it.each(operations)("fences %s before any domain row change", async (operation) => {
    const first = await owner();
    const fx = await setup([], { persistence: first.persistence });
    const match = (await first.matches.load(fx.matchId))!;
    const record = pending(match.id, match.rounds[0]!.roundId);
    await first.persistence.recordSubmission(record);
    const prefix = randomUUID();
    const host = `${prefix}-host`;
    const guest = `${prefix}-guest`;
    const room = await first.lobby.createPrivateRoom(host, "1v1");
    await first.lobby.joinPrivateRoom(guest, room.room.code);
    await first.lobby.setRoomMemberReady(host, room.room.id, true);
    await first.lobby.setRoomMemberReady(guest, room.room.id, true);
    await first.lobby.joinQueue(`${prefix}-q1`, "1v1");
    await first.lobby.joinQueue(`${prefix}-q2`, "1v1");
    let claim: EvaluationClaim | undefined;
    if (operation === "evaluation") claim = await first.persistence.claimPendingEvaluation(record.evaluationId);
    const before = await savedRows();
    // Simulate a superseded token without relying on local error delivery.
    await observer.raw.query("UPDATE arena_runtime_ownership SET boot_id = $1 WHERE singleton_id = 1", [randomUUID()]);
    const create = (input: Parameters<typeof fx.engine.createMatch>[0], save?: Parameters<typeof fx.engine.createMatch>[1]) => fx.engine.createMatch(input, save);
    const writes: Record<typeof operations[number], () => Promise<unknown>> = {
      schema: () => first.ensureSchema(),
      match: () => first.persistence.saveMatch({ ...match, revision: match.revision + 1 }, match.revision),
      "submission-insert": () => first.persistence.recordSubmission(pending(match.id, record.roundId)),
      "submission-update": () => first.persistence.updateSubmission({ ...record, status: "failed" }),
      reveal: () => first.reveals.record(match.id, record.roundId, {
        round: match.currentRound, roundId: record.roundId,
        publishedAt: 1, groups: {}, scores: {}, totals: {},
      }),
      failure: () => first.recordFailure(match.id, "must not persist"),
      document: () => first.collab.save(match.id, record.roundId, "left", 1, "Python", "AA=="),
      "match-document": () => first.persistence.commitMatchAndTeamDocuments(
        { ...match, revision: match.revision + 1 },
        [{ roundId: record.roundId, sideId: "left", appRevision: 1, language: "Python", stateB64: "AA==" }],
        match.revision,
      ),
      evaluation: () => first.persistence.commitClaimedEvaluation(claim!, match, { ...record, status: "completed", score: 100 }),
      "queue-join": () => first.lobby.joinQueue(`${prefix}-q3`, "1v1"),
      "queue-cancel": () => first.lobby.cancelQueue(`${prefix}-q1`),
      "queue-match": () => first.lobby.tryMatch("1v1", ["even-ledger"], create),
      "room-create": () => first.lobby.createPrivateRoom(`${prefix}-new`, "1v1"),
      "room-join": () => first.lobby.joinPrivateRoom(`${prefix}-new`, room.room.code),
      "room-leave": () => first.lobby.leavePrivateRoom(guest, room.room.id),
      "room-side": () => first.lobby.setRoomMemberSide(guest, room.room.id, "left"),
      "room-ready": () => first.lobby.setRoomMemberReady(guest, room.room.id, false),
      "room-start": () => first.lobby.startPrivateRoom(host, room.room.id, ["even-ledger"], create),
      "lobby-schema": () => first.lobby.ensureSchema(),
    };
    await expect(writes[operation]()).rejects.toBeInstanceOf(RuntimeOwnershipLostError);
    expect(first.runtimeActive).toBe(false);
    expect(await savedRows()).toEqual(before);
    await claim?.release();
  });

  it("allows another Match write while one Match write is blocked", async () => {
    const first = await owner();
    const one = await setup([], { persistence: first.persistence });
    const two = await setup([], { persistence: first.persistence });
    const oneMatch = (await first.matches.load(one.matchId))!;
    const twoMatch = (await first.matches.load(two.matchId))!;
    barrier = await observer.raw.connect();
    await barrier.query("BEGIN");
    await barrier.query("SELECT id FROM matches WHERE id = $1 FOR UPDATE", [one.matchId]);
    const blocked = first.persistence.saveMatch({ ...oneMatch, revision: oneMatch.revision + 1 }, oneMatch.revision);
    await until(async () => {
      const res = await observer.raw.query(
        `SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
         AND wait_event_type = 'Lock' AND query LIKE 'UPDATE matches%'`,
      );
      return (res.rowCount ?? 0) > 0;
    });
    await first.persistence.saveMatch({ ...twoMatch, revision: twoMatch.revision + 1 }, twoMatch.revision);
    expect((await observer.matches.load(two.matchId))?.revision).toBe(twoMatch.revision + 1);
    await barrier.query("COMMIT");
    barrier.release();
    barrier = undefined;
    await blocked;
  });
});
