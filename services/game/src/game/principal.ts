import { type Request, type Response, type NextFunction } from 'express';
import { verifyAccessToken } from './jwt-verifier.js';

/**
 * Trusted-principal middleware (docs/auth-game-contract.md).
 * In development/testing, an explicit x-dev-user-id header is respected when DEV_PRINCIPAL=true.
 * In production, it verifies the Bearer access token or access_token cookie signed by user-service.
 */
export interface RequestPrincipal {
  userId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    principal?: RequestPrincipal;
  }
}

export function devPrincipalMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.DEV_PRINCIPAL === 'true' && req.header('x-dev-user-id')) {
    req.principal = { userId: req.header('x-dev-user-id')! };
    return next();
  }

  const authHeader = req.header('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : undefined;
  const cookieHeader = req.header('cookie');
  const cookieToken = cookieHeader?.match(
    /(?:^|;\s*)access_token=([^;]+)/,
  )?.[1];
  const token = bearerToken ?? cookieToken;

  if (!token) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.principal = { userId: payload.sub };
    next();
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
}

export function requirePrincipal(req: Request): RequestPrincipal {
  if (!req.principal) throw new Error('missing principal (auth middleware)');
  return req.principal;
}
