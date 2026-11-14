import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Socket } from 'socket.io';
import { GameService } from './game.service.js';
import { socketPrincipal } from './socket-auth.js';

type PrincipalRequest = Request & { principal?: { userId: string } };

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  constructor(private readonly game: GameService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let userId: string | undefined;
    if (context.getType() === 'http') {
      userId = context.switchToHttp().getRequest<PrincipalRequest>()
        .principal?.userId;
    } else if (context.getType() === 'ws') {
      userId = socketPrincipal(
        context.switchToWs().getClient<Socket>(),
      )?.userId;
    }
    if (!userId) return true;

    try {
      await this.game.assertAccountActive(userId);
      return true;
    } catch {
      throw new UnauthorizedException('account is unavailable');
    }
  }
}
