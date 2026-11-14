import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function loadMatchView(authContextValue) {
  const source = readFileSync(new URL("../components/arena/MatchView.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, {
    exports: loaded.exports,
    module: loaded,
    require(name) {
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "next/link") return { default: (props) => React.createElement("a", props) };
      if (name === "@/components/auth/auth-provider") return { useAuth: () => authContextValue };
      if (name === "@/lib/arena/socket") return { SocketArenaTransport: class {} };
      if (name === "@/components/arena/ArenaWorkspace") return { ArenaWorkspace: () => React.createElement("div", { "data-testid": "workspace" }) };
      if (name === "@/components/ui/button") return {
        Button: ({ render, ...props }) => {
          if (render && React.isValidElement(render)) {
            return React.cloneElement(render, props);
          }
          return React.createElement("button", props);
        },
      };
      if (name === "@/lib/auth/client") return {};
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return loaded.exports.MatchView;
}

test("MatchView displays loading indicator while session restoration is pending", () => {
  const MatchView = loadMatchView({ session: null, isRestoring: true, requestWithSession: async () => {} });
  const html = renderToStaticMarkup(React.createElement(MatchView, { matchId: "match-1" }));
  assert.match(html, /Loading match arena…/);
  assert.doesNotMatch(html, /Sign in required/);
});

test("MatchView renders explicit sign-in UI and stops loading when restoration completes without a session", () => {
  const MatchView = loadMatchView({ session: null, isRestoring: false, requestWithSession: async () => {} });
  const html = renderToStaticMarkup(React.createElement(MatchView, { matchId: "match-1" }));
  assert.doesNotMatch(html, /Loading match arena…/);
  assert.match(html, /Sign in required/);
  assert.match(html, /Log in to enter this match arena\./);
  assert.match(html, /\/login/);
});

test("MatchView renders authenticated match workspace when a session is present", () => {
  const MatchView = loadMatchView({
    session: { user: { id: "p1" }, accessToken: "tok-1", tokenType: "Bearer", expiresIn: 3600 },
    isRestoring: false,
    requestWithSession: async () => {},
  });
  const html = renderToStaticMarkup(React.createElement(MatchView, { matchId: "match-1" }));
  assert.doesNotMatch(html, /Loading match arena…/);
  assert.doesNotMatch(html, /Sign in required/);
  assert.match(html, /data-testid="workspace"/);
});
