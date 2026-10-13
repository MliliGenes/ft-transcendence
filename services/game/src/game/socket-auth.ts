import type { Socket } from "socket.io";
import type { AuthPrincipalClient } from "../auth/auth-principal-client.js";

/**
 * Trusted identity attached to a Socket.IO connection after its handshake.
 * `expiresAt` is the upstream session expiry (Unix ms) carried by the
 * verified token. The optional Match id is required by match-scoped
 * namespaces and omitted by the lobby namespace.
 */
export interface SocketPrincipal {
  userId: string;
  expiresAt: number;
  matchId?: string;
}

export interface SocketPrincipalOptions {
  matchIdRequired?: boolean;
}

export type MatchSocketPrincipal = SocketPrincipal & { matchId: string };

/** Minimal verifier surface (AuthPrincipalClient or explicit test fixture). */
export interface SocketVerifier {
  verify(accessToken: string): Promise<{ userId: string; expiresAt: number }>;
}

type SocketDataWithPrincipal = {
  arenaPrincipal?: SocketPrincipal;
  accessToken?: string;
};

const NEVER_EXPIRES = Number.MAX_SAFE_INTEGER;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Read the current DEV_PRINCIPAL handshake seam in one place.
 *
 * Production replaces this seam with the authenticated principal supplied by
 * the auth module (verified access token). Namespace gateways should not
 * parse handshake fields or trust client identity after this function
 * returns. Fixture `auth.userId`/query/`x-dev-user-id` sources are honored
 * ONLY behind DEV_PRINCIPAL=true; otherwise they fail closed.
 */
export function principalFromHandshake(client: Socket, options: { matchIdRequired: true }): MatchSocketPrincipal;
export function principalFromHandshake(client: Socket, options?: SocketPrincipalOptions): SocketPrincipal;
export function principalFromHandshake(client: Socket, options: SocketPrincipalOptions = {}): SocketPrincipal {
  if (process.env.DEV_PRINCIPAL !== "true") throw new Error("authentication required");

  const auth = (client.handshake.auth ?? {}) as Record<string, unknown>;
  const query = (client.handshake.query ?? {}) as Record<string, unknown>;
  const headers = ((client.handshake as unknown as { headers?: Record<string, unknown> }).headers ?? {}) as Record<string, unknown>;
  const headerUser = nonEmptyString(headers["x-dev-user-id"] ?? headers["X-Dev-User-Id"]);
  const userId = chooseHandshakeValue(chooseHandshakeValue(auth.userId, query.userId, "userId"), headerUser, "userId");
  const matchId = chooseHandshakeValue(auth.matchId, query.matchId, "matchId");

  if (!userId) throw new Error("missing socket userId");
  if (options.matchIdRequired && !matchId) throw new Error("missing socket matchId");

  return matchId ? { userId, matchId, expiresAt: NEVER_EXPIRES } : { userId, expiresAt: NEVER_EXPIRES };
}

/** Store the verified handshake identity; namespace-specific context is added separately. */
export function attachSocketPrincipal(
  client: Socket,
  principal: SocketPrincipal | { userId: string; matchId?: string; expiresAt?: number },
  accessToken?: string,
): void {
  const data = client.data as SocketDataWithPrincipal;
  // Keep { userId, expiresAt, matchId } only: the token lives in its own
  // private field and is never merged into the principal.
  data.arenaPrincipal = {
    userId: principal.userId,
    expiresAt: typeof principal.expiresAt === "number" ? principal.expiresAt : NEVER_EXPIRES,
    ...(principal.matchId ? { matchId: principal.matchId } : {}),
  };
  if (typeof accessToken === "string" && accessToken.length > 0) {
    data.accessToken = accessToken;
  }
}

/** Read a previously attached identity without throwing during disconnect cleanup. */
export function socketPrincipal(client: Socket, options: { matchIdRequired: true }): MatchSocketPrincipal | null;
export function socketPrincipal(client: Socket, options?: SocketPrincipalOptions): SocketPrincipal | null;
export function socketPrincipal(client: Socket, options: SocketPrincipalOptions = {}): SocketPrincipal | null {
  const data = client.data as SocketDataWithPrincipal;
  const principal = data.arenaPrincipal;
  if (!principal || !nonEmptyString(principal.userId)) return null;
  if (typeof principal.expiresAt !== "number") return null;
  if (options.matchIdRequired && !nonEmptyString(principal.matchId)) return null;
  return principal.matchId
    ? { userId: principal.userId, expiresAt: principal.expiresAt, matchId: principal.matchId }
    : { userId: principal.userId, expiresAt: principal.expiresAt };
}

/** Require an authenticated socket session for a message handler. */
export function requireSocketPrincipal(client: Socket, options: { matchIdRequired: true }): MatchSocketPrincipal;
export function requireSocketPrincipal(client: Socket, options?: SocketPrincipalOptions): SocketPrincipal;
export function requireSocketPrincipal(client: Socket, options: SocketPrincipalOptions = {}): SocketPrincipal {
  const principal = socketPrincipal(client, options);
  if (!principal) throw new Error("unauthorized socket");
  return principal;
}

