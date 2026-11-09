import type { Socket } from "socket.io";
import { verifyAccessToken } from "./jwt-verifier.js";

/**
 * Trusted identity attached to a Socket.IO connection after its handshake.
 * The optional Match id is required by match-scoped namespaces and omitted by
 * the lobby namespace, which authenticates a user before room authorization.
 */
export interface SocketPrincipal {
  userId: string;
  matchId?: string;
}

export interface SocketPrincipalOptions {
  matchIdRequired?: boolean;
}

export type MatchSocketPrincipal = SocketPrincipal & { matchId: string };

type SocketDataWithPrincipal = {
  arenaPrincipal?: SocketPrincipal;
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Authenticate Socket.IO connection handshake.
 * In dev/testing, auth.userId or query.userId is accepted when DEV_PRINCIPAL=true.
 * In production, it verifies the RS256 token passed via auth.token, query.token,
 * Authorization header, or cookie.
 */
export function principalFromHandshake(client: Socket, options: { matchIdRequired: true }): MatchSocketPrincipal;
export function principalFromHandshake(client: Socket, options?: SocketPrincipalOptions): SocketPrincipal;
export function principalFromHandshake(client: Socket, options: SocketPrincipalOptions = {}): SocketPrincipal {
  const auth = (client.handshake.auth ?? {}) as Record<string, unknown>;
  const query = (client.handshake.query ?? {}) as Record<string, unknown>;

  // Dev principal shortcut when explicitly enabled
  if (process.env.DEV_PRINCIPAL === "true" && (auth.userId || query.userId)) {
    const userId = chooseHandshakeValue(auth.userId, query.userId, "userId");
    const matchId = chooseHandshakeValue(auth.matchId, query.matchId, "matchId");

    if (!userId) throw new Error("missing socket userId");
    if (options.matchIdRequired && !matchId) throw new Error("missing socket matchId");

    return matchId ? { userId, matchId } : { userId };
  }

  // Token authentication
  const authHeader = client.handshake.headers?.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
  const cookieHeader = client.handshake.headers?.cookie;
  const cookieToken = cookieHeader?.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1];
  const token = nonEmptyString(auth.token) ?? nonEmptyString(query.token) ?? bearerToken ?? cookieToken;

  if (!token) throw new Error("authentication required");

  const payload = verifyAccessToken(token);
  const userId = payload.sub;
  const matchId = chooseHandshakeValue(auth.matchId, query.matchId, "matchId");

  if (!userId) throw new Error("missing socket userId");
  if (options.matchIdRequired && !matchId) throw new Error("missing socket matchId");

  return matchId ? { userId, matchId } : { userId };
}

/** Store the verified handshake identity; namespace-specific context is added separately. */
export function attachSocketPrincipal(client: Socket, principal: SocketPrincipal): void {
  const data = client.data as SocketDataWithPrincipal;
  data.arenaPrincipal = principal;
}

/** Read a previously attached identity without throwing during disconnect cleanup. */
export function socketPrincipal(client: Socket, options: { matchIdRequired: true }): MatchSocketPrincipal | null;
export function socketPrincipal(client: Socket, options?: SocketPrincipalOptions): SocketPrincipal | null;
export function socketPrincipal(client: Socket, options: SocketPrincipalOptions = {}): SocketPrincipal | null {
  const data = client.data as SocketDataWithPrincipal;
  const principal = data.arenaPrincipal;
  if (!principal || !nonEmptyString(principal.userId)) return null;
  if (options.matchIdRequired && !nonEmptyString(principal.matchId)) return null;
  return principal.matchId ? { userId: principal.userId, matchId: principal.matchId } : { userId: principal.userId };
}

/** Require an authenticated socket session for a message handler. */
export function requireSocketPrincipal(client: Socket, options: { matchIdRequired: true }): MatchSocketPrincipal;
export function requireSocketPrincipal(client: Socket, options?: SocketPrincipalOptions): SocketPrincipal;
export function requireSocketPrincipal(client: Socket, options: SocketPrincipalOptions = {}): SocketPrincipal {
  const principal = socketPrincipal(client, options);
  if (!principal) throw new Error("unauthorized socket");
  return principal;
}

function chooseHandshakeValue(authValue: unknown, queryValue: unknown, field: string): string | undefined {
  const auth = nonEmptyString(authValue);
  const query = nonEmptyString(queryValue);
  if (auth && query && auth !== query) throw new Error(`conflicting socket ${field}`);
  return auth ?? query;
}
