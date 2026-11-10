import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("same-origin lobby sockets use Nginx's Game service path", () => {
  const source = readFileSync(new URL("../lib/arena/lobby.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let socketOptions;
  const fakeSocket = { on() { return this; }, disconnect() {} };
  const exports = {};
  const context = {
    exports,
    module: { exports },
    require(name) {
      assert.equal(name, "socket.io-client");
      return { io(_url, options) { socketOptions = options; return fakeSocket; } };
    },
  };
  runInNewContext(compiled, context);

  const client = new context.module.exports.LobbyClient("", "player-1");
  const cleanup = client.connectSocket({});
  assert.equal(socketOptions.path, "/api/game/socket.io");
  cleanup();
});
