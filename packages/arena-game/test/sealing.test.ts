import { describe, expect, it } from 'vitest';
import { P100, P40, SOLVED_PY, STARTER_PY, setup } from './setup.js';

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

// Hidden-only markers: absent from every visible/bank-public surface.
const HIDDEN_MARKERS = [
  '"b1"',
  '"n1"',
  '"e1"',
  '1000000000',
  'Negatives and zeros',
  'hiddenGroups',
];
const LEFT_CODE = 'def ledger_sum(nums):\n    return 999111\n';
const RIGHT_CODE = 'def ledger_sum(nums):\n    return 222888\n';

describe('client-facing sealing (hidden + opponent isolation)', () => {
  it('snapshots, receipts and events never carry hidden material', async () => {
    const { engine, judge, left, matchId } = await setup([P100, P40]);
    const seen: unknown[] = [];
    engine.on((_event, payload) => seen.push(payload));
    const receipt = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    await engine.submit(left, matchId, {
      code: STARTER_PY,
      language: 'Python',
    });
    const snap = await engine.snapshot(left, matchId);
    // The sealed channel DID carry hidden material internally.
    expect(JSON.stringify(judge.lastSealedGroups)).toContain('1000000000');
    const bodies = [
      JSON.stringify(receipt),
      JSON.stringify(snap),
      ...seen.map((s) => JSON.stringify(s)),
    ];
    for (const body of bodies) {
      for (const marker of HIDDEN_MARKERS) {
        expect(body).not.toContain(marker);
      }
    }
  });

  it("neither side ever sees the other's source", async () => {
    const { engine, left, right, matchId } = await setup([P100, P100]);
    await engine.submit(left, matchId, { code: LEFT_CODE, language: 'Python' });
    await engine.submit(right, matchId, {
      code: RIGHT_CODE,
      language: 'Python',
    });
    const leftSnap = JSON.stringify(await engine.snapshot(left, matchId));
    const rightSnap = JSON.stringify(await engine.snapshot(right, matchId));
    expect(leftSnap).not.toContain('222888');
    expect(rightSnap).not.toContain('999111');
  });

  it('failure audit carries no hidden data', async () => {
    const { engine, left, matchId } = await setup([{ infra: 'queue down' }]);
    await expect(
      engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' }),
    ).rejects.toThrow();
    const snap = await engine.snapshot(left, matchId);
    for (const marker of HIDDEN_MARKERS) {
      expect(JSON.stringify(snap.failures)).not.toContain(marker);
    }
  });

  it('reveal discloses groups but never raw hidden inputs or expected values', async () => {
    const { engine, left, right, matchId } = await setup(
      [{ score: 100 }, { score: 100 }],
      {},
      ['even-ledger-v2'],
    );
    await engine.submit(left, matchId, { code: SOLVED_PY, language: 'Python' });
    await engine.submit(right, matchId, { code: SOLVED_PY, language: 'Python' });
    const reveal = await engine.publishReveal(left, matchId);
    const body = JSON.stringify((await engine.snapshot(left, matchId)).reveal);
    expect(body).toContain('Basic');
    for (const marker of [
      '"b1"',
      '"n1"',
      '"e1"',
      '1000000000',
      'nums = [10,-3]',
      '"expected"',
    ]) {
      expect(body).not.toContain(marker);
    }
    expect(reveal.groups.left?.every((g) => g.earned <= g.weight)).toBe(true);
  });

  it('early publishReveal rejects without modifying coding, cutoffs, or closing state', async () => {
    const { engine, left, matchId } = await setup([P100, P100], {}, ['even-ledger-v2', 'even-ledger-v2']);
    await expect(engine.publishReveal(left, matchId)).rejects.toThrow(
      'final reveal is unavailable until both sides finish',
    );
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe('CODING');
    expect(snap.reveal).toBeNull();
    // Submissions continue to succeed without closing/cutoff blockage
    const receipt = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    expect(receipt.ok).toBe(true);
    expect(receipt.round).toBe(1);
  });

  it('early publishReveal while evaluation is pending rejects without setting closing or blocking opponent', async () => {
    const { engine, judge, left, right, matchId } = await setup(
      [{ defer: true }, { score: 100 }],
      {},
      ['even-ledger-v2', 'even-ledger-v2'],
    );
    // Left submits, evaluation is pending in judge
    const leftPending = engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    await tick();

    // While evaluation is pending, caller attempts early publishReveal
    await expect(engine.publishReveal(left, matchId)).rejects.toThrow(
      'final reveal is unavailable until both sides finish',
    );

    // Opponent can still submit new code without being blocked by any closing state
    const rightReceipt = await engine.submit(right, matchId, {
      code: SOLVED_PY,
      language: 'Python',
    });
    expect(rightReceipt.ok).toBe(true);
    expect(rightReceipt.round).toBe(1);

    // Release deferred judge to clean up
    judge.release(P100);
    const leftReceipt = await leftPending;
    expect(leftReceipt.ok).toBe(true);
  });
});
