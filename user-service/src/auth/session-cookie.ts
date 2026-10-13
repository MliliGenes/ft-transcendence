import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { REFRESH_TOKEN_TTL_SECONDS } from './token.constants.js';

export const REFRESH_COOKIE_NAME = 'auth-refresh';

export function refreshCookieOptions(config: ConfigService): CookieOptions {
  const frontendUrl = config.get<string>('AUTH_FRONTEND_URL')?.trim();
  const secure =
    config.get<string>('NODE_ENV') === 'production' ||
    frontendUrl?.startsWith('https:') === true;
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  };
}

export function readRefreshCookie(request: Request): string {
  const prefix = `${REFRESH_COOKIE_NAME}=`;
  const matches = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  return matches.length === 1 ? matches[0].slice(prefix.length) : '';
}

export function setRefreshCookie(
  response: Response,
  config: ConfigService,
  refreshToken: string,
): void {
  response.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    refreshCookieOptions(config),
  );
  clearLegacyRootCookie(response, config);
}

export function clearRefreshCookie(
  response: Response,
  config: ConfigService,
): void {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions(config);
  response.clearCookie(REFRESH_COOKIE_NAME, options);
  clearLegacyRootCookie(response, config);
}

/** HttpOnly legacy cookies must be deleted by the server at their original path. */
function clearLegacyRootCookie(
  response: Response,
  config: ConfigService,
): void {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions(config);
  response.clearCookie(REFRESH_COOKIE_NAME, { ...options, path: '/' });
}

export function publicSession<
  T extends { refreshToken: string; refreshExpiresIn: number },
>(session: T): Omit<T, 'refreshToken' | 'refreshExpiresIn'> {
  const {
    refreshToken: _refreshToken,
    refreshExpiresIn: _refreshExpiresIn,
    ...publicData
  } = session;
  return publicData;
}
