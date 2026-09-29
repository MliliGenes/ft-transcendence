import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { REFRESH_TOKEN_PATTERN, type RefreshDto } from './dto/refresh.dto.js';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './token.constants.js';

type AuthResult = {
  user: { id: string; email: string; username: string };
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email or username is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const userId = randomUUID();
    const { tokens, refreshTokenData } = await this.createTokenPair(userId);

    try {
      const user = await this.prisma.user.create({
        data: {
          id: userId,
          email: dto.email,
          username: dto.username,
          passwordHash,
          refreshTokens: {
            create: refreshTokenData,
          },
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });
      return { user, ...tokens };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or username is already in use');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, username: true, passwordHash: true },
    });

    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { tokens, refreshTokenData } = await this.createTokenPair(user.id);
    await this.prisma.refreshToken.create({
      data: { ...refreshTokenData, userId: user.id },
    });

    return {
      user: { id: user.id, email: user.email, username: user.username },
      ...tokens,
    };
  }

  async refresh(dto: RefreshDto): Promise<AuthResult> {
    const invalidToken = new UnauthorizedException(
      'Refresh token is invalid or expired',
    );
    const parts = REFRESH_TOKEN_PATTERN.exec(dto.refreshToken);
    if (!parts) throw invalidToken;
    const [, refreshId, secret] = parts;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: refreshId },
      select: {
        tokenHash: true,
        userId: true,
        sessionId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true, username: true } },
      },
    });
    if (!stored) throw invalidToken;

    const submittedHash = createHash('sha256').update(secret).digest();
    const storedHash = Buffer.from(stored.tokenHash, 'hex');
    if (
      storedHash.length !== submittedHash.length ||
      !timingSafeEqual(storedHash, submittedHash) ||
      stored.expiresAt.getTime() <= Date.now()
    ) {
      throw invalidToken;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Refresh and logout acquire the same database lock, even across servers.
      await this.lockUserSessions(tx, stored.userId);
      const current = await tx.refreshToken.findUnique({
        where: { id: refreshId },
        select: { revokedAt: true, expiresAt: true },
      });
      if (!current || current.expiresAt.getTime() <= Date.now()) return null;

      if (current.revokedAt) {
        await this.revokeSession(tx, stored.userId, stored.sessionId);
        // Return instead of throwing so the revocation commits.
        return null;
      }

      const { tokens, refreshTokenData } = await this.createTokenPair(
        stored.userId,
        stored.sessionId,
      );
      const now = new Date();
      const consumed = await tx.refreshToken.updateMany({
        where: {
          id: refreshId,
          tokenHash: stored.tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      // A conditional update allows only one request to consume this token.
      if (consumed.count !== 1) return null;

      await tx.refreshToken.create({
        data: { ...refreshTokenData, userId: stored.userId },
      });
      return { user: stored.user, ...tokens };
    });

    if (!result) throw invalidToken;

    return result;
  }

  async logout(dto: RefreshDto): Promise<void> {
    const parts = REFRESH_TOKEN_PATTERN.exec(dto.refreshToken);
    if (!parts) return;
    const [, refreshId, secret] = parts;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: refreshId },
      select: { tokenHash: true, userId: true, sessionId: true },
    });
    if (!stored) return;

    const submittedHash = createHash('sha256').update(secret).digest();
    const storedHash = Buffer.from(stored.tokenHash, 'hex');
    if (
      storedHash.length !== submittedHash.length ||
      !timingSafeEqual(storedHash, submittedHash)
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lockUserSessions(tx, stored.userId);
      // Also revokes replacements if refresh finished before logout got the lock.
      await this.revokeSession(tx, stored.userId, stored.sessionId);
    });
  }

  private async lockUserSessions(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`
      SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
    `;
  }

  private async revokeSession(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
  ) {
    await tx.refreshToken.updateMany({
      where: { userId, sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createTokenPair(
    userId: string,
    sessionId: string = randomUUID(),
  ) {
    const accessToken = await this.jwt.signAsync({ sub: userId });

    // The ID locates the refresh record; the random secret proves possession.
    const refreshId = randomUUID();
    const refreshSecret = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(refreshSecret).digest('hex');

    return {
      tokens: {
        accessToken,
        refreshToken: `${refreshId}.${refreshSecret}`,
        tokenType: 'Bearer' as const,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
      refreshTokenData: {
        id: refreshId,
        sessionId,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    };
  }
}
