import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { isEmail } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { OAuthPurpose } from '../../generated/prisma/client.js';

export type GithubProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  verified: boolean;
};

const STATE_TTL_MS = 10 * 60 * 1000;
const COOKIE_NAME = 'github_oauth_browser';
const LINK_COOKIE_NAME = 'github_oauth_link_browser';
const RANDOM_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class GithubStrategy {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async authorize(response: Response): Promise<string> {
    return this.begin(response, 'LOGIN', null);
  }

  async authorizeLink(userId: string, response: Response): Promise<string> {
    return this.begin(response, 'LINK', userId);
  }

  private async begin(
    response: Response,
    purpose: OAuthPurpose,
    userId: string | null,
  ): Promise<string> {
    const settings = this.settings(purpose);
    const state = randomBytes(32).toString('base64url');
    const browser = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    const data = {
      tokenHash: hash(state),
      browserHash: hash(browser),
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
      purpose,
      userId,
    };
    if (userId) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user) throw new UnauthorizedException('Account no longer exists');
        await tx.oAuthState.create({ data });
      });
    } else await this.prisma.oAuthState.create({ data });
    response.cookie(this.cookieName(purpose), browser, {
      ...this.cookieOptions(settings.redirectUri),
      maxAge: STATE_TTL_MS,
    });
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      scope: 'user:email',
      state,
    }).toString();
    return url.toString();
  }

  async authenticate(
    request: Request,
    response: Response,
  ): Promise<GithubProfile> {
    return (await this.complete(request, response, 'LOGIN')).profile;
  }

  async authenticateLink(request: Request, response: Response) {
    const result = await this.complete(request, response, 'LINK');
    if (!result.userId)
      throw new UnauthorizedException('GitHub link state has no account');
    return { profile: result.profile, userId: result.userId };
  }

  private async complete(
    request: Request,
    response: Response,
    purpose: OAuthPurpose,
  ): Promise<{ profile: GithubProfile; userId: string | null }> {
    const settings = this.settings(purpose);
    const cookieName = this.cookieName(purpose);
    const cookies = (request.headers.cookie ?? '')
      .split(';')
      .map((value) => value.trim())
      .filter((value) => value.startsWith(`${cookieName}=`));
    const browser =
      cookies.length === 1 ? cookies[0].slice(cookieName.length + 1) : '';
    response.clearCookie(cookieName, this.cookieOptions(settings.redirectUri));
    const { state, code, error } = request.query;
    if (
      typeof state !== 'string' ||
      !RANDOM_TOKEN.test(state) ||
      !RANDOM_TOKEN.test(browser)
    )
      throw new UnauthorizedException(
        'GitHub authorization state is invalid or expired; start again',
      );
    const stored = await this.prisma.oAuthState.findUnique({
      where: { tokenHash: hash(state) },
      select: { purpose: true, userId: true },
    });
    if (
      !stored ||
      stored.purpose !== purpose ||
      (purpose === 'LINK' ? !stored.userId : stored.userId !== null)
    )
      throw new UnauthorizedException(
        'GitHub authorization state is invalid or expired; start again',
      );
    const consumed = await this.prisma.oAuthState.deleteMany({
      where: {
        tokenHash: hash(state),
        browserHash: hash(browser),
        expiresAt: { gt: new Date() },
        purpose,
        userId: stored.userId,
      },
    });
    if (consumed.count !== 1)
      throw new UnauthorizedException(
        'GitHub authorization state is invalid or expired; start again',
      );
    if (error !== undefined)
      throw new UnauthorizedException(
        'GitHub authorization was cancelled or denied',
      );
    if (typeof code !== 'string' || code.length === 0 || code.length > 2048)
      throw new UnauthorizedException(
        'GitHub authorization code is missing or invalid',
      );

    const token = await this.githubJson(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          code,
          redirect_uri: settings.redirectUri,
        }),
      },
    );
    if (
      !record(token) ||
      typeof token.access_token !== 'string' ||
      !token.access_token
    )
      throw new BadGatewayException(
        'GitHub returned an invalid token response',
      );
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.access_token}`,
      'User-Agent': 'ft-transcendence-user-service',
    };
    const profile = await this.githubJson('https://api.github.com/user', {
      headers,
    });
    const emails = await this.githubJson('https://api.github.com/user/emails', {
      headers,
    });
    if (
      !record(profile) ||
      typeof profile.id !== 'number' ||
      !Number.isSafeInteger(profile.id) ||
      typeof profile.login !== 'string' ||
      !profile.login
    )
      throw new BadGatewayException('GitHub returned an invalid user profile');
    const email = Array.isArray(emails)
      ? (emails.find(
          (item) =>
            record(item) &&
            item.primary === true &&
            item.verified === true &&
            typeof item.email === 'string' &&
            isEmail(item.email),
        )?.email ?? null)
      : null;
    return {
      userId: stored.userId,
      profile: {
        id: String(profile.id),
        username: profile.login.slice(0, 100),
        displayName:
          typeof profile.name === 'string' && profile.name
            ? profile.name.slice(0, 50)
            : profile.login.slice(0, 50),
        email,
        verified: email !== null,
        avatarUrl:
          typeof profile.avatar_url === 'string' &&
          profile.avatar_url.startsWith('https://')
            ? profile.avatar_url
            : null,
      },
    };
  }

  private settings(purpose: OAuthPurpose) {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GITHUB_CLIENT_SECRET')
      ?.trim();
    let redirectUri = this.config.get<string>('GITHUB_REDIRECT_URI')?.trim();
    if (!clientId || !clientSecret || !redirectUri)
      throw new ServiceUnavailableException('GitHub login is not configured');
    try {
      if (purpose === 'LINK')
        redirectUri =
          this.config.get<string>('GITHUB_LINK_REDIRECT_URI')?.trim() ||
          new URL('/auth/github/link/callback', redirectUri).toString();
      const url = new URL(redirectUri);
      const localHttp =
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (
        (url.protocol !== 'https:' && !localHttp) ||
        url.username ||
        url.password ||
        url.hash ||
        url.search ||
        (this.config.get<string>('NODE_ENV') === 'production' &&
          url.protocol !== 'https:')
      )
        throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'GitHub redirect URI must use HTTPS, or HTTP on localhost for development',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private cookieName(purpose: OAuthPurpose): string {
    return purpose === 'LINK' ? LINK_COOKIE_NAME : COOKIE_NAME;
  }

  private cookieOptions(redirectUri: string): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: redirectUri.startsWith('https:'),
      path: '/auth/github',
    };
  }

  private async githubJson(url: string, init: RequestInit): Promise<unknown> {
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
    } catch {
      throw new BadGatewayException(
        'Unable to contact GitHub; start login again',
      );
    }
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status))
        throw new UnauthorizedException(
          'GitHub authorization failed; start login again',
        );
      throw new BadGatewayException(
        'GitHub is temporarily unavailable; try again later',
      );
    }
    try {
      return await response.json();
    } catch {
      throw new BadGatewayException('GitHub returned an invalid response');
    }
  }
}
