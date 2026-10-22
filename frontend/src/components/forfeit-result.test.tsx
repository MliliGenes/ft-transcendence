import { renderToStaticMarkup } from "react-dom/server";
import { io } from "socket.io-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestSocket } from "../../test/socket.js";
import { SocketArenaTransport } from "../arena/socket.js";
import { ArenaPage } from "./ArenaPage.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

const transports: SocketArenaTransport[] = [];
afterEach(() => {
  for (const transport of transports.splice(0)) transport.disconnect();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function forfeitTransport(mySide: "left" | "right", remainingMs = 60_000, reason = "leave") {
  const userId = `player-${mySide}`;
  const snapshot = {
    mode: "1v1" as const,
    roundPhase: "MATCH_COMPLETE" as const,
    round: 2,
    totalRounds: 3,
    remainingMs,
    problem: {
      id: "even-ledger", title: "Even Ledger", description: "Alternating sum.",
      examples: [], starters: { Python: "def ledger_sum(nums):\n    return 0\n" },
    },
    tests: [],
    mySide,
    sides: {
      left: { status: "locked" as const, submissions: 0, presence: "online" as const },
      right: { status: "locked" as const, submissions: 0, presence: "offline" as const },
    },
    reveal: null,
    revision: 3,
    pendingEvaluation: false,
    final: {
      scores: { left: 28, right: 100 }, outcome: "left" as const, winner: "left",
      forfeit: { winner: "left", loser: "right", reason },
    },
  };
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "https://arena.test/api/accounts/me") {
      return new Response(JSON.stringify({ id: userId }), { status: 200 });
    }
    if (String(input) === "https://arena.test/matches/forfeit-match/snapshot") {
      return new Response(JSON.stringify(snapshot), { status: 200 });
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  }));
  const socket = new TestSocket();
  const connect = socket.connect.bind(socket);
  socket.connect = () => {
    connect();
    socket.server("snapshot", snapshot);
    return socket;
  };
  vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
  const transport = new SocketArenaTransport({
    apiBase: "https://arena.test/api", socketBase: "https://arena.test",
    matchId: "forfeit-match", getAccessToken: () => "unit-test-access-token",
    onAuthExpired: async () => {},
  });
  transports.push(transport);
  await transport.connect();
  return transport;
}

describe("forfeit result from the Game snapshot to the Arena screen", () => {
  it.each([
    { side: "left" as const, remainingMs: 60_000, outcome: "You win by forfeit.", departure: "Opponent left the match.", scores: "you 28 · opponent 100" },
    { side: "right" as const, remainingMs: 60_000, outcome: "Opponent wins by forfeit.", departure: "You forfeited.", scores: "you 100 · opponent 28" },
    { side: "left" as const, remainingMs: 0, outcome: "You win by forfeit.", departure: "Opponent left the match.", scores: "you 28 · opponent 100" },
    { side: "right" as const, remainingMs: 0, outcome: "Opponent wins by forfeit.", departure: "You forfeited.", scores: "you 100 · opponent 28" },
  ])("shows $side the leave result without a Reveal at $remainingMs ms", async ({ side, remainingMs, outcome, departure, scores }) => {
    const transport = await forfeitTransport(side, remainingMs);
    const html = renderToStaticMarkup(<ArenaPage transport={transport} />);

    expect(html).toContain('aria-label="Match result"');
    expect(html).toContain(outcome);
    expect(html).toContain(departure);
    expect(html).toContain(scores);
    expect(html).not.toContain("Match complete after");
    expect(html).not.toContain('aria-label="Round 2 score reveal"');
    expect(html).not.toContain("See final result");
    expect(html).not.toContain(">Submit</button>");
    expect(html).not.toContain(">Next round</button>");
  });

  it.each([
    { side: "left" as const, outcome: "You win by forfeit." },
    { side: "right" as const, outcome: "Opponent wins by forfeit." },
  ])("shows $side a reconnect-grace forfeit without claiming a deliberate leave", async ({ side, outcome }) => {
    const transport = await forfeitTransport(side, 0, "grace-expired");
    const html = renderToStaticMarkup(<ArenaPage transport={transport} />);

    expect(html).toContain('aria-label="Match result"');
    expect(html).toContain(outcome);
    expect(html).not.toContain("left the match");
    expect(html).not.toContain("See final result");
  });
});
