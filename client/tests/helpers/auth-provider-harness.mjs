import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/**
 * Mounts the real AuthProvider against a controllable auth service.
 *
 * The React mock keeps one cell per hook index, so refs (the single-flight
 * refresh promise, the session mirror, the expiry mirror) and state (session,
 * isRestoring) survive a re-render exactly like the real hooks do.
 *
 * `authApi` is the real module: the only seam is the global `fetch`, so the
 * genuine error typing is exercised - a thrown fetch becomes
 * `AuthRequestError(status 0)` ("Unable to reach Nook...") and an HTTP error
 * becomes `AuthRequestError(<http status>)`.
 */

const DEFAULT_SESSION = {
  user: { id: "viewer" },
  accessToken: "refreshed-token",
  tokenType: "Bearer",
  expiresIn: 900,
};

async function flush(times = 4) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export async function mountAuthProvider(pathname, options = {}) {
  const { onRefresh = async () => ({ status: 200, body: DEFAULT_SESSION }) } = options;
  const effects = [];
  const cleanups = [];
  const cells = [];
  let cursor = 0;
  let effectsRun = false;
  let refreshCalls = 0;
  let clearedQueries = 0;

  const react = {
    createContext: () => ({ Provider: "provider" }),
    useRef(initial) {
      const index = cursor++;
      if (!cells[index]) cells[index] = { current: initial };
      return cells[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!cells[index]) cells[index] = { value: typeof initial === "function" ? initial() : initial };
      const cell = cells[index];
      return [cell.value, (next) => { cell.value = typeof next === "function" ? next(cell.value) : next; }];
    },
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
    useEffect: (effect) => { if (!effectsRun) effects.push(effect); },
  };

  const fetchImpl = async (url) => {
    if (!String(url).includes("/api/auth/refresh")) {
      throw new Error(`unexpected fetch: ${String(url)}`);
    }
    refreshCalls += 1;
    const result = (await onRefresh(refreshCalls)) ?? {};
    if (result.networkError) throw new TypeError("fetch failed");
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result.body ?? {},
    };
  };

  const authClientSource = readFileSync(new URL("../../lib/auth/client.ts", import.meta.url), "utf8");
  const authClientCompiled = ts.transpileModule(authClientSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const authClientLoaded = { exports: {} };
  runInNewContext(authClientCompiled, {
    exports: authClientLoaded.exports,
    module: authClientLoaded,
    Error,
    fetch: fetchImpl,
  });

  const source = readFileSync(new URL("../../components/auth/auth-provider.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, {
    exports: loaded.exports,
    module: loaded,
    window: { location: { pathname } },
    Error,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") {
        const element = (type, props) => ({ type, props });
        return { jsx: element, jsxs: element, Fragment: "fragment" };
      }
      if (name === "@tanstack/react-query") {
        return { useQueryClient: () => ({ clear() { clearedQueries += 1; } }) };
      }
      if (name === "@/lib/auth/client") return authClientLoaded.exports;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  let value = null;
  function render() {
    cursor = 0;
    const element = loaded.exports.AuthProvider({ children: null });
    value = element?.props?.value ?? null;
  }

  render();
  for (const effect of effects) {
    const cleanup = effect();
    if (typeof cleanup === "function") cleanups.push(cleanup);
  }
  effectsRun = true;
  await flush();

  return {
    /** Number of POST /api/auth/refresh requests the provider issued. */
    calls: () => refreshCalls,
    clearedQueries: () => clearedQueries,
    get value() { return value; },
    get session() { render(); return value?.session ?? null; },
    get isRestoring() { render(); return value?.isRestoring ?? null; },
    rerender: render,
    cleanups,
    AuthRequestError: authClientLoaded.exports.AuthRequestError,
    UnauthenticatedSessionError: authClientLoaded.exports.UnauthenticatedSessionError,
  };
}

export { DEFAULT_SESSION };
