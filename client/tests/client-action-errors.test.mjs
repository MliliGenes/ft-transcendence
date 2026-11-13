import assert from "node:assert/strict";
import test from "node:test";
import { button, componentHarness, flush, nodes, text } from "./component-harness.mjs";

const rejection = new Error("private transport details");
const arenaCases = [
  ["run", "Run Tests", "CODING"],
  ["submit", "Submit", "CODING"],
  ["setReady", "Ready (click to cancel)", "CODING"],
  ["surrender", "Request surrender", "CODING"],
  ["setLanguage", null, "CODING"],
  ["leave", null, "CODING"],
  ["startRound", "Begin Coding", "MATCH_FOUND"],
  ["beginCoding", "Begin Coding", "ROUND_INTRO"],
  ["advance", null, "SCORE_REVEAL"],
];

for (const [method, label, phase] of arenaCases) {
  test(`arena ${method} handles rejection, retains drafts, releases controls, and can retry`, async t => {
    const snapshot = {
      problem: { id: "problem-1", title: "Test", starters: { Python: "starter" } },
      language: "Python", mode: "2v2", roundPhase: phase, round: 1, totalRounds: 3,
      ready: { you: true, mate: true }, surrender: { you: false, mate: false },
      alpha: { members: [{}, {}] }, docRevision: 7, notice: null,
    };
    let reject;
    let input;
    const transport = { snapshot: () => snapshot, connection: () => "connected" };
    for (const [command] of arenaCases) transport[command] = async () => {};
    transport[method] = value => { input = value; return new Promise((_, fail) => { reject = fail; }); };
    const dependencies = {
      "next/dynamic": { default: () => "EditorAdapter" },
      "@/hooks/useArena": { useArena: value => value.snapshot() },
      "@/lib/arena/sidecars": { createArenaSidecarLifecycle: () => ({ sync: async () => null }) },
    };
    for (const child of ["ArenaHeader", "ProblemPanel", "DuelPanel", "TestPanel", "RoundScoreReveal", "MatchResult", "TeamChat"]) {
      dependencies[`./${child}`] = { [child]: child };
    }
    const ui = componentHarness("../components/arena/ArenaWorkspace.tsx", "ArenaWorkspace", dependencies);
    t.after(() => ui.cleanup());
    const render = () => ui.render({ transport });
    const editor = tree => nodes(tree).find(node => node.type === "EditorAdapter");
    const control = (tree, busy = false) => label ? button(tree, busy && method === "run" ? "Running" : busy && method === "submit" ? "Evaluating" : label)
      : nodes(tree).find(node => node.type === (method === "leave" ? "ArenaHeader" : method === "advance" ? "RoundScoreReveal" : "select"));
    const act = tree => {
      const props = control(tree).props;
      return label ? props.onClick() : method === "leave" ? props.onLeave()
        : method === "advance" ? props.onAdvance() : props.onChange({ target: { value: "C++" } });
    };
    editor(render()).props.onChange("my unsaved draft");
    const pending = act(render());
    const busyTree = render();
    if (label || method === "setLanguage") assert.equal(control(busyTree, true).props.disabled, true);
    if (method === "advance" || method === "leave") assert.equal(control(busyTree).props.pending, true);
    reject(rejection);
    await assert.doesNotReject(pending);
    const failedTree = render();
    const feedback = method === "advance" ? control(failedTree).props.error : text(failedTree);
    assert.match(feedback, /Unable to/);
    assert.ok(!feedback.includes(rejection.message), "raw transport errors are not exposed");
    assert.equal(editor(failedTree).props.code, "my unsaved draft");
    assert.equal(snapshot.roundPhase, phase);
    if (label || method === "setLanguage") assert.equal(control(failedTree).props.disabled, false);
    if (method === "advance" || method === "leave") assert.equal(control(failedTree).props.pending, false);
    if (method === "run" || method === "submit") assert.equal(input.code, "my unsaved draft");
    if (method === "submit") assert.equal(input.documentRevision, 7);
    transport[method] = async () => {};
    await act(failedTree);
    const recovered = render();
    assert.ok(!text(recovered).includes("Unable to"));
    if (method === "advance") assert.equal(control(recovered).props.error, null);
    snapshot.notice = "Unable to sync the match. Retrying automatically.";
    const withNotice = render();
    assert.match(method === "advance" ? control(withNotice).props.error : text(withNotice), /Retrying automatically/);
  });
}

