import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/guards/access-token.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SuperadminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authentication is required');
    }

    // Read the current role so demotion takes effect without waiting for JWT expiry.
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { role: true },
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Superadmin access is required');
    }
    return true;
  }
}
