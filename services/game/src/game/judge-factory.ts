import {
  ContainerJudge,
  Judge0Adapter,
  WorkerJudgeAdapter,
  type GameJudge,
} from "arena-game-engine/judge";

export type JudgeEnvironment = Readonly<Record<string, string | undefined>>;

function configuredPositiveInteger(environment: JudgeEnvironment, name: string): number | undefined {
  const raw = environment[name]?.trim();
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function buildWorkerJudge(environment: JudgeEnvironment, signal?: AbortSignal): WorkerJudgeAdapter {
  const baseUrl = environment.JUDGE_WORKER_URL?.trim();
  if (!baseUrl) throw new Error("JUDGE_WORKER_URL is required when JUDGE_BACKEND=worker");
  const token = environment.JUDGE_WORKER_TOKEN?.trim();
  if (!token) throw new Error("JUDGE_WORKER_TOKEN is required when JUDGE_BACKEND=worker");
  return new WorkerJudgeAdapter({
    baseUrl,
    token,
    timeoutMs: configuredPositiveInteger(environment, "JUDGE_WORKER_TIMEOUT_MS"),
    signal,
  });
}

function buildJudge0Judge(environment: JudgeEnvironment): Judge0Adapter {
  const baseUrl = environment.JUDGE0_URL?.trim();
  if (!baseUrl) throw new Error("JUDGE0_URL is required when JUDGE_BACKEND=judge0");
  const authToken = environment.JUDGE0_AUTH_TOKEN?.trim();
  return new Judge0Adapter({
    baseUrl,
    headers: authToken ? { "X-Auth-Token": authToken } : {},
    languageIds: {
      C: Number(environment.JUDGE0_C_LANGUAGE_ID ?? 50),
      "C++": Number(environment.JUDGE0_CPP_LANGUAGE_ID ?? 54),
      Python: Number(environment.JUDGE0_PYTHON_LANGUAGE_ID ?? 71),
    },
    pollIntervalMs: Number(environment.JUDGE0_POLL_INTERVAL_MS ?? 250),
    maxPolls: Number(environment.JUDGE0_MAX_POLLS ?? 120),
  });
}

/** Select one GameJudge provider at process startup; provider failures never trigger fallback. */
export function createGameJudge(environment: JudgeEnvironment = process.env, signal?: AbortSignal): GameJudge {
  const backend = (environment.JUDGE_BACKEND ?? "container").trim().toLowerCase();
  switch (backend) {
    case "container":
      return new ContainerJudge();
    case "worker":
      return buildWorkerJudge(environment, signal);
    case "judge0":
      return buildJudge0Judge(environment);
    default:
      throw new Error(`unsupported JUDGE_BACKEND ${backend}`);
  }
}
