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
import type { DiscordProfile } from './strategies/discord.strategy.js';
import type { GithubProfile } from './strategies/github.strategy.js';
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

  async loginWithDiscord(profile: DiscordProfile): Promise<AuthResult> {
    const linked = await this.findDiscordUser(profile.id);
    if (linked) {
      if (profile.avatarUrl) {
        await this.prisma.user.updateMany({
          where: {
            id: linked.id,
            OR: [{ avatarUrl: null }, { avatarUrl: '' }],
          },
          data: { avatarUrl: profile.avatarUrl },
        });
      }
      return this.createDiscordSession(linked);
    }

    if (!profile.email || !profile.verified) {
      throw new UnauthorizedException(
        'A verified Discord email is required to create an account',
      );
    }
    // Email equality is never proof that two local/provider accounts can be merged.
    const existing = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: profile.email.replace(/[\\%_]/g, '\\$&'),
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException(
        'Email is already in use. Sign in with your existing method to connect Discord; accounts are not linked automatically.',
      );

    const userId = randomUUID();
    const { tokens, refreshTokenData } = await this.createTokenPair(userId);
    const base =
      profile.username.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 20) || 'discord';
    const username = `${base}_${randomBytes(4).toString('hex')}`;
    try {
      // Account, provider identity, and session are created atomically.
      const user = await this.prisma.user.create({
        data: {
          id: userId,
          username,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          emailVerifiedAt: new Date(),
          role: 'USER',
          authProviders: {
            create: { provider: 'DISCORD', providerUserId: profile.id },
          },
          refreshTokens: { create: refreshTokenData },
        },
        select: { id: true, email: true, username: true },
      });
      return { user, ...tokens };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Two successful Discord authorizations may race to create the same identity.
        const winner = await this.findDiscordUser(profile.id);
        if (winner) return this.createDiscordSession(winner);
        throw new ConflictException(
          'Email or username is already in use. Sign in with your existing method, or restart Discord login.',
        );
      }
      throw error;
    }
  }

  async linkDiscord(userId: string, profile: DiscordProfile) {
    const result = { provider: 'DISCORD' as const, providerUserId: profile.id };
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockUserSessions(tx, userId);
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user) throw new UnauthorizedException('Account no longer exists');

        const identity = await tx.authProvider.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'DISCORD',
              providerUserId: profile.id,
            },
          },
          select: { userId: true },
        });
        if (identity) {
          if (identity.userId !== userId)
            throw new ConflictException(
              'This Discord account is already linked to another user',
            );
          return result;
        }

        const current = await tx.authProvider.findUnique({
          where: { userId_provider: { userId, provider: 'DISCORD' } },
          select: { id: true },
        });
        if (current)
          throw new ConflictException(
            'Your account already has a different Discord account linked',
          );

        // Linking adds a login method. It does not merge profiles or issue tokens.
        await tx.authProvider.create({
          data: { userId, provider: 'DISCORD', providerUserId: profile.id },
        });
        return result;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // The provider identity constraint also protects different-user races.
        const identity = await this.prisma.authProvider.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'DISCORD',
              providerUserId: profile.id,
            },
          },
          select: { userId: true },
        });
        if (identity?.userId === userId) return result;
        throw new ConflictException('This Discord account is already linked');
      }
      throw error;
    }
  }

  async loginWithGithub(profile: GithubProfile): Promise<AuthResult> {
    const linked = await this.findProviderUser('GITHUB', profile.id);
    if (linked) {
      if (profile.avatarUrl) {
        await this.prisma.user.updateMany({
          where: {
            id: linked.id,
            OR: [{ avatarUrl: null }, { avatarUrl: '' }],
          },
          data: { avatarUrl: profile.avatarUrl },
        });
      }
      return this.createProviderSession(linked);
    }
    if (!profile.email || !profile.verified)
      throw new UnauthorizedException(
        'A verified GitHub email is required to create an account',
      );
    const existing = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: profile.email.replace(/[\\%_]/g, '\\$&'),
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException(
        'Email is already in use. Sign in with your existing method to connect GitHub; accounts are not linked automatically.',
      );
    const userId = randomUUID();
    const { tokens, refreshTokenData } = await this.createTokenPair(userId);
    const base =
      profile.username.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 20) || 'github';
    const username = `${base}_${randomBytes(4).toString('hex')}`;
    try {
      const user = await this.prisma.user.create({
        data: {
          id: userId,
          username,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          emailVerifiedAt: new Date(),
          role: 'USER',
          authProviders: {
            create: { provider: 'GITHUB', providerUserId: profile.id },
          },
          refreshTokens: { create: refreshTokenData },
        },
        select: { id: true, email: true, username: true },
      });
      return { user, ...tokens };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.findProviderUser('GITHUB', profile.id);
        if (winner) return this.createProviderSession(winner);
        throw new ConflictException(
          'Email or username is already in use. Sign in with your existing method, or restart GitHub login.',
        );
      }
      throw error;
    }
  }

  async linkGithub(userId: string, profile: GithubProfile) {
    const result = { provider: 'GITHUB' as const, providerUserId: profile.id };
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockUserSessions(tx, userId);
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user) throw new UnauthorizedException('Account no longer exists');
        const identity = await tx.authProvider.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'GITHUB',
              providerUserId: profile.id,
            },
          },
          select: { userId: true },
        });
        if (identity) {
          if (identity.userId !== userId)
            throw new ConflictException(
              'This GitHub account is already linked to another user',
            );
          return result;
        }
        const current = await tx.authProvider.findUnique({
          where: { userId_provider: { userId, provider: 'GITHUB' } },
          select: { id: true },
        });
        if (current)
          throw new ConflictException(
            'Your account already has a different GitHub account linked',
          );
        await tx.authProvider.create({
          data: { userId, provider: 'GITHUB', providerUserId: profile.id },
        });
        return result;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const identity = await this.prisma.authProvider.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'GITHUB',
              providerUserId: profile.id,
            },
          },
          select: { userId: true },
        });
        if (identity?.userId === userId) return result;
        throw new ConflictException('This GitHub account is already linked');
      }
      throw error;
    }
  }

  async unlinkDiscord(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUserSessions(tx, userId);
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          passwordHash: true,
          authProviders: { select: { id: true, provider: true } },
        },
      });
      if (!user) throw new UnauthorizedException('Account no longer exists');

      const provider = user.authProviders.find(
        (identity) => identity.provider === 'DISCORD',
      );
      if (!provider)
        throw new ConflictException(
          'No Discord account is linked to this user',
        );
      if (!user.passwordHash && user.authProviders.length === 1)
        throw new ConflictException(
          'Set a password or connect another sign-in method before unlinking Discord.',
        );

      const deleted = await tx.authProvider.deleteMany({
        where: { id: provider.id, userId, provider: 'DISCORD' },
      });
      if (deleted.count !== 1)
        throw new ConflictException(
          'The Discord account could not be unlinked. Please try again.',
        );
    });
  }

  async unlinkGithub(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUserSessions(tx, userId);
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          passwordHash: true,
          authProviders: { select: { id: true, provider: true } },
        },
      });
      if (!user) throw new UnauthorizedException('Account no longer exists');

      const provider = user.authProviders.find(
        (identity) => identity.provider === 'GITHUB',
      );
      if (!provider)
        throw new ConflictException('No GitHub account is linked to this user');
      if (!user.passwordHash && user.authProviders.length === 1)
        throw new ConflictException(
          'Set a password or connect another sign-in method before unlinking GitHub.',
        );

      const deleted = await tx.authProvider.deleteMany({
        where: { id: provider.id, userId, provider: 'GITHUB' },
      });
      if (deleted.count !== 1)
        throw new ConflictException(
          'The GitHub account could not be unlinked. Please try again.',
        );
    });
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

  private async findDiscordUser(providerUserId: string) {
    const provider = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerUserId: { provider: 'DISCORD', providerUserId },
      },
      select: { user: { select: { id: true, email: true, username: true } } },
    });
    return provider?.user;
  }

  private async findProviderUser(
    provider: 'GITHUB' | 'DISCORD',
    providerUserId: string,
  ) {
    const identity = await this.prisma.authProvider.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      select: { user: { select: { id: true, email: true, username: true } } },
    });
    return identity?.user;
  }

  private async createProviderSession(
    user: AuthResult['user'],
  ): Promise<AuthResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUserSessions(tx, user.id);
      const current = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, username: true },
      });
      if (!current) throw new UnauthorizedException('Account no longer exists');
      const { tokens, refreshTokenData } = await this.createTokenPair(
        current.id,
      );
      await tx.refreshToken.create({
        data: { ...refreshTokenData, userId: current.id },
      });
      return { user: current, ...tokens };
    });
  }

  private async createDiscordSession(
    user: AuthResult['user'],
  ): Promise<AuthResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUserSessions(tx, user.id);
      const current = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, username: true },
      });
      if (!current) throw new UnauthorizedException('Account no longer exists');
      const { tokens, refreshTokenData } = await this.createTokenPair(
        current.id,
      );
      await tx.refreshToken.create({
        data: { ...refreshTokenData, userId: current.id },
      });
      return { user: current, ...tokens };
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
