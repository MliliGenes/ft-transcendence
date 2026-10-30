import { afterEach, describe, expect, it } from "vitest";
import type { GameJudge } from "arena-game-engine/judge";
import { createJudgeWorkerServer, type JudgeWorkerServerOptions } from "../src/http-server.js";
import { BoundedJobQueue } from "../src/job-queue.js";

const TOKEN = "worker-test-token-32-bytes-long";
const limits = {
  compileWallMs: 1000,
  runWallMs: 1000,
  runMemoryMb: 64,
  runOutputBytes: 1024,
  runCpus: 1,
  runPids: 16,
};
const visibleRequest = {
  language: "Python",
  driver: "snippet",
  source: "def solve(value): return value\n",
  tests: [{ id: "visible-1", input: "value = 1", expected: "1" }],
  limits,
};
const sealedRequest = {
  evaluationId: "evaluation",
  submissionId: "submission",
  problemVersionId: "problem-v1",
  hiddenSuiteId: "suite-v1",
  language: "Python",
  driver: "snippet",
  source: "def solve(value): return value",
  groups: [{ name: "hidden", weight: 1, tests: [{ id: "hidden-1", input: "value=1", expected: "1" }] }],
  limits,
};

const servers: Array<{ close: (callback: (error?: Error) => void) => void }> = [];

type ServerOverrides = Omit<Partial<JudgeWorkerServerOptions>, "judge"> & { judge?: Partial<GameJudge> };

