import { afterEach, describe, expect, it } from 'vitest';
import { BoundedJobQueue } from '../src/job-queue.js';
import { createJudgeWorkerServer } from '../src/http-server.js';
import { JudgeInfraError } from 'arena-game-engine';
import { createJudgeWorkerJudge, resolveCpuLimitEnabled } from '../src/main.js';

const TOKEN = 'worker-test-token-32-bytes-long';
const limits = {
  compileWallMs: 1000,
  runWallMs: 1000,
  runMemoryMb: 64,
  runOutputBytes: 1024,
  runCpus: 1,
  runPids: 16,
};
const visibleRequest = {
  language: 'Python',
  driver: 'snippet',
  entrypoint: 'solve',
  source: 'def solve(value): return value\n',
  tests: [{ id: 'visible-1', input: 'value = 1', expected: '1' }],
  limits,
};

const servers: Array<{ close: (callback: (error?: Error) => void) => void }> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop()!;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function startServerWithJudge(judge: any): Promise<string> {
  const queue = new BoundedJobQueue({
    concurrency: 1,
    maxQueueSize: 2,
    queueTimeoutMs: 1000,
    executionTimeoutMs: 1000,
  });
  const readiness = {
    check: async () => ({
      ready: true,
      docker: true,
      images: { python: true, gcc: true },
      checks: { docker: true },
    }),
  };
  const server = createJudgeWorkerServer({ token: TOKEN, judge, queue, readiness });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('server address failed');
  return `http://127.0.0.1:${address.port}/v1/run-visible`;
}

describe('Judge worker cpuLimitEnabled and HTTP 503 error contract', () => {
  it('production wiring: resolveCpuLimitEnabled defaults to true, false only for literal false (case-insensitive, trimmed)', () => {
    expect(resolveCpuLimitEnabled({})).toBe(true);
    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: '' })).toBe(true);
    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: 'true' })).toBe(true);
    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: 'TRUE' })).toBe(true);
    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: '1' })).toBe(true);

    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: 'false' })).toBe(false);
    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: 'FALSE' })).toBe(false);
    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: '  false  ' })).toBe(false);
    expect(resolveCpuLimitEnabled({ JUDGE_CPU_LIMIT_ENABLED: '  FaLsE  ' })).toBe(false);

    // Verify actual judge wiring in worker bootstrap
    const defaultJudge = createJudgeWorkerJudge({});
    expect((defaultJudge as any).cpuLimitEnabled).toBe(true);
    const disabledJudge = createJudgeWorkerJudge({ JUDGE_CPU_LIMIT_ENABLED: 'false' });
    expect((disabledJudge as any).cpuLimitEnabled).toBe(false);
  });

  it('translates JudgeInfraError into HTTP 503 judge unavailable across HTTP transport', async () => {
    const failingJudge = {
      provider: 'container',
      runVisible: async () => {
        throw new JudgeInfraError('NanoCPUs unsupported: host cgroup does not support cpus');
      },
      evaluateSealed: async () => {
        throw new JudgeInfraError('NanoCPUs unsupported: host cgroup does not support cpus');
      },
    };

    const url = await startServerWithJudge(failingJudge);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(visibleRequest),
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: 'judge unavailable' });
    expect(JSON.stringify(body)).not.toContain('NanoCPUs');
  });
});
