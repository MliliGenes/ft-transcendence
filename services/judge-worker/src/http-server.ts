import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type {
  DriverKind,
  GameJudge,
  JudgeLimits,
  SealedEvaluationRequest,
  SnippetOptions,
  SupportedLanguage,
  VisibleTest,
} from "arena-game-engine/judge";
import {
  BoundedJobQueue,
  QueueExecutionTimeoutError,
  QueueFullError,
  QueueWaitTimeoutError,
} from "./job-queue.js";
import type { JudgeReadinessProbe } from "./readiness.js";

export interface JudgeWorkerServerOptions {
  token: string;
  judge: GameJudge;
  queue: BoundedJobQueue;
  readiness: JudgeReadinessProbe;
  maxBodyBytes?: number;
}

class BodyTooLargeError extends Error {
  constructor() {
    super("request body too large");
    this.name = "BodyTooLargeError";
  }
}

class InvalidRequestError extends Error {
  constructor() {
    super("invalid judge request");
    this.name = "InvalidRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLanguage(value: unknown): value is SupportedLanguage {
  return value === "C" || value === "C++" || value === "Python";
}

function isDriver(value: unknown): value is DriverKind {
  return value === "snippet" || value === "stdio";
}

function isLimits(value: unknown): value is JudgeLimits {
  if (!isRecord(value)) return false;
  return [
    value.compileWallMs,
    value.runWallMs,
    value.runMemoryMb,
    value.runOutputBytes,
    value.runCpus,
    value.runPids,
  ].every((number) => typeof number === "number" && Number.isFinite(number) && number > 0);
}

function isStringField(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string";
}

function isOptionalIdentifier(value: unknown): boolean {
  return value === undefined || typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function parseSnippetOptions(value: Record<string, unknown>): SnippetOptions {
  if (!isOptionalIdentifier(value.entrypoint) || !isOptionalIdentifier(value.className)
    || (value.signature !== undefined && value.signature !== "int64-array")) {
    throw new InvalidRequestError();
  }
  return {
    ...(value.entrypoint !== undefined ? { entrypoint: value.entrypoint as string } : {}),
    ...(value.className !== undefined ? { className: value.className as string } : {}),
    ...(value.signature !== undefined ? { signature: "int64-array" as const } : {}),
  };
}

type ExecutionRequest = Pick<SealedEvaluationRequest, "language" | "driver" | "source" | "limits"> & SnippetOptions;

function parseExecutionRequest(value: Record<string, unknown>): ExecutionRequest {
  if (!isLanguage(value.language) || !isDriver(value.driver)
    || !isStringField(value, "source") || !isLimits(value.limits)) {
    throw new InvalidRequestError();
  }
  return {
    language: value.language,
    driver: value.driver,
    source: value.source as string,
    ...parseSnippetOptions(value),
    limits: value.limits,
  };
}

function parseTest(value: unknown): VisibleTest {
  if (!isRecord(value) || !isStringField(value, "id") || !isStringField(value, "input") || !isStringField(value, "expected")) {
    throw new InvalidRequestError();
  }
  return { id: value.id as string, input: value.input as string, expected: value.expected as string };
}

function parseVisibleRequest(value: unknown): ExecutionRequest & { tests: VisibleTest[] } {
  if (!isRecord(value) || !Array.isArray(value.tests)) throw new InvalidRequestError();
  return { ...parseExecutionRequest(value), tests: value.tests.map(parseTest) };
}

function parseSealedGroup(value: unknown): SealedEvaluationRequest["groups"][number] {
  if (!isRecord(value) || !isStringField(value, "name") || typeof value.weight !== "number"
    || !Number.isFinite(value.weight) || value.weight < 0 || !Array.isArray(value.tests)) {
    throw new InvalidRequestError();
  }
  return { name: value.name as string, weight: value.weight, tests: value.tests.map(parseTest) };
}

function parseSealedRequest(value: unknown): SealedEvaluationRequest {
  if (!isRecord(value) || !["evaluationId", "submissionId", "problemVersionId", "hiddenSuiteId"].every((key) => isStringField(value, key))
    || !Array.isArray(value.groups)) {
    throw new InvalidRequestError();
  }
  return {
    ...parseExecutionRequest(value),
    evaluationId: value.evaluationId as string,
    submissionId: value.submissionId as string,
    problemVersionId: value.problemVersionId as string,
    hiddenSuiteId: value.hiddenSuiteId as string,
    groups: value.groups.map(parseSealedGroup),
  };
}

async function readJsonBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  let tooLarge = Number.isFinite(declaredLength) && declaredLength > maxBytes;
  let total = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > maxBytes) tooLarge = true;
    if (!tooLarge) chunks.push(buffer);
  }
  if (tooLarge) throw new BodyTooLargeError();
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new InvalidRequestError();
  }
}

function authenticated(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers.authorization;
  if (typeof header !== "string") return false;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) return false;
  const expectedDigest = createHash("sha256").update(expectedToken).digest();
  const providedDigest = createHash("sha256").update(match[1]!).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