async function startServer(options: ServerOverrides = {}) {
  const server = createJudgeWorkerServer({
    token: TOKEN,
    judge: {
      provider: "fake",
      runVisible: async () => [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }],
      evaluateSealed: async (request) => ({
        groups: request.groups.map((group) => ({
          name: group.name,
          weight: group.weight,
          results: group.tests.map((test) => ({ id: test.id, passed: true, status: "accepted", runtimeMs: 1 })),
        })),
      }),
      ...options.judge,
    },
    queue: options.queue ?? new BoundedJobQueue({
      concurrency: 1,
      maxQueueSize: 1,
      queueTimeoutMs: 100,
      executionTimeoutMs: 500,
    }),
    readiness: options.readiness ?? { check: async () => ({ ready: true, docker: true, images: { python: true, gcc: true } }) },
    maxBodyBytes: options.maxBodyBytes ?? 4096,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

function post(url: string, token?: string, body: unknown = visibleRequest): Promise<Response> {
  return fetch(`${url}/v1/run-visible`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function postSealed(url: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${url}/v1/evaluate-sealed`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("judge worker HTTP API", () => {
  it("requires bearer authentication before dispatching a judge call", async () => {
    let calls = 0;
    const url = await startServer({ judge: { runVisible: async () => {
      calls++;
      return [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }];
    } } });

    expect((await post(url)).status).toBe(401);
    expect((await post(url, "wrong-token")).status).toBe(401);
    const authorized = await post(url, TOKEN);
    expect(authorized.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("rejects oversized request bodies before judge dispatch", async () => {
    let calls = 0;
    const url = await startServer({
      maxBodyBytes: 256,
      judge: { runVisible: async () => { calls++; return []; } },
    });
    const response = await post(url, TOKEN, { ...visibleRequest, source: "x".repeat(1024) });

    expect(response.status).toBe(413);
    expect(calls).toBe(0);
  });

  it("implements the sealed GameJudge method without returning case inputs or expected answers", async () => {
    const url = await startServer();
    const response = await postSealed(url, TOKEN, sealedRequest);

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.groups[0].results).toEqual([
      { id: "hidden-1", passed: true, status: "accepted", runtimeMs: 1 },
    ]);
    expect(JSON.stringify(result)).not.toContain("value=1");
    expect(JSON.stringify(result)).not.toContain('"expected"');
  });

  it.each<[string, unknown]>([
    ["null body", null],
    ["array body", []],
    ...["evaluationId", "submissionId", "problemVersionId", "hiddenSuiteId"].map((key): [string, unknown] => [
      `missing ${key}`, { ...sealedRequest, [key]: undefined },
    ]),
    ["non-string evaluation ID", { ...sealedRequest, evaluationId: 1 }],
    ["unsupported language", { ...sealedRequest, language: "Java" }],
    ["unsupported driver", { ...sealedRequest, driver: "unknown" }],
    ["non-string source", { ...sealedRequest, source: 1 }],
    ["missing limits", { ...sealedRequest, limits: null }],
    ...Object.keys(limits).map((key): [string, unknown] => [`zero ${key}`, { ...sealedRequest, limits: { ...limits, [key]: 0 } }]),
    ["non-string entrypoint", { ...sealedRequest, entrypoint: 1 }],
    ["invalid entrypoint", { ...sealedRequest, entrypoint: "9solve" }],
    ["invalid class name", { ...sealedRequest, className: "invalid-name" }],
    ["non-string class name", { ...sealedRequest, className: 1 }],
    ["unsupported signature", { ...sealedRequest, signature: "string-array" }],
    ["missing groups", { ...sealedRequest, groups: undefined }],
    ["non-array groups", { ...sealedRequest, groups: {} }],
    ["null group", { ...sealedRequest, groups: [null] }],
    ["non-string group name", { ...sealedRequest, groups: [{ ...sealedRequest.groups[0], name: 1 }] }],
    ["missing weight", { ...sealedRequest, groups: [{ ...sealedRequest.groups[0], weight: undefined }] }],
    ["negative weight", { ...sealedRequest, groups: [{ ...sealedRequest.groups[0], weight: -1 }] }],
    ["non-array tests", { ...sealedRequest, groups: [{ ...sealedRequest.groups[0], tests: {} }] }],
    ["null test", { ...sealedRequest, groups: [{ ...sealedRequest.groups[0], tests: [null] }] }],
    ...["id", "input", "expected"].map((key): [string, unknown] => [
      `non-string test ${key}`,
      { ...sealedRequest, groups: [{ ...sealedRequest.groups[0], tests: [{ ...sealedRequest.groups[0]!.tests[0], [key]: 1 }] }] },
    ]),
  ])("rejects malformed sealed input before Judge dispatch: %s", async (_name, body) => {
    let calls = 0;
    const url = await startServer({ judge: { evaluateSealed: async () => { calls++; return { groups: [] }; } } });
    const response = await postSealed(url, TOKEN, body);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid judge request" });
    expect(calls).toBe(0);
  });

  it.each<[string, unknown]>([
    ["null body", null],
    ["array body", []],
    ["missing tests", { ...visibleRequest, tests: undefined }],
    ["non-array tests", { ...visibleRequest, tests: {} }],
    ["null test", { ...visibleRequest, tests: [null] }],
    ["non-string test id", { ...visibleRequest, tests: [{ ...visibleRequest.tests[0], id: 1 }] }],
    ["non-string test input", { ...visibleRequest, tests: [{ ...visibleRequest.tests[0], input: 1 }] }],
    ["non-string test expected", { ...visibleRequest, tests: [{ ...visibleRequest.tests[0], expected: 1 }] }],
  ])("rejects malformed visible input before Judge dispatch: %s", async (_name, body) => {
    let calls = 0;
    const url = await startServer({ judge: { runVisible: async () => { calls++; return []; } } });
    const response = await post(url, TOKEN, body);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid judge request" });
    expect(calls).toBe(0);
  });

  it("rejects a JSON numeric overflow in a sealed group weight", async () => {
    let calls = 0;
    const url = await startServer({ judge: { evaluateSealed: async () => { calls++; return { groups: [] }; } } });
    const response = await fetch(`${url}/v1/evaluate-sealed`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(sealedRequest).replace('"weight":1', '"weight":1e999'),
    });
    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });

  it("keeps zero weights and validated metadata while dropping extra request fields", async () => {
    let received: unknown;
    const url = await startServer({ judge: { evaluateSealed: async (input: unknown) => {
      received = input;
      return { groups: [] };
    } } });
    const expected = {
      ...sealedRequest,
      entrypoint: "solve",
      className: "Solution",
      signature: "int64-array",
      groups: [{ name: "hidden", weight: 0, tests: sealedRequest.groups[0]!.tests }],
    };
    const response = await postSealed(url, TOKEN, {
      ...expected,
      ignored: "extra",
      groups: [{ ...expected.groups[0], ignored: "extra", tests: expected.groups[0]!.tests.map((test) => ({ ...test, ignored: "extra" })) }],
    });
    expect(response.status).toBe(200);
    expect(received).toEqual(expected);
  });

  it.each([
    ["empty groups", []],
    ["empty tests", [{ name: "hidden", weight: 0, tests: [] }]],
  ])("preserves accepted empty collections: %s", async (_name, groups) => {
    let received: unknown;
    const url = await startServer({ judge: { evaluateSealed: async (input: unknown) => {
      received = input;
      return { groups: [] };
    } } });
    const body = { ...sealedRequest, evaluationId: "", submissionId: "", problemVersionId: "", hiddenSuiteId: "", groups };
    expect((await postSealed(url, TOKEN, body)).status).toBe(200);
    expect(received).toEqual(body);
  });

  it("reports Docker and image readiness failures and recovers without restarting Game", async () => {
    let available = false;
    let calls = 0;
    const url = await startServer({
      readiness: {
        check: async () => ({ ready: available, docker: available, images: { python: available, gcc: available } }),
      },
      judge: { runVisible: async () => { calls++; return []; } },
    });

    expect((await fetch(`${url}/ready`)).status).toBe(503);
    expect((await post(url, TOKEN)).status).toBe(503);
    expect(calls).toBe(0);

    available = true;
    expect((await fetch(`${url}/ready`)).status).toBe(200);
    expect((await post(url, TOKEN)).status).toBe(200);
    expect(calls).toBe(1);
  });

  it("maps queue saturation to 429 while the accepted job completes", async () => {
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const url = await startServer({
      queue: new BoundedJobQueue({ concurrency: 1, maxQueueSize: 0, queueTimeoutMs: 100, executionTimeoutMs: 500 }),
      judge: { runVisible: async () => {
        signalStarted();
        await new Promise((resolve) => setTimeout(resolve, 60));
        return [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }];
      } },
    });

    const active = post(url, TOKEN);
    await started;
    expect((await post(url, TOKEN)).status).toBe(429);
    expect((await active).status).toBe(200);
  });

  it("times out the HTTP job and serves new work after the timed-out execution settles", async () => {
    let calls = 0;
    const url = await startServer({
      queue: new BoundedJobQueue({ concurrency: 1, maxQueueSize: 1, queueTimeoutMs: 150, executionTimeoutMs: 20 }),
      judge: { runVisible: async () => {
        calls++;
        if (calls === 1) await new Promise((resolve) => setTimeout(resolve, 60));
        return [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }];
      } },
    });

    expect((await post(url, TOKEN)).status).toBe(504);
    await new Promise((resolve) => setTimeout(resolve, 55));
    expect((await post(url, TOKEN)).status).toBe(200);
  });
});
