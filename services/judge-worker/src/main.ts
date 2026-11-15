import { ContainerJudge } from 'arena-game-engine';
import { BoundedJobQueue } from './job-queue.js';
import { createJudgeWorkerServer } from './http-server.js';
import { DockerImageReadiness } from './readiness.js';

function integerEnv(name: string, fallback: number, minimum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${name} must be at least ${minimum}`);
  return value;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function resolveCpuLimitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.JUDGE_CPU_LIMIT_ENABLED?.trim().toLowerCase() !== 'false';
}

export function createJudgeWorkerJudge(env: NodeJS.ProcessEnv = process.env): ContainerJudge {
  const dockerBin = env.JUDGE_DOCKER_BIN?.trim() || 'docker';
  const pythonImage =
    env.JUDGE_PYTHON_IMAGE?.trim() || 'python:3.12-slim';
  const gccImage = env.JUDGE_GCC_IMAGE?.trim() || 'gcc:14-bookworm';
  const cpuLimitEnabled = resolveCpuLimitEnabled(env);
  return new ContainerJudge({
    dockerBin,
    cpuLimitEnabled,
    images: { Python: pythonImage, 'C++': gccImage, C: gccImage },
  });
}

function start(): void {
  const token = requiredEnv('JUDGE_WORKER_TOKEN');
  const dockerBin = process.env.JUDGE_DOCKER_BIN?.trim() || 'docker';
  const pythonImage =
    process.env.JUDGE_PYTHON_IMAGE?.trim() || 'python:3.12-slim';
  const gccImage = process.env.JUDGE_GCC_IMAGE?.trim() || 'gcc:14-bookworm';
  const port = integerEnv('JUDGE_WORKER_PORT', 3010, 1);
  const concurrency = integerEnv('JUDGE_WORKER_CONCURRENCY', 2, 1);
  const maxQueueSize = integerEnv('JUDGE_WORKER_MAX_QUEUE', 8, 0);

  const judge = createJudgeWorkerJudge(process.env);
  const readiness = new DockerImageReadiness({
    dockerBin,
    images: { python: pythonImage, gcc: gccImage },
  });
  const queue = new BoundedJobQueue({
    concurrency,
    maxQueueSize,
    queueTimeoutMs: integerEnv('JUDGE_WORKER_QUEUE_TIMEOUT_MS', 30000, 0),
    executionTimeoutMs: integerEnv('JUDGE_WORKER_JOB_TIMEOUT_MS', 900000, 1),
  });
  const server = createJudgeWorkerServer({ token, judge, queue, readiness });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[judge-worker] listening on internal port ${port}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (process.env.NODE_ENV !== 'test') {
  try {
    start();
  } catch (error) {
    console.error(
      `[judge-worker] startup failed: ${error instanceof Error ? error.message : 'configuration error'}`,
    );
    process.exitCode = 1;
  }
}
