import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const context = { exports, module: { exports } };
  runInNewContext(compiled, context);
  return context.module.exports;
}

const { readReceiptForLastOwnMessage } = loadModule('../lib/chat/receipts.ts');
const { formatTypingNames } = loadModule('../lib/chat/typing.ts');

const messages = [
  {
    id: 'm1',
    authorId: 'alice',
    createdAt: '2026-11-10T04:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'm2',
    authorId: 'bob',
    createdAt: '2026-11-10T04:01:00.000Z',
    deletedAt: null,
  },
  {
    id: 'm3',
    authorId: 'alice',
    createdAt: '2026-11-10T04:02:00.000Z',
    deletedAt: null,
  },
];

test('read receipts appear on the newest own message once another participant reads it', () => {
  assert.equal(
    JSON.stringify(
      readReceiptForLastOwnMessage(messages, 'alice', [
        {
          userId: 'bob',
          lastReadMessageId: 'm3',
          lastReadAt: messages[2].createdAt,
        },
      ]),
    ),
    JSON.stringify({ messageId: 'm3', readerCount: 1 }),
  );
});

test('read receipts stay hidden until the other participant reaches the own message', () => {
  assert.equal(
    readReceiptForLastOwnMessage(messages, 'alice', [
      {
        userId: 'bob',
        lastReadMessageId: 'm1',
        lastReadAt: messages[0].createdAt,
      },
    ]),
    null,
  );
});

test('read receipts fall back to timestamps when the marker is outside the loaded page', () => {
  assert.equal(
    JSON.stringify(
      readReceiptForLastOwnMessage(messages, 'alice', [
        {
          userId: 'bob',
          lastReadMessageId: 'newer-message',
          lastReadAt: '2026-11-10T04:03:00.000Z',
        },
      ]),
    ),
    JSON.stringify({ messageId: 'm3', readerCount: 1 }),
  );
});

test('read receipts count multiple readers and skip deleted own messages', () => {
  assert.equal(
    JSON.stringify(
      readReceiptForLastOwnMessage(
        [
          ...messages,
          {
            id: 'm4',
            authorId: 'alice',
            createdAt: '2026-11-10T04:04:00.000Z',
            deletedAt: messages[2].createdAt,
          },
        ],
        'alice',
        [
          {
            userId: 'bob',
            lastReadMessageId: 'm3',
            lastReadAt: messages[2].createdAt,
          },
          {
            userId: 'carol',
            lastReadMessageId: 'm3',
            lastReadAt: messages[2].createdAt,
          },
        ],
      ),
    ),
    JSON.stringify({ messageId: 'm3', readerCount: 2 }),
  );
});

test('typing labels read naturally for one, two and many typists', () => {
  assert.equal(formatTypingNames([]), '');
  assert.equal(formatTypingNames(['Ada']), 'Ada is typing…');
  assert.equal(
    formatTypingNames(['Ada', 'Grace']),
    'Ada and Grace are typing…',
  );
  assert.equal(
    formatTypingNames(['Ada', 'Grace', 'Lin']),
    'Ada and 2 others are typing…',
  );
  assert.equal(formatTypingNames(['Ada', 'Ada']), 'Ada is typing…');
});
