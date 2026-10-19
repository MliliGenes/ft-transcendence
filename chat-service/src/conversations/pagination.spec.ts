import { nextCursor, readPage } from './pagination.js';

it('rejects cursor dates outside the supported database/API year range', () => {
  const scope = 'messages:00000000-0000-4000-8000-000000000001';
  const id = '00000000-0000-4000-8000-000000000002';
  for (const time of [
    '-010000-01-01T00:00:00.000Z',
    '0000-01-01T00:00:00.000Z',
  ]) {
    const cursor = Buffer.from(JSON.stringify({ scope, id, time })).toString(
      'base64url',
    );
    expect(() => readPage({ cursor }, scope)).toThrow('Invalid cursor');
  }
  const date = new Date('2026-10-19T10:00:00.000Z');
  expect(
    readPage({ cursor: nextCursor(scope, id, date), limit: '100' }, scope),
  ).toEqual({ limit: 100, after: { id, time: date } });
});
