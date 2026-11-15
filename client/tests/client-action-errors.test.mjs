import assert from 'node:assert/strict';
import test from 'node:test';
import {
  button,
  componentHarness,
  flush,
  nodes,
  text,
} from './component-harness.mjs';

const rejection = new Error('private transport details');
const arenaCases = [
  ['run', 'Run Tests', 'CODING'],
  ['submit', 'Submit', 'CODING'],
  ['setReady', 'Ready (click to cancel)', 'CODING'],
  ['surrender', 'Request surrender', 'CODING'],
  ['setLanguage', null, 'CODING'],
  ['leave', null, 'CODING'],
  ['startRound', 'Begin Coding', 'MATCH_FOUND'],
  ['beginCoding', 'Begin Coding', 'ROUND_INTRO'],
];

for (const [method, label, phase] of arenaCases) {
  test(`arena ${method} handles rejection, retains drafts, releases controls, and can retry`, async (t) => {
    const snapshot = {
      problem: {
        id: 'problem-1',
        title: 'Test',
        starters: { Python: 'starter' },
      },
      language: 'Python',
      mode: '2v2',
      roundPhase: phase,
      round: 1,
      totalRounds: 3,
      ready: { you: true, mate: true },
      surrender: { you: false, mate: false },
      alpha: { members: [{}, {}] },
      docRevision: 7,
      notice: null,
      progress: {
        self: { currentRound: 1, stage: 'CODING' },
        opponent: { currentRound: 1, stage: 'CODING' },
      },
    };
    let reject;
    let input;
    const transport = {
      snapshot: () => snapshot,
      connection: () => 'connected',
      subscribe: () => () => {},
    };
    for (const [command] of arenaCases) transport[command] = async () => {};
    transport[method] = (value) => {
      input = value;
      return new Promise((_, fail) => {
        reject = fail;
      });
    };
    const dependencies = {
      'next/dynamic': { default: () => 'EditorAdapter' },
      '@/hooks/useArena': { useArena: (value) => value.snapshot() },
      '@/lib/arena/sidecars': {
        createArenaSidecarLifecycle: () => ({
          sync: async () => null,
          dispose: () => {},
        }),
      },
    };
    for (const child of [
      'ArenaHeader',
      'ProblemPanel',
      'DuelPanel',
      'TestPanel',
      'RoundScoreReveal',
      'MatchResult',
      'TeamChat',
    ]) {
      dependencies[`./${child}`] = { [child]: child };
    }
    const ui = componentHarness(
      '../components/arena/ArenaWorkspace.tsx',
      'ArenaWorkspace',
      dependencies,
    );
    t.after(() => ui.cleanup());
    const render = () => ui.render({ transport });
    const editor = (tree) =>
      nodes(tree).find((node) => node.type === 'EditorAdapter');
    const control = (tree) =>
      label
        ? button(tree, label)
        : nodes(tree).find(
            (node) =>
              node.type ===
              (method === 'leave'
                ? 'ArenaHeader'
                : method === 'advance'
                  ? 'RoundScoreReveal'
                  : 'select'),
          );
    const act = (tree) => {
      const props = control(tree).props;
      return label
        ? props.onClick()
        : method === 'leave'
          ? props.onLeave()
          : method === 'advance'
            ? props.onAdvance()
            : props.onChange({ target: { value: 'C++' } });
    };
    editor(render()).props.onChange('my unsaved draft');
    const pending = act(render());
    const busyTree = render();
    if (label || method === 'setLanguage')
      assert.equal(control(busyTree).props.disabled, true);
    if (method === 'advance' || method === 'leave')
      assert.equal(control(busyTree).props.pending, true);
    reject(rejection);
    await assert.doesNotReject(pending);
    const failedTree = render();
    const feedback =
      method === 'advance' ? control(failedTree).props.error : text(failedTree);
    assert.match(feedback, /Unable to/);
    assert.ok(
      !feedback.includes(rejection.message),
      'raw transport errors are not exposed',
    );
    assert.equal(editor(failedTree).props.code, 'my unsaved draft');
    assert.equal(snapshot.roundPhase, phase);
    if (label || method === 'setLanguage')
      assert.equal(control(failedTree).props.disabled, false);
    if (method === 'advance' || method === 'leave')
      assert.equal(control(failedTree).props.pending, false);
    if (method === 'run' || method === 'submit')
      assert.equal(input.code, 'my unsaved draft');
    if (method === 'submit') assert.equal(input.documentRevision, 7);
    transport[method] = async () => {};
    await act(failedTree);
    const recovered = render();
    assert.ok(!text(recovered).includes('Unable to'));
    if (method === 'advance')
      assert.equal(control(recovered).props.error, null);
    snapshot.notice = 'Unable to sync the match. Retrying automatically.';
    const withNotice = render();
    assert.match(
      method === 'advance' ? control(withNotice).props.error : text(withNotice),
      /Retrying automatically/,
    );
  });
}

