import { afterEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import { TestSocket } from "../../test/socket.js";
import { SocketArenaTransport } from "./socket.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function teamSnapshot() {
  return {
    mode: "2v2",
    roundPhase: "CODING",
    round: 2,
    totalRounds: 3,
    remainingMs: 7340,
    problem: { problemVersionId: "problem-v1", title: "Problem", description: "", examples: [] },
    tests: [],
    mySide: "right",
    sides: {
      left: { status: "running", submissions: 2, presence: "online" },
      right: { status: "coding", submissions: 1, presence: "offline" },
    },
    teams: [
      { side: "left", activity: "running", submissions: 2, documentRevision: null, language: null,
        members: [
          { userId: "rival-1", presence: "online", ready: false, readyRevision: null },
          { userId: "rival-2", presence: "offline", ready: false, readyRevision: null },
        ] },
      { side: "right", activity: "coding", submissions: 3, documentRevision: 0, language: "C++",
        members: [
          { userId: "mate", presence: "offline", ready: false, readyRevision: null },
          { userId: "viewer", presence: "online", ready: true, readyRevision: 0 },
        ] },
    ],
    reveal: null,
    revision: 7,
    pendingEvaluation: false,
    final: null,
  };
}

async function readSnapshot(serverSnapshot: unknown, userId = "viewer") {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(serverSnapshot), { status: 200 })));
  const socket = new TestSocket();
  vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
  const transport = new SocketArenaTransport({ baseUrl: "http://arena.test", userId, matchId: "match" });
  const connecting = transport.connect();
  try {
    await vi.waitFor(() => expect(socket.connected).toBe(true), { interval: 1 });
    socket.server("snapshot", serverSnapshot);
    await connecting;
    return transport.snapshot();
  } finally {
    transport.disconnect();
  }
}

describe("server snapshot adaptation through the Match transport", () => {
  it("orients real teams and readiness around a viewer in the right team's second slot", async () => {
    const snapshot = await readSnapshot(teamSnapshot());
    expect(snapshot.alpha).toEqual({
      id: "right", score: null, submissions: 3,
      members: [
        { name: "mate", status: "coding", presence: "offline", submissions: 3 },
        { name: "viewer", status: "coding", presence: "online", submissions: 3 },
      ],
    });
    expect(snapshot.beta).toEqual({
      id: "left", score: null, submissions: 2,
      members: [
        { name: "rival-1", status: "running", presence: "online", submissions: 2 },
        { name: "rival-2", status: "running", presence: "offline", submissions: 2 },
      ],
    });
    expect(snapshot.ready).toEqual({ you: true, mate: false });
    expect(snapshot.readyRevision).toEqual({ you: 0, mate: null });
    expect(snapshot.docRevision).toBe(0);
    expect(snapshot.language).toBe("C++");
    expect(snapshot.problem.id).toBe("problem-v1");
    expect(snapshot.you).toEqual({ name: "You", status: "coding", presence: "offline", submissions: 1 });
  });

  it("keeps the legacy team placeholders when server team state is absent", async () => {
    const snapshot = await readSnapshot({ ...teamSnapshot(), teams: undefined });
    expect(snapshot.alpha).toEqual({ id: "alpha", score: null, submissions: 1,
      members: [snapshot.you, { name: "Mate", status: "coding", presence: "online", submissions: 0 }] });
    expect(snapshot.beta).toEqual({ id: "beta", score: null, submissions: 2,
      members: [snapshot.opponent, { name: "Rival 2", status: "coding", presence: "online", submissions: 0 }] });
    expect(snapshot.ready).toEqual({ you: false, mate: false });
    expect(snapshot.readyRevision).toBeNull();
    expect(snapshot.docRevision).toBeNull();
    expect(snapshot.language).toBe("Python");
  });

  it("retains safe member and language fallbacks for incomplete team state", async () => {
    const server = teamSnapshot();
    server.teams[0]!.members = [];
    server.teams[1]!.members = [server.teams[1]!.members[1]!];
    server.teams[1]!.language = null;
    const snapshot = await readSnapshot(server);
    expect(snapshot.alpha.members[1]).toEqual({ name: "?", status: "coding", presence: "offline", submissions: 3 });
    expect(snapshot.beta.members.map((member) => member.name)).toEqual(["?", "?"]);
    expect(snapshot.ready).toEqual({ you: true, mate: false });
    expect(snapshot.readyRevision).toEqual({ you: 0, mate: null });
    expect(snapshot.language).toBe("Python");
  });

  it("uses the existing fallback orientation when the viewer has no team record", async () => {
    const snapshot = await readSnapshot(teamSnapshot(), "unresolved-viewer");
    expect(snapshot.alpha.id).toBe("alpha");
    expect(snapshot.beta.id).toBe("left");
    expect(snapshot.ready).toEqual({ you: false, mate: false });
    expect(snapshot.readyRevision).toBeNull();
  });

  it("keeps safe side, problem and expired-clock fallbacks for a sparse snapshot", async () => {
    const snapshot = await readSnapshot({
      ...teamSnapshot(),
      sides: {},
      teams: undefined,
      problem: { title: "Unknown problem", description: "", examples: [] },
      remainingMs: -1,
      revision: 0,
    });
    expect(snapshot.you).toEqual({ name: "You", status: "coding", presence: "online", submissions: 0 });
    expect(snapshot.opponent).toEqual({ name: "Opponent", status: "coding", presence: "online", submissions: 0 });
    expect(snapshot.problem.id).toBe("unknown-problem");
    expect(snapshot.remainingSeconds).toBe(0);
    expect(snapshot.clock?.remainingMs).toBe(0);
    expect(snapshot.revision).toBe(0);
  });
});
