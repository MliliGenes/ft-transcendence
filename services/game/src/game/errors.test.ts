import { describe, expect, it } from 'vitest';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { JudgeInfraError } from 'arena-game-engine';
import { EngineErrorFilter } from './errors.js';

function createMockHost(): { host: ArgumentsHost; response: { statusCode?: number; body?: unknown } } {
  const responseData: { statusCode?: number; body?: unknown } = {};
  const mockResponse = {
    status(code: number) {
      responseData.statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseData.body = body;
      return this;
    },
  };
  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getResponse: <T = any>(): T => mockResponse as unknown as T,
      getRequest: <T = any>(): T => ({} as unknown as T),
      getNext: <T = any>(): T => ({} as unknown as T),
    }),
    getArgs: <T extends Array<any> = any[]>(): T => [] as unknown as T,
    getArgByIndex: <T = any>(_index: number): T => undefined as unknown as T,
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
    getType: <TContext extends string = any>(): TContext => 'http' as TContext,
  };
  return { host, response: responseData };
}

describe('EngineErrorFilter', () => {
  it('maps JudgeInfraError to HTTP 503 with safe generic message', () => {
    const filter = new EngineErrorFilter();
    const { host, response } = createMockHost();
    const error = new JudgeInfraError('NanoCPUs unsupported: internal host details that should not leak');

    filter.catch(error, host);

    expect(response.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.body).toEqual({ error: 'judge unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('NanoCPUs');
    expect(JSON.stringify(response.body)).not.toContain('internal host details');
  });

  it('maps cross-realm JudgeInfraError (by name) to HTTP 503 without leaking details', () => {
    const filter = new EngineErrorFilter();
    const { host, response } = createMockHost();
    // Simulates an error thrown across a bundle or duplicate package boundary
    const crossRealmError = Object.assign(new Error('cross-realm judge timeout'), {
      name: 'JudgeInfraError',
    });

    filter.catch(crossRealmError, host);

    expect(response.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.body).toEqual({ error: 'judge unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('cross-realm');
  });

  it('maps code 503 to HTTP 503 with safe generic message', () => {
    const filter = new EngineErrorFilter();
    const { host, response } = createMockHost();
    const error = Object.assign(new Error('upstream judge worker died'), { code: 503 });

    filter.catch(error, host);

    expect(response.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.body).toEqual({ error: 'judge unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('upstream judge worker died');
  });

  it('maps standard codes: 400, 403, 404, 409, 410, 429, and 500', () => {
    const filter = new EngineErrorFilter();

    for (const [code, expectedStatus, expectedMessage] of [
      [400, HttpStatus.BAD_REQUEST, 'bad request'],
      [403, HttpStatus.FORBIDDEN, 'forbidden'],
      [404, HttpStatus.NOT_FOUND, 'not found'],
      [409, HttpStatus.CONFLICT, 'conflict'],
      [410, HttpStatus.GONE, 'gone'],
      [429, HttpStatus.TOO_MANY_REQUESTS, 'too many'],
    ] as const) {
      const { host, response } = createMockHost();
      const error = Object.assign(new Error(expectedMessage), { code });
      filter.catch(error, host);
      expect(response.statusCode).toBe(expectedStatus);
      expect(response.body).toEqual({ error: expectedMessage });
    }

    const { host, response } = createMockHost();
    filter.catch(new Error('private db connection failed'), host);
    expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.body).toEqual({ error: 'internal error' });
  });
});
