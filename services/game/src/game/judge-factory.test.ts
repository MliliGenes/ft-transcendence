import { describe, expect, it } from 'vitest';

const modulePath = './judge-factory.js';

async function loadFactory(): Promise<any> {
  let loaded: any;
  try {
    loaded = await import(modulePath);
  } catch {
    loaded = null;
  }
  expect(loaded?.createGameJudge).toBeTypeOf('function');
  return loaded;
}

describe('Game judge backend selection', () => {
  it('keeps the local runner as the development default and preserves Judge0', async () => {
    const { createGameJudge } = await loadFactory();
    expect(createGameJudge({}).provider).toBe('container');
    expect(
      createGameJudge({
        JUDGE_BACKEND: 'judge0',
        JUDGE0_URL: 'http://judge0.internal',
      }).provider,
    ).toBe('judge0');
  });

  it('selects only an explicitly configured worker and fails closed when its settings are missing', async () => {
    const { createGameJudge } = await loadFactory();
    const judge = createGameJudge({
      JUDGE_BACKEND: 'worker',
      JUDGE_WORKER_URL: 'http://judge-worker:3010',
      JUDGE_WORKER_TOKEN: 'worker-token',
    });
    expect(judge.provider).toBe('worker');
    expect(() =>
      createGameJudge({
        JUDGE_BACKEND: 'worker',
        JUDGE_WORKER_TOKEN: 'worker-token',
      }),
    ).toThrow(/JUDGE_WORKER_URL/);
    expect(() =>
      createGameJudge({
        JUDGE_BACKEND: 'worker',
        JUDGE_WORKER_URL: 'http://judge-worker:3010',
      }),
    ).toThrow(/JUDGE_WORKER_TOKEN/);
    expect(() => createGameJudge({ JUDGE_BACKEND: 'worker' })).toThrow(
      /JUDGE_WORKER_URL/,
    );
  });

  it('rejects unsupported backends instead of silently using the local runner', async () => {
    const { createGameJudge } = await loadFactory();
    expect(() => createGameJudge({ JUDGE_BACKEND: 'unknown' })).toThrow(
      'unsupported JUDGE_BACKEND unknown',
    );
  });

  it('wires JUDGE_CPU_LIMIT_ENABLED to ContainerJudge options with default true and false optout', async () => {
    const { createGameJudge } = await loadFactory();
    const defaultJudge = createGameJudge({ JUDGE_BACKEND: 'container' });
    expect((defaultJudge as any).cpuLimitEnabled).toBe(true);

    const optOutJudge = createGameJudge({
      JUDGE_BACKEND: 'container',
      JUDGE_CPU_LIMIT_ENABLED: 'false',
    });
    expect((optOutJudge as any).cpuLimitEnabled).toBe(false);

    const whitespaceOptOut = createGameJudge({
      JUDGE_BACKEND: 'container',
      JUDGE_CPU_LIMIT_ENABLED: '  FaLsE  ',
    });
    expect((whitespaceOptOut as any).cpuLimitEnabled).toBe(false);
  });
});
