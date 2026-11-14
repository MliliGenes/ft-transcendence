import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ActiveAccountGuard } from './active-account.guard.js';
import { GameService } from './game.service.js';

describe('active account guard', () => {
  it('rejects old HTTP principals after a deletion event', async () => {
    const game = new GameService();
    game.blockDeletedAccount('deleted-user');
    const guard = new ActiveAccountGuard(game);
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ principal: { userId: 'deleted-user' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects messages on an already-open socket for a deleted user', async () => {
    const game = new GameService();
    game.blockDeletedAccount('deleted-user');
    const guard = new ActiveAccountGuard(game);
    const context = {
      getType: () => 'ws',
      switchToWs: () => ({
        getClient: () => ({ data: { principal: { userId: 'deleted-user' } } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
