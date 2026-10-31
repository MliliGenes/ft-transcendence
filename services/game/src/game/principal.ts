import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";
import {
  AuthPrincipalClient,
  VerificationUnavailableError,
} from "../auth/auth-principal-client.js";

/**
 * Verified identity for an HTTP request. `userId` is the authenticated
 * player; `expiresAt` is the upstream session expiry (Unix ms) carried by
 * the verified token. Game logic reads `userId` only; it never trusts
 * client-supplied identity (headers, query, or body).
 */
export interface RequestPrincipal {
  userId: string;
  expiresAt: number;
}

declare module "express-serve-static-core" {
  interface Request {
    principal?: RequestPrincipal;
  }
}

const BEARER_RE = /^Bearer +(\S+)$/i;

function isInternalProbe(req: Request): boolean {
  return req.method === "GET" && (req.path === "/health" || req.path === "/ready");
}

function isAttachedDevPrincipal(req: Request): boolean {
  return process.env.DEV_PRINCIPAL === "true" && Boolean(req.principal);
}

function tryExtractDevFixture(req: Request): RequestPrincipal | undefined {
  if (process.env.DEV_PRINCIPAL !== "true") return undefined;
  const fixture = req.header("x-dev-user-id");
  if (!fixture) return undefined;
  return { userId: fixture, expiresAt: Number.MAX_SAFE_INTEGER };
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.header("authorization") ?? "";
  return BEARER_RE.exec(authHeader)?.[1];
}

function handleVerificationFailure(res: Response, error: unknown): void {
  if (error instanceof VerificationUnavailableError) {
    res.status(503).json({ error: "verification unavailable" });
    return;
  }
  res.status(401).json({ error: "authentication required" });
}

@Injectable()
export class PrincipalMiddleware implements NestMiddleware {
  // @Inject: explicit token (vitest/esbuild drops design:paramtypes, so
  // constructor injection needs the token spelled out; tsc build unaffected).
  constructor(@Inject(AuthPrincipalClient) private readonly verifier: AuthPrincipalClient) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Internal probes never carry credentials. They are also outside this
    // middleware's route scope (see GameModule); this is belt-and-braces.
    // Explicit dev-suite fixture injection only: the dev suite may attach a
    // principal before this middleware runs.
    if (isInternalProbe(req) || isAttachedDevPrincipal(req)) {
      next();
      return;
    }

    const token = extractBearerToken(req);
    if (!token) {
      const devPrincipal = tryExtractDevFixture(req);
      if (devPrincipal) {
        req.principal = devPrincipal;
        next();
        return;
      }
      res.status(401).json({ error: "authentication required" });
      return;
    }

    try {
      const verified = await this.verifier.verify(token);
      req.principal = { userId: verified.userId, expiresAt: verified.expiresAt };
      next();
    } catch (error) {
      handleVerificationFailure(res, error);
    }
  }
}

export function requirePrincipal(req: Request): RequestPrincipal {
  if (!req.principal) throw new Error("missing principal (auth middleware)");
  return req.principal;
}