function handshakeToken(client: Socket): string | undefined {
  const auth = (client.handshake.auth ?? {}) as Record<string, unknown>;
  return nonEmptyString(auth.accessToken);
}

function handshakeMatchId(client: Socket, field = "matchId"): string | undefined {
  const auth = (client.handshake.auth ?? {}) as Record<string, unknown>;
  const query = (client.handshake.query ?? {}) as Record<string, unknown>;
  return chooseHandshakeValue(auth[field], query[field], `socket ${field}`);
}

/**
 * Verify the handshake `auth:{accessToken, matchId?}` at connect, attach
 * `{ userId, expiresAt, matchId }`, and store the token privately in
 * `client.data.accessToken`. Without a token the DEV_PRINCIPAL fixture seam
 * supplies a never-expiring principal; with the seam off it fails closed.
 * Never trusts payload identity: the userId always comes from the verifier.
 */
export function authenticateHandshake(
  client: Socket,
  verifier: SocketVerifier | undefined | null,
  options: { matchIdRequired: true },
): Promise<MatchSocketPrincipal>;
export function authenticateHandshake(
  client: Socket,
  verifier: SocketVerifier | undefined | null,
  options?: SocketPrincipalOptions,
): Promise<SocketPrincipal>;
export async function authenticateHandshake(
  client: Socket,
  verifier: SocketVerifier | undefined | null,
  options: SocketPrincipalOptions = {},
): Promise<SocketPrincipal> {
  const token = handshakeToken(client);
  if (token) {
    if (!verifier || typeof verifier.verify !== "function") throw new Error("authentication required");
    const verified = await verifier.verify(token);
    if (!nonEmptyString(verified?.userId)) throw new Error("authentication required");
    if (typeof verified.expiresAt !== "number" || verified.expiresAt <= Date.now()) {
      throw new Error("expired access token");
    }
    const matchId = handshakeMatchId(client);
    if (options.matchIdRequired && !matchId) throw new Error("missing socket matchId");
    const principal: SocketPrincipal = matchId
      ? { userId: verified.userId, expiresAt: verified.expiresAt, matchId }
      : { userId: verified.userId, expiresAt: verified.expiresAt };
    attachSocketPrincipal(client, principal, token);
    return principal;
  }
  // No token: explicit dev-suite seam only.
  if (process.env.DEV_PRINCIPAL !== "true" || !isDevVerifier(verifier)) {
    if (process.env.DEV_PRINCIPAL !== "true") throw new Error("authentication required");
  }
  const principal = principalFromHandshake(client, options);
  attachSocketPrincipal(client, principal);
  return principal;
}

function isDevVerifier(verifier: unknown): boolean {
  // DEV fallback works with an explicit fixture verifier or none (legacy
  // direct-construction tests). Production (verifier present, seam off) never
  // reaches here because the token branch above throws first.
  return verifier === undefined || verifier === null || typeof (verifier as SocketVerifier)?.verify === "function";
}

/**
 * Per-message re-verification: re-calls `verify(storedToken)`, checks userId
 * equality + `expiresAt > Date.now()`, else `disconnect(true)` + throw.
 * Fixture sockets (no stored token, DEV seam) only check stored expiry.
 * Payload identity is never read: only the stored token + stored principal.
 */
export function authorizeSocketMessage(
  client: Socket,
  verifier: SocketVerifier | undefined | null,
  options: { matchIdRequired: true },
): Promise<MatchSocketPrincipal>;
export function authorizeSocketMessage(
  client: Socket,
  verifier: SocketVerifier | undefined | null,
  options?: SocketPrincipalOptions,
): Promise<SocketPrincipal>;
export async function authorizeSocketMessage(
  client: Socket,
  verifier: SocketVerifier | undefined | null,
  options: SocketPrincipalOptions = {},
): Promise<SocketPrincipal> {
  const data = client.data as SocketDataWithPrincipal;
  const stored = data.arenaPrincipal;
  const fail = (message: string): Error => {
    try { client.disconnect(true); } catch { /* best-effort */ }
    return new Error(message);
  };
  if (!stored || !nonEmptyString(stored.userId)) throw fail("unauthorized socket");
  if (typeof stored.expiresAt !== "number" || stored.expiresAt <= Date.now()) throw fail("expired socket session");
  if (options.matchIdRequired && !nonEmptyString(stored.matchId)) throw fail("unauthorized socket");
  const token = typeof data.accessToken === "string" && data.accessToken.length > 0 ? data.accessToken : undefined;
  if (!token) {
    // DEV fixture: no upstream to re-verify against.
    return options.matchIdRequired
      ? { userId: stored.userId, expiresAt: stored.expiresAt, matchId: stored.matchId as string }
      : { userId: stored.userId, expiresAt: stored.expiresAt, ...(stored.matchId ? { matchId: stored.matchId } : {}) };
  }
  if (!verifier || typeof verifier.verify !== "function") throw fail("authentication required");
  let verified: { userId: string; expiresAt: number };
  try {
    verified = await verifier.verify(token);
  } catch {
    throw fail("unauthorized socket");
  }
  if (verified.userId !== stored.userId) throw fail("unauthorized socket");
  if (typeof verified.expiresAt !== "number" || verified.expiresAt <= Date.now()) throw fail("expired socket session");
  // Refresh expiry so rolling sessions stay valid without reconnecting.
  stored.expiresAt = verified.expiresAt;
  return options.matchIdRequired
    ? { userId: stored.userId, expiresAt: stored.expiresAt, matchId: stored.matchId as string }
    : { userId: stored.userId, expiresAt: stored.expiresAt, ...(stored.matchId ? { matchId: stored.matchId } : {}) };
}

