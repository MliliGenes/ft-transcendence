import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

async function initialRestore(pathname) {
  const effects = [];
  let calls = 0;
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useRef: (current) => ({ current }),
    useState: (initial) => [initial, () => {}],
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
    useEffect: (effect) => effects.push(effect),
  };
  const source = readFileSync(new URL("../components/auth/auth-provider.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, {
    exports: loaded.exports,
    module: loaded,
    window: { location: { pathname } },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: () => null };
      if (name === "@tanstack/react-query") return { useQueryClient: () => ({ clear() {} }) };
      if (name === "@/lib/auth/client") return { authApi: { refresh: async () => { calls++; return { user: { id: "viewer" } }; } } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  loaded.exports.AuthProvider({ children: null });
  for (const effect of effects) effect();
  await Promise.resolve();
  return calls;
}

for (const pathname of ["/privacy", "/terms", "/feed"]) {
  test(`returning users restore their cookie session when first opening ${pathname}`, async () => {
    assert.equal(await initialRestore(pathname), 1);
  });
}
test("login leaves session restoration to the explicit sign-in flow", async () => {
  assert.equal(await initialRestore("/login"), 0);
});
