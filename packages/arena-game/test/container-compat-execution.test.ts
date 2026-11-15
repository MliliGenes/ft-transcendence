import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ContainerJudge } from '../src/container-judge.js';
import { WorkerJudgeAdapter } from '../src/worker-judge.js';
import { SPIKE_LIMITS, type SealedEvaluationRequest } from '../src/judge.js';

// Tight resource limits, 1 test at a time
const LIMITS = { ...SPIKE_LIMITS, runWallMs: 4000, compileWallMs: 15000, runMemoryMb: 64, runPids: 16, runCpus: 1 };

const PYTHON_SRC = `def solve(nums):
    return sum(nums)
`;

const C_SRC = `#include <stdio.h>
int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) {
        printf("%d\\n", a + b);
    }
    return 0;
}
`;

const CPP_SRC = `#include <cstdio>
int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) {
        printf("%d\\n", a * b);
    }
    return 0;
}
`;

function makeSealedRequest(language: "Python" | "C" | "C++", driver: "snippet" | "stdio", source: string): SealedEvaluationRequest {
  const tests = language === "Python"
    ? [{ id: "h1", input: "nums = [10, 20, 30]", expected: "60" }, { id: "h2", input: "nums = [-5, 5]", expected: "0" }]
    : language === "C"
      ? [{ id: "h1", input: "15 27", expected: "42\n" }, { id: "h2", input: "100 200", expected: "300\n" }]
      : [{ id: "h1", input: "6 7", expected: "42\n" }, { id: "h2", input: "9 9", expected: "81\n" }];

  return {
    evaluationId: `eval-${Date.now()}`,
    submissionId: `sub-${Date.now()}`,
    problemVersionId: "prob-v1",
    hiddenSuiteId: "suite-v1",
    language,
    driver,
    source,
    limits: LIMITS,
    groups: [
      {
        name: "group-1",
        weight: 100,
        tests,
      },
    ],
  };
}

describe("Real container execution: Direct ContainerJudge (CPU on vs CPU off)", () => {
  it.each([
    { lang: "Python" as const, driver: "snippet" as const, src: PYTHON_SRC, test: { id: "p1", input: "nums = [1, 2, 3]", expected: "6" } },
    { lang: "C" as const, driver: "stdio" as const, src: C_SRC, test: { id: "c1", input: "20 22", expected: "42\n" } },
    { lang: "C++" as const, driver: "stdio" as const, src: CPP_SRC, test: { id: "cpp1", input: "6 7", expected: "42\n" } },
  ])("$lang visible run passes with default cpuLimitEnabled (true)", async ({ lang, driver, src, test }) => {
    const judge = new ContainerJudge({ cpuLimitEnabled: true });
    const results = await judge.runVisible(lang, driver, src, [test], LIMITS);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].status).toBe("accepted");
  }, 30000);

  it.each([
    { lang: "Python" as const, driver: "snippet" as const, src: PYTHON_SRC, test: { id: "p1", input: "nums = [1, 2, 3]", expected: "6" } },
    { lang: "C" as const, driver: "stdio" as const, src: C_SRC, test: { id: "c1", input: "20 22", expected: "42\n" } },
    { lang: "C++" as const, driver: "stdio" as const, src: CPP_SRC, test: { id: "cpp1", input: "6 7", expected: "42\n" } },
  ])("$lang visible run passes with explicit cpuLimitEnabled: false", async ({ lang, driver, src, test }) => {
    const judge = new ContainerJudge({ cpuLimitEnabled: false });
    const results = await judge.runVisible(lang, driver, src, [test], LIMITS);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].status).toBe("accepted");
  }, 30000);

  it.each([
    { lang: "Python" as const, driver: "snippet" as const, src: PYTHON_SRC },
    { lang: "C" as const, driver: "stdio" as const, src: C_SRC },
    { lang: "C++" as const, driver: "stdio" as const, src: CPP_SRC },
  ])("$lang hidden submit (evaluateSealed) passes with cpuLimitEnabled: false", async ({ lang, driver, src }) => {
    const judge = new ContainerJudge({ cpuLimitEnabled: false });
    const result = await judge.evaluateSealed(makeSealedRequest(lang, driver, src));
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].results).toHaveLength(2);
    expect(result.groups[0].results.every(r => r.passed && r.status === "accepted")).toBe(true);
  }, 30000);
});

describe("Real container execution: HTTP WorkerJudgeAdapter -> JudgeWorkerServer -> ContainerJudge", () => {
  let server: Server;
  let workerUrl: string;
  const token = "compat-worker-token-secret-12345";

  beforeAll(async () => {
    const { BoundedJobQueue } = await import("../../../services/judge-worker/src/job-queue.js");
    const { createJudgeWorkerServer } = await import("../../../services/judge-worker/src/http-server.js");
    const judge = new ContainerJudge({ cpuLimitEnabled: false });
    const queue = new BoundedJobQueue({
      concurrency: 1,
      maxQueueSize: 8,
      queueTimeoutMs: 10000,
      executionTimeoutMs: 30000,
    });
    const readiness = {
      check: async () => ({
        ready: true,
        docker: true,
        images: { Python: true, "C++": true, C: true },
        checks: { docker: true },
      }),
    };
    server = createJudgeWorkerServer({ token, judge, queue, readiness });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (typeof addr !== "object" || !addr) throw new Error("bad server address");
    workerUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("Python visible Run succeeds over HTTP adapter with cpuLimitEnabled: false", async () => {
    const adapter = new WorkerJudgeAdapter({ baseUrl: workerUrl, token, timeoutMs: 15000 });
    const results = await adapter.runVisible(
      "Python",
      "snippet",
      PYTHON_SRC,
      [{ id: "p-http", input: "nums = [10, 20, 30]", expected: "60" }],
      LIMITS,
    );
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].status).toBe("accepted");
  }, 30000);

  it("C++ hidden Submit (evaluateSealed) succeeds over HTTP adapter with cpuLimitEnabled: false", async () => {
    const adapter = new WorkerJudgeAdapter({ baseUrl: workerUrl, token, timeoutMs: 15000 });
    const result = await adapter.evaluateSealed(makeSealedRequest("C++", "stdio", CPP_SRC));
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].results).toHaveLength(2);
    expect(result.groups[0].results.every(r => r.passed && r.status === "accepted")).toBe(true);
  }, 30000);
});
