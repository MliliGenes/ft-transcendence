import {
  type CaseResult,
  type DriverKind,
  type ExecutionStatus,
  GameJudge,
  JudgeInfraError,
  type JudgeLimits,
  type SealedEvaluationRequest,
  type SealedGroupResult,
  type SnippetOptions,
  type SupportedLanguage,
  type VisibleTest,
} from "./judge-types.js";

export interface WorkerJudgeAdapterOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

const STATUSES = new Set<ExecutionStatus>([
  "accepted",
  "compile_error",
  "runtime_error",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "output_limit_exceeded",
  "process_limit_exceeded",
  "internal_error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidExecutionStatus(status: unknown): status is ExecutionStatus {
  return typeof status === "string" && STATUSES.has(status as ExecutionStatus);
}

function isValidRuntimeMs(ms: unknown): ms is number {
  return typeof ms === "number" && Number.isFinite(ms) && ms >= 0;
}

function parseCaseResult(value: unknown): CaseResult | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.passed !== "boolean"
    || !isValidExecutionStatus(value.status) || typeof value.output !== "string"
    || !isValidRuntimeMs(value.runtimeMs)) return null;
  return {
    id: value.id,
    passed: value.passed,
    status: value.status,
    output: value.output,
    runtimeMs: value.runtimeMs,
  };
}

function parseSealedCaseResult(item: unknown): SealedGroupResult["results"][number] | null {
  if (!isRecord(item) || typeof item.id !== "string" || typeof item.passed !== "boolean"
    || !isValidExecutionStatus(item.status) || !isValidRuntimeMs(item.runtimeMs)) return null;
  return {
    id: item.id,
    passed: item.passed,
    status: item.status,
    runtimeMs: item.runtimeMs,
  };
}

function parseSealedGroup(value: unknown): SealedGroupResult | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.weight !== "number"
    || !Number.isFinite(value.weight) || !Array.isArray(value.results)) return null;
  const results = value.results.map(parseSealedCaseResult);
  if (results.some((item) => item === null)) return null;
  return { name: value.name, weight: value.weight, results: results as SealedGroupResult["results"] };
}

function parseWorkerEndpoint(baseUrl: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl);
  } catch {
    throw new Error("JUDGE_WORKER_URL must be an absolute HTTP URL");
  }
  if ((endpoint.protocol !== "http:" && endpoint.protocol !== "https:") || endpoint.username || endpoint.password) {
    throw new Error("JUDGE_WORKER_URL must be an absolute HTTP URL without embedded credentials");
  }
  return endpoint;
}

function parseWorkerTimeout(timeoutMs?: number): number {
  const timeout = timeoutMs ?? 930000;
  if (!Number.isFinite(timeout) || timeout < 1) throw new Error("worker timeout must be positive");
  return timeout;
}

function assertSealedGroupMatches(
  actual: SealedGroupResult,
  expected: SealedEvaluationRequest["groups"][number],
): void {
  if (actual.name !== expected.name || actual.weight !== expected.weight || actual.results.length !== expected.tests.length
    || actual.results.some((item, testIndex) => item.id !== expected.tests[testIndex]?.id)) {
    throw new JudgeInfraError("judge worker returned mismatched sealed cases");
  }
}

/** Game-side transport adapter. It has no provider fallback by design. */
export class WorkerJudgeAdapter implements GameJudge {


  readonly provider = "worker";
  private readonly endpoint: URL;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly signal?: AbortSignal;

  constructor(options: WorkerJudgeAdapterOptions) {
    const token = options.token.trim();
    if (!token) throw new Error("JUDGE_WORKER_TOKEN is required");
    this.endpoint = parseWorkerEndpoint(options.baseUrl);
    this.token = token;
    this.timeoutMs = parseWorkerTimeout(options.timeoutMs);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.signal = options.signal;
  }

  async runVisible(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    tests: VisibleTest[],
    limits: JudgeLimits,
    snippet?: SnippetOptions,
  ): Promise<CaseResult[]> {
    const result = await this.post("/v1/run-visible", { language, driver, source, tests, limits, ...snippet });
    if (!Array.isArray(result) || result.length !== tests.length) {
      throw new JudgeInfraError("judge worker returned an invalid visible result");
    }
    const cases = result.map(parseCaseResult);
    if (cases.some((item) => item === null)) throw new JudgeInfraError("judge worker returned an invalid visible result");
    const typedCases = cases as CaseResult[];
    if (typedCases.some((item, index) => item.id !== tests[index]?.id)) {
      throw new JudgeInfraError("judge worker returned mismatched visible cases");
    }
    return typedCases;
  }

  async evaluateSealed(request: SealedEvaluationRequest): Promise<{ groups: SealedGroupResult[] }> {
    const result = await this.post("/v1/evaluate-sealed", request);
    if (!isRecord(result) || !Array.isArray(result.groups) || result.groups.length !== request.groups.length) {
      throw new JudgeInfraError("judge worker returned an invalid sealed result");
    }
    const groups = result.groups.map(parseSealedGroup);
    if (groups.some((item) => item === null)) throw new JudgeInfraError("judge worker returned an invalid sealed result");
    const typedGroups = groups as SealedGroupResult[];
    for (let groupIndex = 0; groupIndex < typedGroups.length; groupIndex++) {
      assertSealedGroupMatches(typedGroups[groupIndex]!, request.groups[groupIndex]!);
    }
    return { groups: typedGroups };
  }

  private createRequestSignal(): { signal: AbortSignal; checkCanceled: () => void } {
    const signal = this.signal
      ? AbortSignal.any([this.signal, AbortSignal.timeout(this.timeoutMs)])
      : AbortSignal.timeout(this.timeoutMs);
    const checkCanceled = () => {
      if (signal.aborted) {
        throw new JudgeInfraError(this.signal?.aborted ? "Game runtime stopped" : "judge worker request timed out");
      }
    };
    return { signal, checkCanceled };
  }

  private async parseJsonResponse(response: Response, checkCanceled: () => void): Promise<unknown> {
    try {
      const result: unknown = await response.json();
      checkCanceled();
      return result;
    } catch {
      checkCanceled();
      throw new JudgeInfraError("judge worker returned invalid JSON");
    }
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const { signal, checkCanceled } = this.createRequestSignal();
    checkCanceled();
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.endpoint), {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      checkCanceled();
      throw new JudgeInfraError("judge worker request failed");
    }
    checkCanceled();
    if (!response.ok) throw new JudgeInfraError(`judge worker returned HTTP ${response.status}`);
    return this.parseJsonResponse(response, checkCanceled);
  }
}
