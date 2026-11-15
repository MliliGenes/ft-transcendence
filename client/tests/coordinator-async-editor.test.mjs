import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, nodes, text } from './component-harness.mjs';

test('review regression: a distinct round of the same problem starts with a fresh draft', (t) => {
  const snapshot = {
    matchId: 'review-match', mode: '1v1', roundPhase: 'CODING', round: 1, totalRounds: 3,
    problem: { id: 'repeated-problem', title: 'Repeated problem', starters: { Python: 'starter' } },
    language: 'Python', ready: { you: false, mate: false }, surrender: { you: false, mate: false },
    notice: null, progress: { self: { currentRound: 1, stage: 'CODING' }, opponent: { currentRound: 1, stage: 'CODING' } },
  };
  const transport = { snapshot: () => snapshot, connection: () => 'connected', subscribe: () => () => {} };
  const dependencies = {
    'next/dynamic': { default: () => 'EditorAdapter' },
    '@/hooks/useArena': { useArena: (value) => value.snapshot() },
    '@/lib/arena/sidecars': { createArenaSidecarLifecycle: () => ({ sync: async () => null, dispose: () => {} }) },
  };
  for (const child of ['ArenaHeader', 'ProblemPanel', 'DuelPanel', 'TestPanel', 'RoundScoreReveal', 'MatchResult', 'TeamChat']) dependencies[`./${child}`] = { [child]: child };
  const ui = componentHarness('../components/arena/ArenaWorkspace.tsx', 'ArenaWorkspace', dependencies);
  t.after(() => ui.cleanup());
  const editor = () => nodes(ui.render({ transport })).find((node) => node.type === 'EditorAdapter');
  editor().props.onChange('round-one solution');
  assert.equal(editor().props.code, 'round-one solution');
  snapshot.round = 2;
  snapshot.progress.self.currentRound = 2;
  editor();
  assert.equal(editor().props.code, 'starter');
});

test('score notice is rendered once briefly as accessible status, distinct from error alerts', async (t) => {
  let scheduledTimer = null;
  let clearedTimerId = null;
  const globals = {
    setTimeout: (fn, ms) => {
      scheduledTimer = { fn, ms };
      return 999;
    },
    clearTimeout: (id) => {
      clearedTimerId = id;
    },
  };

  const snapshot = {
    matchId: 'review-match', mode: '1v1', roundPhase: 'CODING', round: 2, totalRounds: 3,
    problem: { id: 'p2', title: 'P2', starters: { Python: 'starter' } },
    language: 'Python', ready: { you: false, mate: false }, surrender: { you: false, mate: false },
    notice: null, progress: { self: { currentRound: 2, stage: 'CODING', lastScoredRound: 1, lastScore: 100 }, opponent: { currentRound: 1, stage: 'CODING' } },
  };
  let currentScope = 'match-alpha';
  const transport = {
    snapshot: () => snapshot,
    connection: () => 'connected',
    subscribe: () => () => {},
    scopeKey: () => currentScope,
  };
  const dependencies = {
    'next/dynamic': { default: () => 'EditorAdapter' },
    '@/hooks/useArena': { useArena: (value) => value.snapshot() },
    '@/lib/arena/sidecars': { createArenaSidecarLifecycle: () => ({ sync: async () => null, dispose: () => {} }) },
  };
  for (const child of ['ArenaHeader', 'ProblemPanel', 'DuelPanel', 'TestPanel', 'RoundScoreReveal', 'MatchResult', 'TeamChat']) dependencies[`./${child}`] = { [child]: child };
  const ui = componentHarness('../components/arena/ArenaWorkspace.tsx', 'ArenaWorkspace', dependencies, globals);
  t.after(() => ui.cleanup());

  // 1. Initial render shows polite status notice with explicit score metadata
  const tree1 = ui.render({ transport });
  const statusNodes1 = nodes(tree1).filter((n) => n.props?.role === 'status');
  assert.ok(statusNodes1.some((n) => text(n).includes('Problem 1 scored: 100/100')));
  assert.equal(statusNodes1.find((n) => text(n).includes('Problem 1 scored'))?.props?.['aria-live'], 'polite');
  const alertNodes1 = nodes(tree1).filter((n) => n.props?.role === 'alert');
  assert.ok(!alertNodes1.some((n) => text(n).includes('Problem 1 scored')));

  // 2. Timer was scheduled for bounded 5000ms duration
  assert.ok(scheduledTimer !== null);
  assert.equal(scheduledTimer.ms, 5000);

  // 3. Triggering timer callback dismisses the score notice
  scheduledTimer.fn();
  const tree2 = ui.render({ transport });
  const statusNodes2 = nodes(tree2).filter((n) => n.props?.role === 'status');
  assert.ok(!statusNodes2.some((n) => text(n).includes('Problem 1 scored')));

  // 4. Cleanup on unmount invokes clearTimeout
  ui.cleanup();
  assert.equal(clearedTimerId, 999);
});

