import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadLobbyModule() {
  const source = readFileSync(new URL("../lib/arena/lobby.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    module: { exports },
    require(name) {
      assert.equal(name, "socket.io-client");
      return { io() { return { on() { return this; }, disconnect() {} }; } };
    },
  };
  runInNewContext(compiled, context);
  return context.module.exports;
}

test("lobby identities show public names and never fall back to account ids", () => {
  const { lobbyMemberName } = loadLobbyModule();
  assert.equal(lobbyMemberName({ displayName: "Amina Noor", username: "amina" }), "Amina Noor");
  assert.equal(lobbyMemberName({ displayName: null, username: "amina" }), "@amina");
  assert.equal(lobbyMemberName(undefined), "Player");
});