for (const [method, label, progress] of [
  ['run', 'Run Tests', /running/i],
  ['submit', 'Submit', /evaluating/i],
]) {
  test(`arena ${method} keeps its label while pending, announces progress, and recovers`, async (t) => {
    const snapshot = {
      problem: {
        id: 'problem-1',
        title: 'Test',
        starters: { Python: 'starter' },
      },
      language: 'Python',
      mode: '2v2',
      roundPhase: 'CODING',
      round: 1,
      totalRounds: 3,
      ready: { you: true, mate: true },
      surrender: { you: false, mate: false },
      alpha: { members: [{}, {}] },
      docRevision: 7,
      notice: null,
      progress: {
        self: { currentRound: 1, stage: 'CODING' },
        opponent: { currentRound: 1, stage: 'CODING' },
      },
    };
    let resolveRequest;
    const transport = {
      snapshot: () => snapshot,
      connection: () => 'connected',
      subscribe: () => () => {},
    };
    for (const [command] of arenaCases) transport[command] = async () => {};
    transport[method] = () =>
      new Promise((resolve) => {
        resolveRequest = resolve;
      });
    const dependencies = {
      'next/dynamic': { default: () => 'EditorAdapter' },
      '@/hooks/useArena': { useArena: (value) => value.snapshot() },
      '@/lib/arena/sidecars': {
        createArenaSidecarLifecycle: () => ({
          sync: async () => null,
          dispose: () => {},
        }),
      },
    };
    for (const child of [
      'ArenaHeader',
      'ProblemPanel',
      'DuelPanel',
      'TestPanel',
      'RoundScoreReveal',
      'MatchResult',
      'TeamChat',
    ]) {
      dependencies[`./${child}`] = { [child]: child };
    }
    const ui = componentHarness(
      '../components/arena/ArenaWorkspace.tsx',
      'ArenaWorkspace',
      dependencies,
    );
    t.after(() => ui.cleanup());
    const render = () => ui.render({ transport });

    const pending = button(render(), label).props.onClick();
    const busyTree = render();

    const busyAction = button(busyTree, label);
    assert.match(
      text(busyAction),
      new RegExp(label.replace(/[()]/g, '\\$&')),
      'the action label must stay stable while loading',
    );
    assert.equal(
      busyAction.props['aria-busy'],
      true,
      'the in-flight control must be distinguishable from a disabled one',
    );
    assert.equal(busyAction.props.disabled, true);

    const announced = nodes(busyTree).find(
      (node) => node.props.role === 'status' && progress.test(text(node)),
    );
    assert.ok(
      announced,
      'expected an announced progress status while the request is pending',
    );
    assert.notEqual(
      announced.props['aria-hidden'],
      true,
      'the progress status must stay visible',
    );

    resolveRequest();
    await assert.doesNotReject(pending);

    const doneTree = render();
    assert.ok(
      !nodes(doneTree).some(
        (node) => node.props.role === 'status' && progress.test(text(node)),
      ),
      'the progress status should clear once the request ends',
    );
    assert.equal(button(doneTree, label).props.disabled, false);
    assert.notEqual(button(doneTree, label).props['aria-busy'], true);
  });
}

