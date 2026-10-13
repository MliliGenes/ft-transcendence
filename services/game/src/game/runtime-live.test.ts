import { randomUUID } from "node:crypto";
import { createServer as createHttpServer, type ServerResponse } from "node:http";
import type { SealedEvaluationRequest } from "arena-game-engine/judge";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { PostgresStores } from "arena-game-engine/persistence";

const databaseUrl = process.env.TEST_PG_URL;
const children: ChildProcess[] = [];
const sockets: Socket[] = [];
const admins: PostgresStores[] = [];
const cleanups: Array<() => Promise<void>> = [];

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const force = setTimeout(() => child.kill("SIGKILL"), 6000);
  try { await exited; } finally { clearTimeout(force); }
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await Promise.all(children.splice(0).map(stopChild));
  for (const cleanup of cleanups.splice(0)) await cleanup();
  if (databaseUrl) {
    const admin = await administration();
    await admin.raw.query("TRUNCATE matches, rounds, round_sides, submissions, reveals, match_failures, collab_documents, arena_queue_entries, arena_private_rooms, arena_private_room_members CASCADE");
  }
  await Promise.all(admins.splice(0).map((admin) => admin.close()));
});

async function launch(port: number, connectionString = databaseUrl!,
  extra: Record<string, string> = {}): Promise<{ child: ChildProcess; base: string }> {
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, PORT: String(port), DATABASE_URL: connectionString,
      DEV_PRINCIPAL: "true", JUDGE_BACKEND: "container", ...extra },
    stdio: "ignore",
  });
  children.push(child);
  return { child, base: `http://127.0.0.1:${port}` };
}

async function until<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 10000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let failure: unknown;
  while (Date.now() < deadline) {
    try { const value = await read(); if (accept(value)) return value; }
    catch (error) { failure = error; }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("live condition did not settle", { cause: failure });
}

async function health(base: string): Promise<boolean> {
  return (await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) })).ok;
}
async function request(base: string, method: string, route: string, body?: unknown) {
  const result = await fetch(`${base}${route}`, {
    method, headers: { "content-type": "application/json", "x-dev-user-id": "live-a" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
  if (!result.ok) throw new Error(`live request returned ${result.status}`);
  return result.json();
}
async function teamMatch(base: string): Promise<string> {
  const created = await request(base, "POST", "/matches", {
    mode: "2v2", participants: [
      { userId: "live-a", sideId: "left" }, { userId: "live-mate", sideId: "left" },
      { userId: "live-b", sideId: "right" }, { userId: "live-other", sideId: "right" },
    ], problemVersionIds: ["even-ledger"],
  });
  await request(base, "POST", `/matches/${created.matchId}/start`, {});
  await request(base, "POST", `/matches/${created.matchId}/begin`, {});
  return created.matchId;
}
function socketEvent(socket: Socket, event: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer); socket.off(event, accepted); socket.off("connect_error", failed);
    };
    const accepted = (...args: unknown[]) => { cleanup(); resolve(args); };
    const failed = (error: Error) => { cleanup(); reject(error); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`no socket ${event}`)); }, 8000);
    socket.once(event, accepted); socket.once("connect_error", failed);
  });
}
function connect(base: string, namespace: string, matchId: string): Socket {
  const socket = io(`${base}${namespace === "/" ? "" : namespace}`, {
    auth: { userId: "live-a", matchId }, transports: ["websocket"],
    autoConnect: false, reconnection: false,
  });
  sockets.push(socket);
  return socket;
}
async function administration(): Promise<PostgresStores> {
  const admin = new PostgresStores(databaseUrl!, { runtimeOwnership: "fixture" });
  admins.push(admin);
  return admin;
}

