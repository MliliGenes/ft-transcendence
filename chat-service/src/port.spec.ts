import { getPort } from './port.js';

describe('chat server port', () => {
  it('defaults to 3001 when PORT is not set', () => {
    expect(getPort(undefined)).toBe(3001);
  });

  it.each(['1', '4000', '65535'])('accepts the port %s', (value) => {
    expect(getPort(value)).toBe(Number(value));
  });

  it.each([
    '',
    ' ',
    '0',
    '-1',
    '65536',
    '3001.5',
    '3001abc',
    '1e3',
    'Infinity',
  ])('rejects the invalid port %j', (value) => {
    expect(() => getPort(value)).toThrow(
      'PORT must be a whole number from 1 to 65535.',
    );
  });
});