const arenaPendingCases = [
  ['setReady', 'Ready (click to cancel)', 'ready', /readiness/i],
  ['surrender', 'Request surrender', 'surrender', /surrender approval/i],
  ['setLanguage', null, 'language', /changing language/i],
  ['startRound', 'Begin Coding', 'begin', /preparing the coding round/i],
];

for (const [method, label, action, progress] of arenaPendingCases) {
  test(`arena ${action} pending announces progress and marks its control busy`, async (t) => {
    const snapshot = {
      problem: {
        id: 'problem-1',
        title: 'Test',
        starters: { Python: 'starter' },
      },
      language: 'Python',
      mode: '2v2',
      roundPhase: action === 'begin' ? 'MATCH_FOUND' : 'CODING',
      round: 1,
      totalRounds: 3,
      ready: { you: true, mate: true },
      surrender: { you: false, mate: false },
      alpha: { members: [{}, {}] },
      docRevision: 7,
      notice: null,
      progress: {
        self: { currentRound: 1, stage: 'CODING' },
        opponent: { currentRound: 1, stage: 'CODING' },
      },
    };
    let resolveRequest;
    const transport = {
      snapshot: () => snapshot,
      connection: () => 'connected',
      subscribe: () => () => {},
    };
    for (const [command] of arenaCases) transport[command] = async () => {};
    transport[method] = () =>
      new Promise((resolve) => {
        resolveRequest = resolve;
      });
    const dependencies = {
      'next/dynamic': { default: () => 'EditorAdapter' },
      '@/hooks/useArena': { useArena: (value) => value.snapshot() },
      '@/lib/arena/sidecars': {
        createArenaSidecarLifecycle: () => ({
          sync: async () => null,
          dispose: () => {},
        }),
      },
    };
    for (const child of [
      'ArenaHeader',
      'ProblemPanel',
      'DuelPanel',
      'TestPanel',
      'RoundScoreReveal',
      'MatchResult',
      'TeamChat',
    ]) {
      dependencies[`./${child}`] = { [child]: child };
    }
    const ui = componentHarness(
      '../components/arena/ArenaWorkspace.tsx',
      'ArenaWorkspace',
      dependencies,
    );
    t.after(() => ui.cleanup());
    const render = () => ui.render({ transport });
    const control = (tree) =>
      label
        ? button(tree, label)
        : nodes(tree).find((node) => node.type === 'select');

    const pending = label
      ? control(render()).props.onClick()
      : control(render()).props.onChange({ target: { value: 'C++' } });
    const busyTree = render();

    const announced = nodes(busyTree).find(
      (node) => node.props.role === 'status' && progress.test(text(node)),
    );
    assert.ok(
      announced,
      'expected a named progress status while the action is pending',
    );
    assert.equal(
      control(busyTree).props['aria-busy'],
      true,
      'the in-flight control must be marked busy',
    );

    resolveRequest();
    await assert.doesNotReject(pending);

    const doneTree = render();
    assert.ok(
      !nodes(doneTree).some(
        (node) => node.props.role === 'status' && progress.test(text(node)),
      ),
      'the progress status should clear once the action resolves',
    );
    assert.notEqual(control(doneTree).props['aria-busy'], true);
  });
}

