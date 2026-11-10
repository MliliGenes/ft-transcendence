import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/arena/chat.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(compiled, {
  module,
  exports: module.exports,
  require(name) {
    assert.equal(name, "socket.io-client");
    return { io() { throw new Error("socket is not needed for this test"); } };
  },
});

test("authoritative team-chat history replaces messages removed after account deletion", () => {
  const client = new module.exports.TeamChatClient({ baseUrl: "", userId: "viewer", matchId: "match" });
  client.applyIncomingEntry({ id: "deleted-message", senderUserId: "deleted-user", text: "private", timestamp: 1, type: "text" });
  client.replaceHistory([{ id: "retained-message", senderUserId: "teammate", text: "hello", timestamp: 2, type: "text" }]);

  assert.equal(JSON.stringify(client.getMessages()), JSON.stringify([
    { id: "retained-message", senderUserId: "teammate", text: "hello", timestamp: 2, type: "text" },
  ]));
});
