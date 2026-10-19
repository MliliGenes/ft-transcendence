import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export function validInternalSecret(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]{32,256}$/.test(value) &&
    !value.startsWith('REPLACE_')
  );
}

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    request.res?.setHeader('Cache-Control', 'no-store');
    const secret = this.config.get<string>('INTERNAL_API_SECRET');
    if (!validInternalSecret(secret)) {
      throw new ServiceUnavailableException('Internal API is not configured');
    }

    const supplied = request.headers['x-internal-key'];
    if (!validInternalSecret(supplied)) {
      throw new UnauthorizedException('Internal authentication is required');
    }

    const hash = (value: string) => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(hash(supplied), hash(secret))) {
      throw new UnauthorizedException('Internal authentication is required');
    }
    return true;
  }
}
