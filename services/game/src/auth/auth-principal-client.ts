import { Injectable } from "@nestjs/common";

export type VerifiedPrincipal = { userId: string; expiresAt: number };

export class UnauthorizedError extends Error {
  constructor(message = "invalid access token") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class VerificationUnavailableError extends Error {
  constructor(message = "principal verification unavailable") {
    super(message);
    this.name = "VerificationUnavailableError";
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMEOUT_MS = 2000;

/** Verifies game access tokens against user-service GET /auth/principal. */
@Injectable()
export class AuthPrincipalClient {
  private readonly inFlight = new Map<string, Promise<VerifiedPrincipal>>();

  constructor(
    private readonly baseUrl: string = process.env.USER_SERVICE_BASE_URL ??
      "http://user-service:3000",
  ) {}

  verify(accessToken: string): Promise<VerifiedPrincipal> {
    const existing = this.inFlight.get(accessToken);
    if (existing) return existing;
    const pending = this.fetchPrincipal(accessToken);
    const tracked = pending.finally(() => {
      if (this.inFlight.get(accessToken) === tracked) this.inFlight.delete(accessToken);
    });
    this.inFlight.set(accessToken, tracked);
    return tracked;
  }

  private async fetchPrincipal(accessToken: string): Promise<VerifiedPrincipal> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/auth/principal`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new VerificationUnavailableError();
    }
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new VerificationUnavailableError(`principal status ${res.status}`);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new VerificationUnavailableError("principal body unreadable");
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new VerificationUnavailableError("principal body must be an object");
    }
    const principal = body as Partial<VerifiedPrincipal>;
    if (
      typeof principal.userId !== "string" ||
      !UUID_RE.test(principal.userId) ||
      !Number.isSafeInteger(principal.expiresAt) ||
      (principal.expiresAt as number) <= Date.now()
    ) {
      throw new VerificationUnavailableError("principal malformed or expired");
    }
    return { userId: principal.userId, expiresAt: principal.expiresAt as number };
  }
}
