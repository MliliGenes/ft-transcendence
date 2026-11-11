import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const ROOM = {
  id: "room-1",
  code: "AB12CD",
  mode: "1v1",
  ownerUserId: "player-1",
  status: "open",
  createdAt: 1_700_000_000_000,
  expiresAt: 1_700_001_200_000,
  matchId: null,
};
const MEMBERS = [
  { roomId: "room-1", userId: "player-1", sideId: "left", ready: false, joinedAt: 1_700_000_000_000 },
];

function loadLobbyClient(fetch) {
  const source = readFileSync(new URL("../lib/arena/lobby.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  runInNewContext(compiled, {
    exports: loadedModule.exports,
    module: loadedModule,
    require(name) {
      assert.equal(name, "socket.io-client");
      return { io() { throw new Error("socket should not be used in an HTTP lobby lookup"); } };
    },
    fetch,
  });
  return loadedModule.exports;
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, json: async () => body };
}

test("lobby resume returns the member's active room without trying to join twice", async () => {
  const requests = [];
  const { LobbyClient } = loadLobbyClient(async (url, options = {}) => {
    requests.push({ url, method: options.method ?? "GET" });
    if (url === "/lobby/active") return response({ ok: true, queue: null, room: { room: ROOM, members: MEMBERS } });
    if (url === "/lobby/rooms/join") return response({ error: "already in this room" }, 409);
    throw new Error(`unexpected request: ${url}`);
  });

  const client = new LobbyClient("", "player-1", "test-token");
  const result = await client.getOrJoinRoom("ab12cd");

  assert.equal(result.room.id, "room-1");
  assert.deepEqual(requests, [{ url: "/lobby/active", method: "GET" }]);
});

test("lobby entry still joins by invite code when the user has no matching active room", async () => {
  const requests = [];
  const { LobbyClient } = loadLobbyClient(async (url, options = {}) => {
    requests.push({ url, method: options.method ?? "GET", body: options.body });
    if (url === "/lobby/active") return response({ ok: true, queue: null, room: null });
    if (url === "/lobby/rooms/join") return response({ ok: true, room: ROOM, members: MEMBERS, full: false });
    throw new Error(`unexpected request: ${url}`);
  });

  const client = new LobbyClient("", "player-2", "test-token");
  const result = await client.getOrJoinRoom("ab12cd");

  assert.equal(result.room.id, "room-1");
  assert.deepEqual(requests, [
    { url: "/lobby/active", method: "GET", body: undefined },
    { url: "/lobby/rooms/join", method: "POST", body: JSON.stringify({ code: "AB12CD" }) },
  ]);
});

test("a lobby URL for a matched room resolves to its active match route", () => {
  const { lobbyMatchPath } = loadLobbyClient(async () => { throw new Error("network should not be used"); });

  assert.equal(lobbyMatchPath({ ...ROOM, status: "matched", matchId: "match-1" }), "/play/match/match-1");
  assert.equal(lobbyMatchPath(ROOM), null);
});
