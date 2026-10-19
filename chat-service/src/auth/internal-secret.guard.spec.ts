import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { InternalSecretGuard } from './internal-secret.guard.js';

const key = 'fixture-internal-key-'.repeat(3);
const context = (value: unknown) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-internal-key': value } }),
    }),
  }) as ExecutionContext;

describe('Chat internal-secret guard', () => {
  const guard = new InternalSecretGuard(
    new ConfigService({ INTERNAL_API_SECRET: key }),
  );
  it('accepts the configured server key', () => {
    expect(guard.canActivate(context(key))).toBe(true);
  });
  it.each([undefined, '', 'a'.repeat(64), [key, key], 'x'.repeat(257)])(
    'rejects unauthorized caller %#',
    (value) => {
      expect(() => guard.canActivate(context(value))).toThrow(
        'Internal authentication is required',
      );
    },
  );
  it('fails closed without configuration', () => {
    const missing = new InternalSecretGuard(
      new ConfigService({ INTERNAL_API_SECRET: '' }),
    );
    expect(() => missing.canActivate(context(key))).toThrow(
      'Internal API is not configured',
    );
  });
  it('never accepts the committed example placeholder as a configured secret', () => {
    const placeholder = new InternalSecretGuard(
      new ConfigService({
        INTERNAL_API_SECRET: 'REPLACE_WITH_SHARED_RANDOM_SECRET',
      }),
    );
    expect(() => placeholder.canActivate(context(key))).toThrow(
      'Internal API is not configured',
    );
  });
});