test("the reveal overlay displays feedback and disables advancement while pending", () => {
  const ui = componentHarness("../components/arena/RoundScoreReveal.tsx", "RoundScoreReveal");
  const tree = ui.render({
    reveal: { roundScore: 5, groups: [], totals: { you: 5, opponent: 0 } },
    round: 1, totalRounds: 3, onAdvance: async () => {}, pending: true, error: "Unable to advance the match.",
  });
  assert.equal(button(tree, "Next Round").props.disabled, true);
  assert.match(text(nodes(tree).find(node => node.props.role === "alert")), /Unable to advance/);
});

async function lobbyHarness(methods = {}, navigator = {}) {
  const data = {
    room: { id: "room-1", ownerUserId: "player-1", mode: "1v1" },
    members: [{ userId: "player-1", sideId: "left", ready: true }, { userId: "player-2", sideId: "right", ready: true }],
  };
  const routes = [];
  class LobbyClient {
    constructor() { Object.assign(this, methods); }
    connectSocket() { return () => {}; }
    async getOrJoinRoom() { return data; }
    joinRoomChannel() {}
    leaveRoomChannel() {}
    disconnect() {}
  }
  const ui = componentHarness("../components/arena/LobbyView.tsx", "LobbyView", {
    "next/navigation": { useRouter: () => ({ push: path => routes.push(path), replace: path => routes.push(path) }) },
    "@tanstack/react-query": { useQueries: () => [] },
    "@/components/auth/auth-provider": { useAuth: () => ({ session: { user: { id: "player-1" }, accessToken: "test-token" }, isRestoring: false }) },
    "@/components/app/account-avatar": { AccountAvatar: "AccountAvatar" },
    "@/lib/arena/lobby": { LobbyClient, lobbyMatchPath: () => null },
    "@/lib/accounts/client": { accountApi: {} },
    "@/lib/accounts/images": {},
  }, { navigator });
  const render = () => ui.render({ code: "abc123" });
  render();
  await flush();
  return { ...ui, render, data, routes };
}

for (const [method, label] of [["setReady", "Ready (Click to Cancel)"], ["setSide", "Switch Team"], ["startRoom", "Start Match"], ["leaveRoom", "Leave Lobby"]]) {
  test(`lobby ${method} failure keeps the lobby visible and releases controls`, async t => {
    let reject;
    const ui = await lobbyHarness({ [method]: () => new Promise((_, fail) => { reject = fail; }) });
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

for (const [name, navigator] of [["unavailable", {}], ["denied", { clipboard: { writeText: async () => { throw rejection; } } }]]) {
  test(`${name} clipboard access offers manual copying without false success`, async t => {
    const ui = await lobbyHarness({}, navigator);
    t.after(() => ui.cleanup());
    await assert.doesNotReject(button(ui.render(), "Copy Code").props.onClick());
    const tree = ui.render();
    assert.match(text(tree), /Select and copy the invite code above/);
    assert.ok(!text(tree).includes("Copied!"));
    assert.equal(button(tree, "Copy Code").props.disabled, false);
  });
}

test("clipboard success is shown only after the write completes", async t => {
  let complete;
  let copiedCode;
  const ui = await lobbyHarness({}, { clipboard: { writeText: value => { copiedCode = value; return new Promise(resolve => { complete = resolve; }); } } });
  t.after(() => ui.cleanup());
  const pending = button(ui.render(), "Copy Code").props.onClick();
  assert.ok(!text(ui.render()).includes("Copied!"));
  complete();
  await pending;
  assert.equal(copiedCode, "ABC123");
  assert.match(text(ui.render()), /Copied!/);
});
