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

export type DiscordProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  verified: boolean;
};

const STATE_TTL_MS = 10 * 60 * 1000;
const COOKIE_NAME = 'discord_oauth_browser';
const RANDOM_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A Nest provider strategy, using Discord's authorization-code flow directly.
// Our existing JWT guards remain unchanged; Passport sessions are not needed.
@Injectable()
export class DiscordStrategy {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async authorize(response: Response): Promise<string> {
    const settings = this.settings();
    const state = randomBytes(32).toString('base64url');
    const browser = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    await this.prisma.oAuthState.create({
      data: {
        tokenHash: hash(state),
        browserHash: hash(browser),
        expiresAt: new Date(now.getTime() + STATE_TTL_MS),
      },
    });
    response.cookie(COOKIE_NAME, browser, {
      ...this.cookieOptions(settings.redirectUri),
      maxAge: STATE_TTL_MS,
    });
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      response_type: 'code',
      scope: 'identify email',
      state,
    }).toString();
    return url.toString();
  }

  async authenticate(
    request: Request,
    response: Response,
  ): Promise<DiscordProfile> {
    const settings = this.settings();
    // The browser secret has a fixed base64url alphabet; no cookie parser needed.
    const cookies = (request.headers.cookie ?? '')
      .split(';')
      .map((value) => value.trim())
      .filter((value) => value.startsWith(`${COOKIE_NAME}=`));
    const browser =
      cookies.length === 1 ? cookies[0].slice(COOKIE_NAME.length + 1) : '';
    response.clearCookie(COOKIE_NAME, this.cookieOptions(settings.redirectUri));
    const { state, code, error } = request.query;
    if (
      typeof state !== 'string' ||
      !RANDOM_TOKEN.test(state) ||
      !RANDOM_TOKEN.test(browser)
    ) {
      throw new UnauthorizedException(
        'Discord login state is invalid or expired; start again',
      );
    }
    // Atomic consumption prevents callback replay, even across service instances.
    const consumed = await this.prisma.oAuthState.deleteMany({
      where: {
        tokenHash: hash(state),
        browserHash: hash(browser),
        expiresAt: { gt: new Date() },
      },
    });
    if (consumed.count !== 1)
      throw new UnauthorizedException(
        'Discord login state is invalid or expired; start again',
      );
    if (error !== undefined)
      throw new UnauthorizedException(
        'Discord authorization was cancelled or denied',
      );
    if (typeof code !== 'string' || code.length === 0 || code.length > 2048) {
      throw new UnauthorizedException(
        'Discord authorization code is missing or invalid',
      );
    }

    const token = await this.discordJson(
      'https://discord.com/api/oauth2/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          redirect_uri: settings.redirectUri,
        }),
      },
    );
    if (
      !record(token) ||
      typeof token.access_token !== 'string' ||
      !token.access_token ||
      typeof token.token_type !== 'string' ||
      token.token_type.toLowerCase() !== 'bearer'
    ) {
      throw new BadGatewayException(
        'Discord returned an invalid token response',
      );
    }
    const profile = await this.discordJson(
      'https://discord.com/api/v10/users/@me',
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
      },
    );
    if (
      !record(profile) ||
      typeof profile.id !== 'string' ||
      !/^\d{17,20}$/.test(profile.id) ||
      typeof profile.username !== 'string' ||
      !profile.username ||
      profile.username.length > 100
    ) {
      throw new BadGatewayException('Discord returned an invalid user profile');
    }
    return {
      id: profile.id,
      username: profile.username,
      displayName:
        typeof profile.global_name === 'string' && profile.global_name
          ? profile.global_name.slice(0, 50)
          : profile.username.slice(0, 50),
      email:
        typeof profile.email === 'string' && isEmail(profile.email)
          ? profile.email
          : null,
      verified: profile.verified === true,
    };
  }

  private settings() {
    const clientId = this.config.get<string>('DISCORD_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('DISCORD_CLIENT_SECRET')
      ?.trim();
    const redirectUri = this.config.get<string>('DISCORD_REDIRECT_URI')?.trim();
    if (!clientId || !/^\d+$/.test(clientId) || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Discord login is not configured');
    }
    let url: URL;
    try {
      url = new URL(redirectUri);
    } catch {
      throw new ServiceUnavailableException('Discord redirect URI is invalid');
    }
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
    ) {
      throw new ServiceUnavailableException(
        'Discord redirect URI must use HTTPS, or HTTP on localhost for development',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private cookieOptions(redirectUri: string): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: redirectUri.startsWith('https:'),
      path: '/auth/discord',
    };
  }

  private async discordJson(url: string, init: RequestInit): Promise<unknown> {
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
    } catch {
      throw new BadGatewayException(
        'Unable to contact Discord; start login again',
      );
    }
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status))
        throw new UnauthorizedException(
          'Discord authorization failed; start login again',
        );
      throw new BadGatewayException(
        'Discord is temporarily unavailable; try again later',
      );
    }
    try {
      return await response.json();
    } catch {
      throw new BadGatewayException('Discord returned an invalid response');
    }
  }
}
