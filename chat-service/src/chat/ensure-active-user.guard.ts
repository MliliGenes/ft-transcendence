import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserProfilesService } from './user-profiles.service.js';

type AuthenticatedRequest = Request & { user: { sub: string } };

@Injectable()
export class EnsureActiveUserGuard implements CanActivate {
  constructor(private readonly userProfiles: UserProfilesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.userProfiles.ensureActiveUsers([request.user.sub]);
    return true;
  }
}