test('the reveal overlay displays feedback and disables advancement while pending', () => {
  const ui = componentHarness(
    '../components/arena/RoundScoreReveal.tsx',
    'RoundScoreReveal',
  );
  const reveal = { roundScore: 5, groups: [], totals: { you: 5, opponent: 0 } };
  const tree = ui.render({
    reveal,
    round: 1,
    totalRounds: 3,
    onAdvance: async () => {},
    pending: true,
    error: 'Unable to advance the match.',
  });
  assert.equal(button(tree, 'Next Round').props.disabled, true);
  assert.match(
    text(nodes(tree).find((node) => node.props.role === 'alert')),
    /Unable to advance/,
  );

  const advancing = ui.render({
    reveal,
    round: 1,
    totalRounds: 3,
    onAdvance: async () => {},
    pending: true,
    error: null,
    status: 'Advancing to the next round…',
  });
  assert.equal(
    button(advancing, 'Next Round').props['aria-busy'],
    true,
    'the advancing control must be marked busy',
  );
  assert.match(
    text(nodes(advancing).find((node) => node.props.role === 'status')),
    /Advancing to the next round/,
  );
});

test('the arena header marks the leave control busy while the leave request is pending', () => {
  const ui = componentHarness(
    '../components/arena/ArenaHeader.tsx',
    'ArenaHeader',
  );
  const tree = ui.render({
    snapshot: {
      round: 1,
      totalRounds: 3,
      remainingSeconds: 90,
      mode: '1v1',
      roundPhase: 'CODING',
      you: { name: 'You' },
      opponent: { name: 'Rival' },
      reveal: null,
      reveals: [],
      progress: {
        self: { currentRound: 1, stage: 'CODING' },
        opponent: { currentRound: 1, stage: 'CODING' },
      },
    },
    connection: 'connected',
    onLeave: async () => {},
    pending: true,
    pendingAction: 'leave',
  });
  assert.equal(
    button(tree, 'Leave').props['aria-busy'],
    true,
    'the leaving control must be marked busy',
  );
  assert.equal(button(tree, 'Leave').props.disabled, true);
});

async function lobbyHarness(methods = {}, navigator = {}) {
  const data = {
    room: { id: 'room-1', ownerUserId: 'player-1', mode: '1v1' },
    members: [
      { userId: 'player-1', sideId: 'left', ready: true },
      { userId: 'player-2', sideId: 'right', ready: true },
    ],
  };
  const routes = [];
  class LobbyClient {
    constructor() {
      Object.assign(this, methods);
    }
    connectSocket() {
      return () => {};
    }
    async getOrJoinRoom() {
      return data;
    }
    joinRoomChannel() {}
    leaveRoomChannel() {}
    disconnect() {}
  }
  const ui = componentHarness(
    '../components/arena/LobbyView.tsx',
    'LobbyView',
    {
      'next/navigation': {
        useRouter: () => ({
          push: (path) => routes.push(path),
          replace: (path) => routes.push(path),
        }),
      },
      '@tanstack/react-query': { useQueries: () => [] },
      '@/components/auth/auth-provider': {
        useAuth: () => ({
          session: { user: { id: 'player-1' }, accessToken: 'test-token' },
          isRestoring: false,
        }),
      },
      '@/components/app/account-avatar': { AccountAvatar: 'AccountAvatar' },
      '@/lib/arena/lobby': { LobbyClient, lobbyMatchPath: () => null },
      '@/lib/accounts/client': { accountApi: {} },
      '@/lib/accounts/images': {},
    },
    { navigator },
  );
  const render = () => ui.render({ code: 'abc123' });
  render();
  await flush();
  return { ...ui, render, data, routes };
}

