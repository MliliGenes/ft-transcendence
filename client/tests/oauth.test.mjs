import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { URLSearchParams } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/auth/oauth.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledModule = { exports: {} };
runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, URLSearchParams });
const { oauthNoticeMessage, parseOAuthReturn } = compiledModule.exports;
const localValue = (value) => value === null ? null : JSON.parse(JSON.stringify(value));

test("successful provider linking returns to settings without exposing credentials", () => {
  const result = parseOAuthReturn("#providerLinked=github", null);

  assert.deepEqual(localValue(result), {
    route: "/settings",
    notice: { flow: "link", provider: "github", result: "linked" },
  });
});

test("login errors return to login and identify the provider from safe state", () => {
  const result = parseOAuthReturn("#oauthError=authorization&oauthFlow=login", "discord");

  assert.deepEqual(localValue(result), {
    route: "/login",
    notice: { flow: "login", provider: "discord", result: "error", error: "authorization" },
  });
  assert.match(oauthNoticeMessage(result.notice), /Discord authorization was cancelled or expired/);
});

test("link errors return to settings and use provider supplied by backend", () => {
  const result = parseOAuthReturn("#oauthError=conflict&oauthFlow=link&oauthProvider=github", null);

  assert.equal(result.route, "/settings");
  assert.equal(result.notice.provider, "github");
  assert.match(oauthNoticeMessage(result.notice), /already connected to another Nook account/);
});

test("unknown callback values are ignored", () => {
  assert.equal(parseOAuthReturn("#oauthError=https%3A%2F%2Fevil.test&oauthFlow=login", "github"), null);
  assert.equal(parseOAuthReturn("#access_token=secret", null), null);
  assert.equal(parseOAuthReturn("#providerLinked=https%3A%2F%2Fevil.test", null), null);
});