test('match scope change resets dismissed score notice and re-displays for new match', (t) => {
  let scheduledTimer = null;
  const globals = {
    setTimeout: (fn, ms) => {
      scheduledTimer = { fn, ms };
      return 101;
    },
    clearTimeout: () => {},
  };

  let currentMatchId = 'match-101';
  const snapshot = {
    matchId: currentMatchId, mode: '1v1', roundPhase: 'CODING', round: 2, totalRounds: 3,
    problem: { id: 'p2', title: 'P2', starters: { Python: 'starter' } },
    language: 'Python', ready: { you: false, mate: false }, surrender: { you: false, mate: false },
    notice: null, progress: { self: { currentRound: 2, stage: 'CODING', lastScoredRound: 1, lastScore: 85 }, opponent: { currentRound: 1, stage: 'CODING' } },
  };
  const transport = {
    snapshot: () => snapshot,
    connection: () => 'connected',
    subscribe: () => () => {},
    scopeKey: () => currentMatchId,
  };
  const dependencies = {
    'next/dynamic': { default: () => 'EditorAdapter' },
    '@/hooks/useArena': { useArena: (value) => value.snapshot() },
    '@/lib/arena/sidecars': { createArenaSidecarLifecycle: () => ({ sync: async () => null, dispose: () => {} }) },
  };
  for (const child of ['ArenaHeader', 'ProblemPanel', 'DuelPanel', 'TestPanel', 'RoundScoreReveal', 'MatchResult', 'TeamChat']) dependencies[`./${child}`] = { [child]: child };
  const ui = componentHarness('../components/arena/ArenaWorkspace.tsx', 'ArenaWorkspace', dependencies, globals);
  t.after(() => ui.cleanup());

  // Render match-101 and let 5s timer dismiss the score notice
  const tree1 = ui.render({ transport });
  assert.ok(nodes(tree1).some((n) => n.props?.role === 'status' && text(n).includes('Problem 1 scored: 85/100')));
  assert.ok(scheduledTimer);
  scheduledTimer.fn();

  const treeDismissed = ui.render({ transport });
  assert.ok(!nodes(treeDismissed).some((n) => n.props?.role === 'status' && text(n).includes('Problem 1 scored: 85/100')));

  // Switch scope to match-102
  currentMatchId = 'match-102';
  snapshot.matchId = 'match-102';
  const treeNewScope = ui.render({ transport });
  assert.ok(nodes(treeNewScope).some((n) => n.props?.role === 'status' && text(n).includes('Problem 1 scored: 85/100')));
});

test('action error alert and polite score status notice render independently without interference', async (t) => {
  let scheduledTimer = null;
  const globals = {
    setTimeout: (fn, ms) => {
      scheduledTimer = { fn, ms };
      return 202;
    },
    clearTimeout: () => {},
  };

  const snapshot = {
    matchId: 'match-errors', mode: '1v1', roundPhase: 'CODING', round: 2, totalRounds: 3,
    problem: { id: 'p2', title: 'P2', starters: { Python: 'starter' } },
    language: 'Python', ready: { you: false, mate: false }, surrender: { you: false, mate: false },
    notice: null, progress: { self: { currentRound: 2, stage: 'CODING', lastScoredRound: 1, lastScore: 90 }, opponent: { currentRound: 1, stage: 'CODING' } },
  };
  const transport = {
    snapshot: () => snapshot,
    connection: () => 'connected',
    subscribe: () => () => {},
    leave: async () => {
      throw new Error('leave failed');
    },
  };
  const dependencies = {
    'next/dynamic': { default: () => 'EditorAdapter' },
    '@/hooks/useArena': { useArena: (value) => value.snapshot() },
    '@/lib/arena/sidecars': { createArenaSidecarLifecycle: () => ({ sync: async () => null, dispose: () => {} }) },
  };
  for (const child of ['ArenaHeader', 'ProblemPanel', 'DuelPanel', 'TestPanel', 'RoundScoreReveal', 'MatchResult', 'TeamChat']) dependencies[`./${child}`] = { [child]: child };
  const ui = componentHarness('../components/arena/ArenaWorkspace.tsx', 'ArenaWorkspace', dependencies, globals);
  t.after(() => ui.cleanup());

  // 1. Initial render has score status notice
  const tree1 = ui.render({ transport });
  const status1 = nodes(tree1).filter((n) => n.props?.role === 'status');
  assert.ok(status1.some((n) => text(n).includes('Problem 1 scored: 90/100')));
  assert.equal(nodes(tree1).filter((n) => n.props?.role === 'alert').length, 0);

  // 2. Trigger an action error (e.g. leave fails)
  const header = nodes(tree1).find((n) => n.type === 'ArenaHeader');
  assert.ok(header?.props?.onLeave);
  await header.props.onLeave();

  // 3. Both actionError (role="alert", destructive) AND score notice (role="status", polite) are rendered concurrently
  const treeError = ui.render({ transport });
  const alertNodes = nodes(treeError).filter((n) => n.props?.role === 'alert');
  const statusNodes = nodes(treeError).filter((n) => n.props?.role === 'status');

  assert.ok(alertNodes.some((n) => text(n).includes('Unable to leave the match. Please try again.')));
  assert.ok(statusNodes.some((n) => text(n).includes('Problem 1 scored: 90/100')));

  // 4. When the score notice timer expires, only status notice goes away, alert remains intact
  assert.ok(scheduledTimer);
  scheduledTimer.fn();

  const treeAfterTimer = ui.render({ transport });
  assert.ok(!nodes(treeAfterTimer).some((n) => n.props?.role === 'status' && text(n).includes('Problem 1 scored')));
  assert.ok(nodes(treeAfterTimer).some((n) => n.props?.role === 'alert' && text(n).includes('Unable to leave the match. Please try again.')));
});