for (const [method, label] of [
  ['setReady', 'Ready (Click to Cancel)'],
  ['setSide', 'Switch Team'],
  ['startRoom', 'Start Match'],
  ['leaveRoom', 'Leave Lobby'],
]) {
  test(`lobby ${method} failure keeps the lobby visible and releases controls`, async (t) => {
    let reject;
    const ui = await lobbyHarness({
      [method]: () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    });
    t.after(() => ui.cleanup());
    const before = structuredClone(ui.data);
    const pending = button(ui.render(), label).props.onClick();
    assert.equal(button(ui.render(), label).props.disabled, true);
    reject(rejection);
    await assert.doesNotReject(pending);
    const tree = ui.render();
    assert.match(text(tree), /Match Lobby/);
    assert.match(text(tree), /Unable to/);
    assert.ok(!text(tree).includes(rejection.message));
    assert.equal(button(tree, label).props.disabled, false);
    assert.deepEqual(ui.data, before);
    assert.deepEqual(ui.routes, []);
  });
}

test('lobby pending action announces progress, holds controls disabled, then recovers', async (t) => {
  let resolveAction;
  const ui = await lobbyHarness({
    setReady: () =>
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
  });
  t.after(() => ui.cleanup());

  const pending = button(
    ui.render(),
    'Ready (Click to Cancel)',
  ).props.onClick();
  const busyTree = ui.render();

  const status = nodes(busyTree).find((node) => node.props.role === 'status');
  assert.ok(
    status,
    'expected a status region while the lobby action is pending',
  );
  assert.notEqual(
    status.props['aria-hidden'],
    true,
    'the progress status must stay visible',
  );
  assert.match(
    text(status),
    /readiness/i,
    'the status should name the pending action',
  );

  const busyAction = button(busyTree, 'Ready (Click to Cancel)');
  assert.match(
    text(busyAction),
    /Ready \(Click to Cancel\)/,
    'the action label must stay stable while loading',
  );
  assert.equal(
    busyAction.props['aria-busy'],
    true,
    'the in-flight action must be distinguishable from a disabled one',
  );
  assert.equal(busyAction.props.disabled, true);
  assert.equal(button(busyTree, 'Switch Team').props.disabled, true);
  assert.equal(button(busyTree, 'Leave Lobby').props.disabled, true);
  assert.equal(button(busyTree, 'Copy Code').props.disabled, true);

  resolveAction(ui.data);
  await assert.doesNotReject(pending);

  const doneTree = ui.render();
  const cleared = nodes(doneTree).find((node) => node.props.role === 'status');
  assert.ok(
    !cleared || text(cleared).trim() === '',
    'the progress status should clear once the action resolves',
  );
  assert.equal(
    button(doneTree, 'Ready (Click to Cancel)').props.disabled,
    false,
  );
  assert.equal(button(doneTree, 'Switch Team').props.disabled, false);
  assert.equal(button(doneTree, 'Leave Lobby').props.disabled, false);
  assert.equal(button(doneTree, 'Copy Code').props.disabled, false);
});

for (const [name, navigator] of [
  ['unavailable', {}],
  [
    'denied',
    {
      clipboard: {
        writeText: async () => {
          throw rejection;
        },
      },
    },
  ],
]) {
  test(`${name} clipboard access offers manual copying without false success`, async (t) => {
    const ui = await lobbyHarness({}, navigator);
    t.after(() => ui.cleanup());
    await assert.doesNotReject(
      button(ui.render(), 'Copy Code').props.onClick(),
    );
    const tree = ui.render();
    assert.match(text(tree), /Select and copy the invite code above/);
    assert.ok(!text(tree).includes('Copied!'));
    assert.equal(button(tree, 'Copy Code').props.disabled, false);
  });
}

test('clipboard success is shown only after the write completes', async (t) => {
  let complete;
  let copiedCode;
  const ui = await lobbyHarness(
    {},
    {
      clipboard: {
        writeText: (value) => {
          copiedCode = value;
          return new Promise((resolve) => {
            complete = resolve;
          });
        },
      },
    },
  );
  t.after(() => ui.cleanup());
  const pending = button(ui.render(), 'Copy Code').props.onClick();
  assert.ok(!text(ui.render()).includes('Copied!'));
  complete();
  await pending;
  assert.equal(copiedCode, 'ABC123');
  assert.match(text(ui.render()), /Copied!/);
});
