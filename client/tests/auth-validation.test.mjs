import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/auth/validation.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledModule = { exports: {} };
runInNewContext(compiled, {
  module: compiledModule,
  exports: compiledModule.exports,
  TextEncoder,
});
const { validateAuth, validateNewPassword } = compiledModule.exports;
const validate = (mode, values) => ({ ...validateAuth(mode, values) });

const valid = { username: "player1", email: "user@example.com", password: "abcdefgh" };

test("registration accepts documented fields and boundary lengths", () => {
  for (const length of [3, 30]) {
    for (const passwordLength of [8, 32]) {
      assert.deepEqual(validate("register", { ...valid, username: "a".repeat(length), password: "a".repeat(passwordLength) }), {});
    }
  }
});

test("registration rejects invalid fields and lengths", () => {
  assert.deepEqual(Object.keys(validate("register", { username: "", email: "bad", password: "" })), ["username", "email", "password"]);
  for (const length of [2, 31]) assert.ok(validate("register", { ...valid, username: "a".repeat(length) }).username);
  for (const length of [7, 33]) assert.ok(validate("register", { ...valid, password: "a".repeat(length) }).password);
});

test("password byte limit handles Unicode without trimming credentials", () => {
  assert.deepEqual(validate("register", { ...valid, password: "😀".repeat(18) }), {});
  assert.ok(validate("register", { ...valid, password: "😀".repeat(19) }).password);
  assert.deepEqual(validate("register", { ...valid, password: "  abcdef" }), {});
});

test("login does not impose new registration length restrictions", () => {
  assert.deepEqual(validate("login", { ...valid, username: "", password: "a" }), {});
  assert.deepEqual(validate("login", { ...valid, password: "a".repeat(72) }), {});
  assert.ok(validate("login", { ...valid, password: "a".repeat(73) }).password);
  assert.ok(validate("login", { ...valid, password: "" }).password);
  assert.ok(validate("login", { ...valid, email: "bad" }).email);
});

test("password updates use the backend character and UTF-8 byte limits", () => {
  assert.equal(validateNewPassword("abcdefgh"), undefined);
  assert.equal(validateNewPassword("short"), "Use 8–32 characters.");
  assert.equal(validateNewPassword("😀".repeat(19)), "Password must be no more than 72 UTF-8 bytes.");
});