function respond(serverResponse: import("node:http").ServerResponse, status: number, body: unknown): void {
  if (serverResponse.writableEnded || serverResponse.destroyed) return;
  const json = JSON.stringify(body);
  serverResponse.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  serverResponse.end(json);
}

function errorResponse(error: unknown): { status: number; body: { error: string } } {
  const name = error instanceof Error ? error.name : "";
  if (error instanceof BodyTooLargeError) return { status: 413, body: { error: "request body too large" } };
  if (error instanceof InvalidRequestError || name === "ValidationError") {
    return { status: 400, body: { error: "invalid judge request" } };
  }
  if (error instanceof QueueFullError) return { status: 429, body: { error: "judge queue is full" } };
  if (error instanceof QueueWaitTimeoutError) return { status: 503, body: { error: "judge queue timed out" } };
  if (error instanceof QueueExecutionTimeoutError) return { status: 504, body: { error: "judge job timed out" } };
  if (name === "JudgeInfraError") return { status: 503, body: { error: "judge unavailable" } };
  return { status: 500, body: { error: "judge request failed" } };
}

async function handleReadiness(
  readiness: JudgeReadinessProbe,
  response: import("node:http").ServerResponse,
): Promise<void> {
  try {
    const checks = await readiness.check();
    respond(response, checks.ready ? 200 : 503, { ready: checks.ready, checks });
  } catch {
    respond(response, 503, { ready: false, checks: { docker: false } });
  }
}

async function ensureJudgeReady(
  readiness: JudgeReadinessProbe,
  response: import("node:http").ServerResponse,
): Promise<boolean> {
  try {
    const check = await readiness.check();
    if (check.ready) return true;
  } catch {
    // readiness check threw
  }
  respond(response, 503, { error: "judge unavailable" });
  return false;
}

async function executeVisibleRun(
  options: JudgeWorkerServerOptions,
  body: unknown,
  response: import("node:http").ServerResponse,
): Promise<void> {
  const input = parseVisibleRequest(body);
  const result = await options.queue.run(() => options.judge.runVisible(
    input.language, input.driver, input.source, input.tests, input.limits,
    { entrypoint: input.entrypoint, signature: input.signature, className: input.className },
  ));
  respond(response, 200, result);
}

async function executeSealedEvaluation(
  options: JudgeWorkerServerOptions,
  body: unknown,
  response: import("node:http").ServerResponse,
): Promise<void> {
  const input = parseSealedRequest(body);
  const result = await options.queue.run(() => options.judge.evaluateSealed(input));
  respond(response, 200, result);
}

async function handleGetRoutes(
  path: string,
  readiness: JudgeReadinessProbe,
  response: import("node:http").ServerResponse,
): Promise<boolean> {
  if (path === "/health") {
    respond(response, 200, { status: "ok" });
    return true;
  }
  if (path === "/ready") {
    await handleReadiness(readiness, response);
    return true;
  }
  return false;
}

function checkJudgeRoute(
  method: string | undefined,
  path: string,
  response: import("node:http").ServerResponse,
): "visible" | "sealed" | null {
  const visible = method === "POST" && path === "/v1/run-visible";
  const sealed = method === "POST" && path === "/v1/evaluate-sealed";
  if (!visible && !sealed) {
    const isV1 = path.startsWith("/v1/");
    respond(response, isV1 ? 405 : 404, { error: isV1 ? "method not allowed" : "not found" });
    return null;
  }
  return visible ? "visible" : "sealed";
}

async function dispatchWorkerRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  options: JudgeWorkerServerOptions,
  maxBodyBytes: number,
): Promise<void> {
  const path = new URL(request.url ?? "/", "http://judge-worker.internal").pathname;
  if (request.method === "GET" && await handleGetRoutes(path, options.readiness, response)) return;

  const route = checkJudgeRoute(request.method, path, response);
  if (!route) return;

  if (!authenticated(request, options.token)) {
    respond(response, 401, { error: "unauthorized" });
    return;
  }

  if (!await ensureJudgeReady(options.readiness, response)) return;

  const body = await readJsonBody(request, maxBodyBytes);
  if (route === "visible") {
    await executeVisibleRun(options, body, response);
    return;
  }
  await executeSealedEvaluation(options, body, response);
}

/** Internal-only HTTP transport for the existing GameJudge contract. */
export function createJudgeWorkerServer(options: JudgeWorkerServerOptions): Server {
  if (!options.token.trim()) throw new Error("JUDGE_WORKER_TOKEN is required");
  const maxBodyBytes = options.maxBodyBytes ?? 2 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) throw new Error("maxBodyBytes must be positive");

  const server = createServer((request, response) => {
    void dispatchWorkerRequest(request, response, options, maxBodyBytes).catch((error: unknown) => {
      const result = errorResponse(error);
      respond(response, result.status, result.body);
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return server;
}
