import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

export function trustedBrowserOrigins(config: ConfigService): Set<string> {
  const origins = new Set<string>();
  const configured = [
    config.get<string>('AUTH_FRONTEND_URL'),
    ...(config.get<string>('AUTH_FRONTEND_ORIGINS') ?? '').split(','),
  ];
  for (const candidate of configured) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        origins.add(url.origin);
      }
    } catch {
      // An invalid frontend origin cannot authorize a browser request.
    }
  }
  if (config.get<string>('NODE_ENV') !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }
  return origins;
}

export function assertTrustedBrowserOrigin(
  request: Request,
  config: ConfigService,
): void {
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  let sourceOrigin = origin;
  if (!sourceOrigin && referer) {
    try {
      sourceOrigin = new URL(referer).origin;
    } catch {
      throw new ForbiddenException('Request origin is not allowed');
    }
  }
  if (sourceOrigin && !trustedBrowserOrigins(config).has(sourceOrigin)) {
    throw new ForbiddenException('Request origin is not allowed');
  }
}
