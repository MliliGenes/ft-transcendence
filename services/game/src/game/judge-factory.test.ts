import { describe, expect, it, vi } from "vitest";

const modulePath = "./judge-factory.js";

async function loadFactory(): Promise<any> {
  let loaded: any;
  try { loaded = await import(modulePath); } catch { loaded = null; }
  expect(loaded?.createGameJudge).toBeTypeOf("function");
  return loaded;
}

describe("Game judge backend selection", () => {
  it("keeps the local runner as the development default and preserves Judge0", async () => {
    const { createGameJudge } = await loadFactory();
    expect(createGameJudge({}).provider).toBe("container");
    expect(createGameJudge({ JUDGE_BACKEND: "judge0", JUDGE0_URL: "http://judge0.internal" }).provider).toBe("judge0");
  });

  it("selects only an explicitly configured worker and fails closed when its settings are missing", async () => {
    const { createGameJudge } = await loadFactory();
    const judge = createGameJudge({
      JUDGE_BACKEND: "worker",
      JUDGE_WORKER_URL: "http://judge-worker:3010",
      JUDGE_WORKER_TOKEN: "worker-token",
    });
    expect(judge.provider).toBe("worker");
    expect(() => createGameJudge({ JUDGE_BACKEND: "worker", JUDGE_WORKER_TOKEN: "worker-token" })).toThrow(/JUDGE_WORKER_URL/);
    expect(() => createGameJudge({ JUDGE_BACKEND: "worker", JUDGE_WORKER_URL: "http://judge-worker:3010" })).toThrow(/JUDGE_WORKER_TOKEN/);
    expect(() => createGameJudge({ JUDGE_BACKEND: "worker" })).toThrow(/JUDGE_WORKER_URL/);
  });

  it("rejects unsupported backends instead of silently using the local runner", async () => {
    const { createGameJudge } = await loadFactory();
    expect(() => createGameJudge({ JUDGE_BACKEND: "unknown" })).toThrow("unsupported JUDGE_BACKEND unknown");
  });
});

it("passes lifecycle cancellation to the worker provider", async () => {
  const life = new AbortController(); let entered!: () => void;
  const started = new Promise<void>((done) => { entered = done; });
  const fetchImpl: typeof fetch = async (_input, init) => {
    const signal = init!.signal!; entered();
    return new Promise<Response>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  };
  vi.stubGlobal("fetch", fetchImpl);
  try {
    const { createGameJudge } = await loadFactory();
    const judge = createGameJudge({ JUDGE_BACKEND: "worker",
      JUDGE_WORKER_URL: "http://worker.internal", JUDGE_WORKER_TOKEN: "test", JUDGE_WORKER_TIMEOUT_MS: "100" }, life.signal);
    const request = judge.runVisible("Python", "snippet", "pass", [], {
      compileWallMs: 1000, runWallMs: 1000, runMemoryMb: 64,
      runOutputBytes: 1024, runCpus: 1, runPids: 16 });
    const rejected = expect(request).rejects.toThrow(/stopped/);
    await started; life.abort(new Error("shutdown")); await rejected;
  } finally { vi.unstubAllGlobals(); }
});
