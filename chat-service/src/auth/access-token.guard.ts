import {
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserProjectionService } from '../users/user-projection.service.js';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

const PUBLIC_ROUTE = 'chat:public';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export type AuthenticatedRequest = Request & { userId: string };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(UserProjectionService)
    private readonly users: UserProjectionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.res?.setHeader('Cache-Control', 'no-store');

    const authorization = request.headers.authorization ?? '';

    if (authorization.length > 4096) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    const token = /^Bearer +(\S+)$/i.exec(authorization)?.[1];

    if (!token) {
      throw new UnauthorizedException('A Bearer access token is required');
    }

    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(token);

      if (
        typeof payload.sub !== 'string' ||
        !isUUID(payload.sub) ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp)
      ) {
        throw new Error('Invalid token claims');
      }

      userId = payload.sub.toLowerCase();
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    try {
      // Account existence is checked live; profile TTL never grants access.
      await this.users.ensureUsers([userId], true);
    } catch (error) {
      if (error instanceof NotFoundException)
        throw new UnauthorizedException('Account is unavailable');
      throw error;
    }
    request.userId = userId;
    return true;
  }
}
