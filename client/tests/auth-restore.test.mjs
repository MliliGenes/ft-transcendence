import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

async function mountAuthProvider(
  pathname,
  refresh = async () => ({ user: { id: 'viewer' } }),
) {
  const effects = [];
  let calls = 0;
  let value;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useRef: (current) => ({ current }),
    useState: (initial) => [initial, () => {}],
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
    useEffect: (effect) => effects.push(effect),
  };
  const source = readFileSync(
    new URL('../components/auth/auth-provider.tsx', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, {
    exports: loaded.exports,
    module: loaded,
    window: { location: { pathname } },
    Error,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime')
        return {
          jsx: (_type, props) => {
            value = props.value;
            return null;
          },
        };
      if (name === '@tanstack/react-query')
        return { useQueryClient: () => ({ clear() {} }) };
      if (name === '@/lib/auth/client')
        return {
          authApi: {
            refresh: async () => {
              calls++;
              return refresh();
            },
          },
        };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  loaded.exports.AuthProvider({ children: null });
  for (const effect of effects) effect();
  await Promise.resolve();
  await Promise.resolve();
  return { calls: () => calls, value };
}

async function initialRestore(pathname) {
  const provider = await mountAuthProvider(pathname);
  return provider.calls();
}

for (const pathname of ['/privacy', '/terms', '/feed']) {
  test(`returning users restore their cookie session when first opening ${pathname}`, async () => {
    assert.equal(await initialRestore(pathname), 1);
  });
}
test('login leaves session restoration to the explicit sign-in flow', async () => {
  assert.equal(await initialRestore('/login'), 0);
});

test('a near-expiry session refreshes before an Arena snapshot request', async () => {
  const sessions = [
    {
      user: { id: 'viewer' },
      accessToken: 'fresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  ];
  const provider = await mountAuthProvider('/login', async () =>
    sessions.shift(),
  );
  provider.value.setSession({
    user: { id: 'viewer' },
    accessToken: 'near-expiry',
    tokenType: 'Bearer',
    expiresIn: 10,
  });
  const sentTokens = [];

  await provider.value.requestWithSession(async (token) => {
    sentTokens.push(token);
    if (token === 'near-expiry') {
      const error = new Error('expired access token');
      error.status = 401;
      throw error;
    }
    return { revision: 1 };
  });

  assert.deepEqual(
    sentTokens,
    ['fresh-token'],
    'Arena must not send a snapshot request with a near-expiry token',
  );
  assert.equal(
    provider.calls(),
    1,
    'the provider refreshes once before sending the request',
  );
});
