import { HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JudgeInfraError } from 'arena-game-engine';
import { EngineErrorFilter } from './errors.js';

describe('EngineErrorFilter', () => {
  it('maps judge infrastructure failures to 503 without exposing details', () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new EngineErrorFilter().catch(
      new JudgeInfraError('internal docker diagnostic'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(response.json).toHaveBeenCalledWith({ error: 'judge unavailable' });
  });
});
