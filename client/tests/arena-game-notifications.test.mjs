import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadTypeScript(file) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = { exports, module: { exports }, require: () => ({}) };
  runInNewContext(compiled, context);
  return context.module.exports;
}

const notifications = loadTypeScript("../lib/arena/game-notifications.ts");

// The same canonical notification the Chat service writes (see
// chat-service/src/chat/game-notification-format.ts).
const started = [
  "🎮 Code Arena",
  "match-started · 1v1 duel started: alice vs bob",
  "[View match](/play/match/2f1c9d0e-6b3a-4f2e-9a7d-8c5b1e4a2f30)",
].join("\n");
const result = [
  "🎮 Code Arena",
  "match-result · alice won 300 – 225",
  "[View match](/play/match/2f1c9d0e-6b3a-4f2e-9a7d-8c5b1e4a2f30)",
].join("\n");
const cancelled = ["🎮 Code Arena", "challenge-cancelled · the duel challenge expired before it started"].join("\n");

test("Code Arena notifications parse the shapes the chat service writes", () => {
  assert.deepEqual(
    { ...notifications.parseGameNotification(started) },
    { type: "match-started", summary: "1v1 duel started: alice vs bob", matchId: "2f1c9d0e-6b3a-4f2e-9a7d-8c5b1e4a2f30" },
  );
  assert.deepEqual(
    { ...notifications.parseGameNotification(result) },
    { type: "match-result", summary: "alice won 300 – 225", matchId: "2f1c9d0e-6b3a-4f2e-9a7d-8c5b1e4a2f30" },
  );
  assert.deepEqual(
    { ...notifications.parseGameNotification(cancelled) },
    { type: "challenge-cancelled", summary: "the duel challenge expired before it started", matchId: null },
  );
});

test("ordinary chat messages are never read as game notifications", () => {
  assert.equal(notifications.parseGameNotification("hello there"), null);
  assert.equal(notifications.parseGameNotification("🎮 Code Arena\njust a message"), null);
  assert.equal(notifications.parseGameNotification("🎮 Code Arena\nmatch-won · fake"), null);
  assert.equal(notifications.parseGameNotification(null), null);
  assert.equal(notifications.parseGameNotification(undefined), null);
});

test("a notification without a match link has no match to open", () => {
  const parsed = notifications.parseGameNotification(["🎮 Code Arena", "match-result · draw 250 – 250"].join("\n"));
  assert.equal(parsed.type, "match-result");
  assert.equal(parsed.matchId, null);
});

test("notification titles name the lifecycle step", () => {
  assert.equal(notifications.gameNotificationTitle("match-started"), "Match started");
  assert.equal(notifications.gameNotificationTitle("match-result"), "Match result");
  assert.equal(notifications.gameNotificationTitle("challenge-cancelled"), "Challenge cancelled");
});

test("a duel invitation links its room code to the conversation", async () => {
  const sent = [];
  const source = readFileSync(new URL("../lib/arena/invitations.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    module: { exports },
    crypto: webcrypto,
    require(name) {
      if (name.endsWith("/lobby") || name === "./lobby") {
        return { LobbyClient: class { async createRoom() { return { room: { id: "room-1", code: "AB12CD" } }; } async leaveRoom() {} } };
      }
      if (name.includes("chat/client")) {
        return { chatApi: { send: async (...args) => { sent.push(args); } } };
      }
      throw new Error(`Unexpected import ${name}`);
    },
  };
  runInNewContext(compiled, context);
  const invitations = context.module.exports;

  await invitations.createCodeArenaInvite({ userId: "u1", token: "t", conversationId: "c1" });

  assert.equal(sent.length, 1);
  assert.equal(sent[0][1], "🎮 Code Arena challenge\n\n[Accept & Join](/play/lobby/AB12CD)");
  assert.deepEqual({ ...sent[0][5] }, { roomCode: "AB12CD" });
});
