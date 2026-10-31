import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigate } from '../src/lib/navigation.js';

test('navigate allows /privacy and /terms routes without rewriting to /account', (t) => {
  const originalWindow = globalThis.window;
  const originalPopState = globalThis.PopStateEvent;
  let pushedPath = null;

  globalThis.window = {
    history: {
      pushState: (_data, _unused, path) => {
        pushedPath = path;
      },
      replaceState: () => {},
    },
    dispatchEvent: () => true,
    scrollTo: () => {},
  };
  globalThis.PopStateEvent = class PopStateEvent {};

  t.after(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete globalThis.window;
    }
    if (originalPopState !== undefined) {
      globalThis.PopStateEvent = originalPopState;
    } else {
      delete globalThis.PopStateEvent;
    }
  });

  navigate('/privacy');
  assert.equal(pushedPath, '/privacy');

  navigate('/terms');
  assert.equal(pushedPath, '/terms');

  navigate('/unknown-path');
  assert.equal(pushedPath, '/account');
});
