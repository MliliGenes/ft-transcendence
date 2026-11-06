import assert from 'node:assert/strict';
import test from 'node:test';

import { navigate } from '../src/lib/navigation.js';

test('navigate accepts the chat tester route', () => {
  let destination;
  globalThis.window = {
    history: {
      pushState: (_state, _title, path) => {
        destination = path;
      },
    },
    dispatchEvent: () => {},
    scrollTo: () => {},
  };
  globalThis.PopStateEvent = class PopStateEvent {};

  navigate('/chat-test');

  assert.equal(destination, '/chat-test');
});
