import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from './guards/access-token.guard.js';

@Controller('auth')
export class PrincipalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Get('principal')
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  async getPrincipal(@Req() request: AuthenticatedRequest) {
    const token = /^Bearer +(\S+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1];
    const exp = token
      ? this.jwt.decode<{ exp?: unknown }>(token)?.exp
      : undefined;
    if (typeof exp !== 'number' || !Number.isSafeInteger(exp)) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    return { userId: user.id, expiresAt: exp * 1000 };
  }
}
