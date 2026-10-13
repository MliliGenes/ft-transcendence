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

@Injectable()
export class PrincipalMiddleware implements NestMiddleware {
  // @Inject: explicit token (vitest/esbuild drops design:paramtypes, so
  // constructor injection needs the token spelled out; tsc build unaffected).
  constructor(@Inject(AuthPrincipalClient) private readonly verifier: AuthPrincipalClient) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Internal probes never carry credentials. They are also outside this
    // middleware's route scope (see GameModule); this is belt-and-braces.
    if (req.method === "GET" && (req.path === "/health" || req.path === "/ready")) {
      next();
      return;
    }
    // Explicit dev-suite fixture injection only: the dev suite may attach a
    // principal before this middleware runs. Client identity sources are
    // never copied to req.principal in any environment.
    if (process.env.DEV_PRINCIPAL === "true" && req.principal) {
      next();
      return;
    }
    const token = BEARER_RE.exec(req.header("authorization") ?? "")?.[1];
    if (!token) {
      // DEV-ONLY fixture seam for the explicit dev suite (spawned-server
      // E2E): with DEV_PRINCIPAL=true a Bearer-less request carrying the dev
      // header is treated as the fixture principal, which never expires
      // upstream. With the seam off this is a plain 401.
      if (process.env.DEV_PRINCIPAL === "true") {
        const fixture = req.header("x-dev-user-id");
        if (fixture) {
          req.principal = { userId: fixture, expiresAt: Number.MAX_SAFE_INTEGER };
          next();
          return;
        }
      }
      res.status(401).json({ error: "authentication required" });
      return;
    }
    try {
      const verified = await this.verifier.verify(token);
      req.principal = { userId: verified.userId, expiresAt: verified.expiresAt };
      next();
    } catch (error) {
      if (error instanceof VerificationUnavailableError) {
        res.status(503).json({ error: "verification unavailable" });
        return;
      }
      res.status(401).json({ error: "authentication required" });
    }
  }
}

export function requirePrincipal(req: Request): RequestPrincipal {
  if (!req.principal) throw new Error("missing principal (auth middleware)");
  return req.principal;
}