/** Per-recipient pre-emission gate: connected && unexpired && runtime serving. */
export function canEmitTo(client: Socket, runtimeReady: boolean): boolean {
  if (!runtimeReady) return false;
  if (!client.connected) return false;
  const data = (client.data ?? {}) as SocketDataWithPrincipal;
  const principal = data.arenaPrincipal;
  if (!principal || typeof principal.expiresAt !== "number" || principal.expiresAt <= Date.now()) return false;
  return true;
}

/** Emit only when the recipient gate passes (snapshot/sync/history/auth). */
export function emitToSocket(client: Socket, event: string, payload: unknown, runtimeReady: boolean): void {
  if (!canEmitTo(client, runtimeReady)) return;
  try { client.emit(event, payload); } catch { /* best-effort */ }
}

type EmittableRemote = {
  id: string;
  connected: boolean;
  data?: SocketDataWithPrincipal;
  emit(event: string, payload: unknown): void;
};

function readFetchSockets(server: unknown, room: string): Promise<EmittableRemote[] | null> {
  try {
    const scoped = (server as { in: (room: string) => { fetchSockets: () => Promise<EmittableRemote[]> } }).in?.(room);
    if (scoped && typeof scoped.fetchSockets === "function") return scoped.fetchSockets().catch(() => null);
  } catch { /* fall through to broadcast fallback */ }
  return Promise.resolve(null);
}

/**
 * Per-recipient gated broadcast for engine-driven fan-out (game events,
 * lobby hints, chat/pings, collab peer-left). When the server exposes
 * `in(room).fetchSockets()` each recipient is gated individually; fakes
 * without it fall back to a single runtime-gated `to(...).emit`.
 */
export async function broadcastGated(
  server: unknown,
  targets: string | string[],
  event: string,
  payload: unknown,
  runtimeReady: boolean,
): Promise<void> {
  if (!runtimeReady || !server) return;
  const rooms = Array.isArray(targets) ? targets : [targets];
  let inspected = false;
  try {
    const seen = new Map<string, EmittableRemote>();
    for (const room of rooms) {
      const sockets = await readFetchSockets(server, room);
      if (!sockets) return fallbackBroadcast(server, rooms, event, payload);
      inspected = true;
      for (const s of sockets) seen.set(s.id, s);
    }
    if (!inspected) return fallbackBroadcast(server, rooms, event, payload);
    for (const s of seen.values()) {
      try {
        if (!s.connected) continue;
        const expiresAt = s.data?.arenaPrincipal?.expiresAt;
        if (typeof expiresAt !== "number" || expiresAt <= Date.now()) continue;
        s.emit(event, payload);
      } catch { /* per-recipient best-effort */ }
    }
  } catch {
    return fallbackBroadcast(server, rooms, event, payload);
  }
}

function fallbackBroadcast(server: unknown, rooms: string[], event: string, payload: unknown): void {
  try {
    (server as { to: (t: string | string[]) => { emit(e: string, p: unknown): void } })
      .to(rooms.length === 1 ? rooms[0] : rooms)?.emit(event, payload);
  } catch { /* best-effort */ }
}

/**
 * Gated relay for sender-scoped fan-out (`client.to(room)` paths: collab
 * remote-update, peer-cursor). The sender must pass the gate; recipients are
 * gated individually when inspectable, otherwise the sender-scoped broadcast
 * is used as-is.
 */
export async function relayGated(
  sender: Socket,
  server: unknown,
  room: string,
  event: string,
  payload: unknown,
  runtimeReady: boolean,
): Promise<void> {
  if (!canEmitTo(sender, runtimeReady)) return;
  if (!server) {
    try { sender.to(room).emit(event, payload); } catch { /* best-effort */ }
    return;
  }
  const sockets = await readFetchSockets(server, room);
  if (!sockets) {
    try { sender.to(room).emit(event, payload); } catch { /* best-effort */ }
    return;
  }
  for (const s of sockets) {
    try {
      if (s.id === sender.id) continue;
      if (!s.connected) continue;
      const expiresAt = s.data?.arenaPrincipal?.expiresAt;
      if (typeof expiresAt !== "number" || expiresAt <= Date.now()) continue;
      s.emit(event, payload);
    } catch { /* per-recipient best-effort */ }
  }
}

export type { AuthPrincipalClient };

function chooseHandshakeValue(authValue: unknown, queryValue: unknown, field: string): string | undefined {
  const auth = nonEmptyString(authValue);
  const query = nonEmptyString(queryValue);
  if (auth && query && auth !== query) throw new Error(`conflicting socket ${field}`);
  return auth ?? query;
}
