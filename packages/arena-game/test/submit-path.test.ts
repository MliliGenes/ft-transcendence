import { describe, expect, it } from 'vitest';
import { ArenaEngine } from '../src/engine.js';
import { InMemoryMatchStore, InMemorySubmissionStore } from '../src/store.js';
import { FileBank } from '../src/file-bank.js';
import {
  P100,
  P40,
  P55,
  P70,
  SOLVED_PY,
  STARTER_PY,
  setup,
  tick,
} from './setup.js';

const HIDDEN_MARKERS = [
  '1000000000',
  'Negatives and zeros',
  'hiddenGroups',
  'expected.txt',
];

describe('08 submit path (sealed hidden evaluation, last-wins)', () => {
  it('1. first submit completes and remains sealed', async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    const receipt = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    expect(receipt.ok).toBe(true);
    expect(JSON.stringify(receipt)).not.toContain('100');
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe('CODING');
    expect(snap.reveal).toBeNull();
    expect(snap.sides.left?.submissions).toBe(1);
  });

  it('2. consecutive problem submissions advance independently and record attempts', async () => {
    const { engine, left, matchId } = await setup([P100, P40]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' });
    const snap1 = await engine.snapshot(left, matchId);
    expect(snap1.progress.self.currentRound).toBe(2);
    expect(snap1.progress.self.lastScore).toBe(100);
    await engine.submit(left, matchId, {
      code: STARTER_PY,
      language: 'Python',
    });
    const snap2 = await engine.snapshot(left, matchId);
    expect(snap2.progress.self.currentRound).toBe(3);
    expect(snap2.progress.self.lastScore).toBe(40);
    expect(snap2.sides.left?.submissions).toBe(2);
  });

  it('3. failed resubmit preserves previous counted result', async () => {
    const { engine, left, matchId } = await setup([
      P70,
      { infra: 'hidden suite timeout' },
    ]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' });
    const snap1 = await engine.snapshot(left, matchId);
    expect(snap1.progress.self.lastScore).toBe(70);
    await expect(
      engine.submit(left, matchId, { code: STARTER_PY, language: 'Python' }),
    ).rejects.toThrow();
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe('CODING');
    expect(snap.sides.left?.status).toBe('coding');
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.failures).toEqual(['submit: hidden suite timeout']);
  });

  it('4. idempotent retry of the same evaluationId creates no second attempt', async () => {
    const { engine, judge, left, matchId } = await setup([P100, P40]);
    const first = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-1',
      evaluationId: 'eval-1',
    });
    const retry = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-1',
      evaluationId: 'eval-1',
    });
    expect(retry).toEqual(first);
    expect(judge.evalCalls).toBe(1);
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.progress.self.lastScore).toBe(100);
    expect(snap.reveal).toBeNull();
  });

  it('concurrent retry of an in-flight evaluation does not hold the Match lock', async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-in-flight',
      evaluationId: 'eval-in-flight',
    };
    const first = engine.submit(left, matchId, input);
    await tick();

    const retry = engine.submit(left, matchId, input);
    judge.release(P100);

    const [firstReceipt, retryReceipt] = await Promise.race([
      Promise.all([first, retry]),
      new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error('in-flight retry deadlocked behind the Match lock'),
            ),
          250,
        );
      }),
    ]);
    expect(retryReceipt).toEqual(firstReceipt);
    expect(judge.evalCalls).toBe(1);
  });

  it('rejects an in-flight evaluation id reused for different submission data', async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const first = engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-original',
      evaluationId: 'eval-collision',
    });
    await tick();

    const conflicting = engine.submit(left, matchId, {
      code: STARTER_PY,
      language: 'Python',
      submissionId: 'sub-conflicting',
      evaluationId: 'eval-collision',
    });
    judge.release(P100);
    await first;

    await expect(conflicting).rejects.toThrow(
      'evaluation id is already bound to different submission data',
    );
    expect(judge.evalCalls).toBe(1);
  });

  it('rejects a completed evaluation id reused for different submission data', async () => {
    const { engine, left, matchId } = await setup([P100]);
    await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-completed',
      evaluationId: 'eval-completed',
    });

    await expect(
      engine.submit(left, matchId, {
        code: STARTER_PY,
        language: 'Python',
        submissionId: 'sub-completed',
        evaluationId: 'eval-completed',
      }),
    ).rejects.toThrow(
      'evaluation id is already bound to different submission data',
    );
  });

  it('replays an in-flight judge failure to the idempotent retry', async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-failed-in-flight',
      evaluationId: 'eval-failed-in-flight',
    };
    const first = engine.submit(left, matchId, input);
    await tick();
    const retry = engine.submit(left, matchId, input);
    judge.release({ infra: 'hidden suite timeout' });

    await expect(first).rejects.toThrow('hidden suite timeout');
    await expect(retry).rejects.toThrow('hidden suite timeout');
    expect(judge.evalCalls).toBe(1);
  });

  it('new Submit click mints new submissionId and evaluationId', async () => {
    const { engine, left, matchId } = await setup([
      { score: 100 },
      { score: 100 },
    ]);
    const first = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    const second = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    expect(first.submissionId).not.toBe(second.submissionId);
    expect(first.evaluationId).not.toBe(second.evaluationId);
  });

  it('5. compile error counts as an attempt with counted 0', async () => {
    const { engine, left, matchId } = await setup([
      { verdict: 'compile_error' },
    ]);
    await engine.submit(left, matchId, {
      code: 'def broken(:',
      language: 'Python',
    });
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.progress.self.currentRound).toBe(2);
    expect(snap.progress.self.lastScore).toBe(0);
    expect(snap.reveal).toBeNull();
  });

  it('6. TLE, MLE and OLE count as attempts', async () => {
    for (const verdict of [
      'time_limit_exceeded',
      'memory_limit_exceeded',
      'output_limit_exceeded',
    ] as const) {
      const { engine, left, matchId } = await setup([{ verdict }]);
      await engine.submit(left, matchId, {
        code: SOLVED_PY,
        language: 'Python',
      });
      const snap = await engine.snapshot(left, matchId);
      expect(snap.sides.left?.submissions).toBe(1);
      expect(snap.progress.self.currentRound).toBe(2);
      expect(snap.progress.self.lastScore).toBe(0);
      expect(snap.reveal).toBeNull();
    }
  });

  it('7. infrastructure failure counts for history but not for tiebreak', async () => {
    const { engine, left, matchId } = await setup([
      P70,
      { infra: 'queue down' },
      P100,
    ]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' });
    await expect(
      engine.submit(left, matchId, { code: STARTER_PY, language: 'Python' }),
    ).rejects.toThrow();
    await engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' });
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(2);
    expect(snap.progress.self.lastScore).toBe(100);
  });

  it('8+9. A evaluating does not block B; B can submit while A evaluates', async () => {
    const { engine, judge, left, right, matchId } = await setup([
      { defer: true },
      P100,
    ]);
    const aPending = engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    await tick();
    expect((await engine.snapshot(right, matchId)).sides.left?.status).toBe(
      'coding',
    );
    const receipt = await engine.submit(right, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    expect(receipt.ok).toBe(true);
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe(
      'evaluating',
    );
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe('CODING');
    judge.release(P55);
    await aPending;
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe(
      'coding',
    );
    expect((await engine.snapshot(left, matchId)).progress.self.lastScore).toBe(55);
    expect((await engine.snapshot(right, matchId)).progress.self.lastScore).toBe(100);
  });

  it('10. reveal unavailable before explicit publish action', async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' });
    expect((await engine.snapshot(left, matchId)).reveal).toBeNull();
  });

  it('11. post-reveal submit rejected', async () => {
    const { engine, left, right, matchId } = await setup(
      Array.from({ length: 6 }, () => P100),
    );
    for (let i = 0; i < 3; i++) {
      await engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' });
      await engine.submit(right, matchId, { code: SOLVED_PY, language: 'Python' });
    }
    const snap = await engine.snapshot(left, matchId);
    expect(['SCORE_REVEAL', 'MATCH_COMPLETE']).toContain(snap.roundPhase);
    await expect(
      engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' }),
    ).rejects.toThrow();
  });

  it('12. hidden payload never reaches client-facing DTO or events', async () => {
    const { engine, judge, left, matchId } = await setup([{ score: 100 }]);
    const seen: unknown[] = [];
    engine.on((_event, payload) => seen.push(payload));
    const receipt = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    const snap = await engine.snapshot(left, matchId);
    // Judge DID receive sealed hidden material over the internal channel.
    expect(JSON.stringify(judge.lastSealedGroups)).toContain('1000000000');
    for (const body of [
      JSON.stringify(receipt),
      JSON.stringify(snap),
      ...seen.map((s) => JSON.stringify(s)),
    ]) {
      for (const marker of HIDDEN_MARKERS) {
        expect(body).not.toContain(marker);
      }
    }
  });

  it('retry of an accepted submission after problem cutoff passed returns original receipt', async () => {
    const { engine, left, matchId } = await setup([P100]);
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-cutoff',
      evaluationId: 'eval-cutoff',
    };
    const first = await engine.submit(left, matchId, input);
    expect(first.round).toBe(1);

    const retry = await engine.submit(left, matchId, input);
    expect(retry).toEqual(first);
  });

  it('retry of an accepted submission after match completion returns original receipt', async () => {
    const { engine, left, right, matchId } = await setup([P100, P100], {}, ['even-ledger-v2']);
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-done',
      evaluationId: 'eval-done',
    };
    const first = await engine.submit(left, matchId, input);
    await engine.submit(right, matchId, { code: SOLVED_PY, language: 'Python' });
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe('MATCH_COMPLETE');

    const retry = await engine.submit(left, matchId, input);
    expect(retry).toEqual(first);
  });

  it('retry of an accepted submission after engine restart returns original receipt', async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const bank = new FileBank();
    const { engine, judge, left, matchId } = await setup([P100], { matches, submissions, bank });
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-restart',
      evaluationId: 'eval-restart',
    };
    const first = await engine.submit(left, matchId, input);

    const restarted = new ArenaEngine({
      judge,
      bank,
      matches,
      submissions,
    });
    await restarted.recover();

    const retry = await restarted.submit(left, matchId, input);
    expect(retry).toEqual(first);
  });

  it('rejects tampered submission data on retry after completion', async () => {
    const { engine, left, matchId } = await setup([P100]);
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-tamper',
      evaluationId: 'eval-tamper',
    };
    await engine.submit(left, matchId, input);

    await expect(
      engine.submit(left, matchId, {
        code: STARTER_PY,
        language: 'Python',
        submissionId: 'sub-tamper',
        evaluationId: 'eval-tamper',
      }),
    ).rejects.toThrow('evaluation id is already bound to different submission data');

    await expect(
      engine.submit(left, matchId, {
        code: SOLVED_PY,
        language: 'C++',
        submissionId: 'sub-tamper',
        evaluationId: 'eval-tamper',
      }),
    ).rejects.toThrow('evaluation id is already bound to different submission data');
  });

  it('retry with only submissionId or only evaluationId resolves original receipt', async () => {
    const { engine, left, matchId } = await setup([P100]);
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-partial-only',
      evaluationId: 'eval-partial-only',
    };
    const first = await engine.submit(left, matchId, input);

    // Retry with only submissionId
    const retrySub = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-partial-only',
    });
    expect(retrySub).toEqual(first);

    // Retry with only evaluationId
    const retryEval = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
      evaluationId: 'eval-partial-only',
    });
    expect(retryEval).toEqual(first);
  });

  it('rejects cross-side forged submission retry', async () => {
    const { engine, left, right, matchId } = await setup([P100]);
    const input = {
      code: SOLVED_PY,
      language: 'Python',
      submissionId: 'sub-left-owned',
      evaluationId: 'eval-left-owned',
    };
    await engine.submit(left, matchId, input);

    // Right tries to claim Left's submissionId / evaluationId
    await expect(
      engine.submit(right, matchId, input),
    ).rejects.toThrow('evaluation id is already bound to different submission data');
  });
});
