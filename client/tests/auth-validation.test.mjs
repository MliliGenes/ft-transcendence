import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAuth } from "../lib/auth/validation.ts";

const valid = { username: "player1", email: "user@example.com", password: "abcdefgh" };

test("registration accepts documented fields and boundary lengths", () => {
  for (const length of [3, 30]) {
    for (const passwordLength of [8, 32]) {
      assert.deepEqual(validateAuth("register", { ...valid, username: "a".repeat(length), password: "a".repeat(passwordLength) }), {});
    }
  }
});

test("registration rejects invalid fields and lengths", () => {
  assert.deepEqual(Object.keys(validateAuth("register", { username: "", email: "bad", password: "" })), ["username", "email", "password"]);
  for (const length of [2, 31]) assert.ok(validateAuth("register", { ...valid, username: "a".repeat(length) }).username);
  for (const length of [7, 33]) assert.ok(validateAuth("register", { ...valid, password: "a".repeat(length) }).password);
});

test("password byte limit handles Unicode without trimming credentials", () => {
  assert.deepEqual(validateAuth("register", { ...valid, password: "😀".repeat(18) }), {});
  assert.ok(validateAuth("register", { ...valid, password: "😀".repeat(19) }).password);
  assert.deepEqual(validateAuth("register", { ...valid, password: "  abcdef" }), {});
});

test("login does not impose new registration length restrictions", () => {
  assert.deepEqual(validateAuth("login", { ...valid, username: "", password: "a" }), {});
  assert.deepEqual(validateAuth("login", { ...valid, password: "a".repeat(72) }), {});
  assert.ok(validateAuth("login", { ...valid, password: "a".repeat(73) }).password);
  assert.ok(validateAuth("login", { ...valid, password: "" }).password);
  assert.ok(validateAuth("login", { ...valid, email: "bad" }).email);
});
