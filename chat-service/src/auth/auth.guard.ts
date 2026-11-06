import { isUUID } from 'class-validator';
import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators.js';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isWs: boolean = context.getType() == 'ws';

    const unauthorized = (message: string) =>
      isWs ? new WsException(message) : new UnauthorizedException(message);

    const target = isWs
      ? context.switchToWs().getClient()
      : context
          .switchToHttp()
          .getRequest<Request & { user?: { sub: string } }>();

    const token = isWs
      ? this.fromSocket(target)
      : this.fromHeader(target.headers['authorization']);

    if (!token) {
      throw unauthorized('A Bearer access token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(token);

      if (
        typeof payload.sub !== 'string' ||
        !isUUID(payload.sub) ||
        typeof payload.exp !== 'number'
      ) {
        throw unauthorized('Invalid access-token claims');
      }

      const user = { sub: payload.sub };

      if (isWs) {
        target.data.user = user;
      } else {
        target.user = user;
      }
      return true;
    } catch {
      throw unauthorized('Access token is invalid or expired');
    }
  }

  private fromHeader(header?: string): string | undefined {
    const [type, token] = header?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private fromSocket(client: any): string | undefined {
    return (
      client.handshake?.auth?.token ??
      this.fromHeader(client.handshake?.headers?.authorization)
    );
  }
}