async function workerFixture() {
  let hold = true;
  const pending: Array<{ response: ServerResponse; body: SealedEvaluationRequest }> = [];
  const arrived: string[] = [];
  const reply = (response: ServerResponse, body: SealedEvaluationRequest) => {
    if (response.destroyed) return;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ groups: body.groups.map((group) => ({
      name: group.name, weight: group.weight,
      results: group.tests.map((test) => ({
        id: test.id, passed: true, status: "accepted", runtimeMs: 1,
      })),
    })) }));
  };
  const server = createHttpServer(async (request, response) => {
    if (request.url !== "/v1/evaluate-sealed") { response.writeHead(404).end(); return; }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as SealedEvaluationRequest;
      arrived.push(body.evaluationId);
      if (hold) pending.push({ response, body }); else reply(response, body);
    } catch { response.writeHead(400).end(); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("worker has no port");
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return {
    arrived,
    environment: { JUDGE_BACKEND: "worker", JUDGE_WORKER_URL: `http://127.0.0.1:${address.port}`,
      JUDGE_WORKER_TOKEN: "local-runtime-test", JUDGE_WORKER_TIMEOUT_MS: "60000" },
    release() { hold = false; for (const item of pending.splice(0)) reply(item.response, item.body); },
  };
}
async function duelMatch(base: string): Promise<string> {
  const created = await request(base, "POST", "/matches", {
    mode: "1v1", participants: [
      { userId: "live-a", sideId: "left" }, { userId: "live-b", sideId: "right" },
    ], problemVersionIds: ["even-ledger"],
  });
  await request(base, "POST", `/matches/${created.matchId}/start`, {});
  await request(base, "POST", `/matches/${created.matchId}/begin`, {});
  return created.matchId;
}
async function terminateOwner(admin: PostgresStores): Promise<void> {
  const found = await admin.raw.query(
    "SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND application_name = $1",
    ["arena-game-runtime-owner"],
  );
  expect(found.rows).toHaveLength(1);
  await admin.raw.query("SELECT pg_terminate_backend($1)", [found.rows[0].pid]);
}

// Expected first red: B starts normally and boot recovery changes A's Presence.
describe.skipIf(!databaseUrl)("single Game runtime live contract", () => {
  beforeEach(async () => {
    const admin = await administration(); await admin.ensureSchema();
    await admin.raw.query("TRUNCATE matches, rounds, round_sides, submissions, reveals, match_failures, collab_documents, arena_queue_entries, arena_private_rooms, arena_private_room_members CASCADE");
  });
  it("rejects a second boot before it resets the current Match", async () => {
    const a = await launch(await freePort());
    await until(() => health(a.base), Boolean);
    const matchId = await teamMatch(a.base);
    const socket = connect(a.base, "/", matchId);
    const baseline = socketEvent(socket, "snapshot"); socket.connect(); await baseline;
    const before = await request(a.base, "GET", `/matches/${matchId}/snapshot`);
    const b = await launch(await freePort());
    const outcome = await until(async () => ({
      exit: b.child.exitCode, signal: b.child.signalCode, serving: await health(b.base).catch(() => false),
    }), (value) => value.exit !== null || value.signal !== null || value.serving);
    expect(outcome.serving).toBe(false);
    expect(outcome.signal).toBeNull();
    expect(outcome.exit).toBeTypeOf("number");
    expect(outcome.exit).toBeGreaterThan(0);
    const after = await request(a.base, "GET", `/matches/${matchId}/snapshot`);
    expect(after.revision).toBe(before.revision);
    expect(after.sides).toEqual(before.sides);
    expect(after.teams).toEqual(before.teams);
    expect(after.roundPhase).toBe(before.roundPhase);
    expect(socket.connected).toBe(true);
  }, 20000);

  it("disconnects all namespaces and exits when the owner session ends", async () => {
    const a = await launch(await freePort());
    await until(() => health(a.base), Boolean);
    const matchId = await teamMatch(a.base);
    const active = ["/", "/lobby", "/chat", "/collab"].map((namespace) => connect(a.base, namespace, matchId));
    const baselines = [
      socketEvent(active[0]!, "snapshot"), socketEvent(active[1]!, "connect"),
      socketEvent(active[2]!, "authorized"), socketEvent(active[3]!, "sync"),
    ];
    active.forEach((socket) => socket.connect()); await Promise.all(baselines);
    const closes = active.map((socket) => socketEvent(socket, "disconnect"));
    const exit = once(a.child, "exit");
    const admin = await administration();
    const found = await admin.raw.query(
      "SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND application_name = $1",
      ["arena-game-runtime-owner"],
    );
    expect(found.rows).toHaveLength(1);
    const start = Date.now();
    await admin.raw.query("SELECT pg_terminate_backend($1)", [found.rows[0].pid]);
    await Promise.all(closes);
    const result = await exit;
    expect(result[0]).not.toBe(0);
    expect(Date.now() - start).toBeLessThan(6000); // 5s shutdown plus test scheduling margin
    expect(active.every((socket) => !socket.connected)).toBe(true);
  }, 20000);
it("serves an independent database while the first database is owned", async () => {
  const admin = await administration();
  const name = `arena_runtime_${randomUUID().replaceAll("-", "")}`;
  await admin.raw.query(`CREATE DATABASE "${name}"`);
  const separate = new URL(databaseUrl!); separate.pathname = `/${name}`;
  cleanups.push(async () => { await admin.raw.query(`DROP DATABASE "${name}"`); });
  const a = await launch(await freePort());
  await until(() => health(a.base), Boolean);
  const b = await launch(await freePort(), separate.toString());
  await until(() => health(b.base), Boolean);
  expect(await duelMatch(a.base)).toBeTypeOf("string");
  expect(await duelMatch(b.base)).toBeTypeOf("string");
  expect(a.child.exitCode).toBeNull(); expect(b.child.exitCode).toBeNull();
}, 20000);

it("stops a held verdict and recovers the original pending IDs on an explicit restart", async () => {
  const worker = await workerFixture();
  const a = await launch(await freePort(), databaseUrl!, worker.environment);
  await until(() => health(a.base), Boolean);
  const matchId = await duelMatch(a.base);
  const admin = await administration();
  const key = randomUUID();
  const input = { code: "def ledger_sum(nums):\n    return 0\n", language: "Python",
    submissionId: `s-${key}`, evaluationId: `e-${key}` };
  const command = fetch(`${a.base}/matches/${matchId}/submit`, {
    method: "POST", headers: { "content-type": "application/json", "x-dev-user-id": "live-a" },
    body: JSON.stringify(input), signal: AbortSignal.timeout(15000),
  }).then(async (response) => ({ status: response.status, body: await response.json() }))
    .catch(() => null);
  await until(async () => worker.arrived.includes(input.evaluationId), Boolean);
  await until(() => admin.persistence.findSubmissionByEvaluationId(input.evaluationId),
    (row) => row?.status === "pending");
  const exit = once(a.child, "exit"); const started = Date.now();
  await terminateOwner(admin);
  const ended = await exit;
  expect(ended[0]).toBeGreaterThan(0);
  expect(Date.now() - started).toBeLessThan(6000);
  const result = await command;
  expect(result === null || result.status === 503).toBe(true);
  expect((await admin.persistence.findSubmissionByEvaluationId(input.evaluationId))?.status).toBe("pending");
  worker.release(); // The old response has no saved effect.
  const b = await launch(await freePort(), databaseUrl!, worker.environment);
  await until(() => health(b.base), Boolean);
  const saved = await until(() => admin.persistence.findSubmissionByEvaluationId(input.evaluationId),
    (row) => row?.status === "completed");
  expect(saved?.submissionId).toBe(input.submissionId);
  expect(saved?.evaluationId).toBe(input.evaluationId);
  const receipt = await request(b.base, "POST", `/matches/${matchId}/submit`, input);
  expect(receipt.submissionId).toBe(input.submissionId);
  expect(receipt.evaluationId).toBe(input.evaluationId);
  const count = await admin.raw.query("SELECT count(*)::int AS n FROM submissions WHERE evaluation_id = $1", [input.evaluationId]);
  expect(count.rows[0].n).toBe(1);
  expect((await request(b.base, "GET", `/matches/${matchId}/snapshot`)).sides.left.submissions).toBe(1);
}, 30000);

});
