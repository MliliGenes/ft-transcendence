import { Inject, Optional, UseInterceptors } from "@nestjs/common";
import { GameRuntimeInterceptor } from "./runtime-availability.interceptor.js";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import { AuthPrincipalClient } from "../auth/auth-principal-client.js";
import { GameService } from "./game.service.js";
import {
  authenticateHandshake,
  clearSocketExpiry,
  authorizeSocketMessage,
  broadcastGated,
  canEmitTo,
  emitToSocket,
  relayGated,
  socketPrincipal,
  type MatchSocketPrincipal,
  type SocketVerifier,
} from "./socket-auth.js";

interface CollabUpdatePayload {
  roundId: string;
  updateB64: string;
}

interface RawCursorPayload {
  clientId?: unknown;
  anchor?: unknown;
  head?: unknown;
  displayName?: unknown;
  color?: unknown;
}

interface SanitizedCursorPayload {
  userId: string;
  clientId: number | null;
  anchor: number | null;
  head: number | null;
  displayName: string | null;
  color: string | null;
}

type SenderAuthResult =
  | { ok: true; principal: MatchSocketPrincipal }
  | { ok: false; response: { ok: false; error: string } | undefined };

const MAX_UPDATE_B64_BYTES = 262144;
const MAX_ROUND_ID_CHARS = 128;
const MAX_CURSOR_NAME_CHARS = 40;
const MAX_CURSOR_COLOR_CHARS = 16;

function expiredStored(client: Socket): boolean {
  const p = socketPrincipal(client);
  return !!p && typeof p.expiresAt === "number" && p.expiresAt <= Date.now();
}

function safeDisconnect(client: Socket): void {
  try {
    client.disconnect(true);
  } catch {
    /* best-effort */
  }
}

function ensureEmittable(client: Socket, runtimeReady: boolean): boolean {
  if (canEmitTo(client, runtimeReady)) return true;
  if (expiredStored(client)) safeDisconnect(client);
  return false;
}

function formatGatewayError(
  client: Socket,
  game: GameService,
  error: unknown,
  fallback: string,
): { ok: false; error: string } | undefined {
  if (!canEmitTo(client, game.runtimeReady)) return undefined;
  try {
    game.assertServing();
  } catch {
    return undefined;
  }
  return { ok: false as const, error: error instanceof Error ? error.message : fallback };
}

function validateCollabUpdate(body: unknown): CollabUpdatePayload {
  if (!body || typeof body !== "object") {
    throw new Error("malformed collab update");
  }
  const b = body as { roundId?: unknown; updateB64?: unknown };
  if (typeof b.roundId !== "string" || typeof b.updateB64 !== "string") {
    throw new Error("malformed collab update");
  }
  if (b.updateB64.length > MAX_UPDATE_B64_BYTES || b.roundId.length > MAX_ROUND_ID_CHARS) {
    throw new Error("collab update frame exceeds limit");
  }
  return { roundId: b.roundId, updateB64: b.updateB64 };
}

function sanitizeCursorPayload(userId: string, body: RawCursorPayload | undefined): SanitizedCursorPayload {
  const b = body ?? {};
  return {
    userId,
    clientId: typeof b.clientId === "number" ? b.clientId : null,
    anchor: typeof b.anchor === "number" ? b.anchor : null,
    head: typeof b.head === "number" ? b.head : null,
    displayName: typeof b.displayName === "string" ? b.displayName.slice(0, MAX_CURSOR_NAME_CHARS) : null,
    color: typeof b.color === "string" ? b.color.slice(0, MAX_CURSOR_COLOR_CHARS) : null,
  };
}

/**
 * Collaboration transport (ticket 15): a SEPARATE Socket.IO namespace from the
 * Arena game socket, carrying only Yjs document traffic:
 *
 *   join -> "sync" baseline (authoritative state + revision + language)
 *   "update" (client Yjs frame) -> server applies to the authoritative Y.Doc
 *     -> accepted frame relayed to teammates ("remote-update")
 *   "cursor" -> ephemeral awareness relay ("peer-cursor"), never the engine
 *
 * Game authority (RoundPhase, readiness, submit, reveal, presence, forfeit)
 * never flows here — the game gateway owns it. The engine emits
 * readiness.changed on the GAME namespace when an accepted edit bumps the
 * application revision, so both transports stay consistent.
 *
 * Authorization runs BEFORE any document sync: the verified access token
 * supplies identity, then collabSync verifies membership +
 * 2v2 + resolves the caller's own side/round. Failures disconnect with zero
 * document bytes. Room identity is server-derived (match:round:side), never
 * a client-supplied string.
 */
@WebSocketGateway({ namespace: "/collab", cors: { origin: true } })
@UseInterceptors(GameRuntimeInterceptor)
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  constructor(
    @Inject(GameService) private readonly game: GameService,
    @Inject(AuthPrincipalClient) @Optional() private readonly verifier?: AuthPrincipalClient,
  ) {}

  private socketVerifier(): SocketVerifier | undefined {
    return this.verifier as unknown as SocketVerifier | undefined;
  }

  private async authenticateSender(client: Socket, defaultError: string): Promise<SenderAuthResult> {
    if (!client.connected) {
      safeDisconnect(client);
      return { ok: false, response: undefined };
    }
    if (expiredStored(client)) {
      safeDisconnect(client);
      return { ok: false, response: undefined };
    }
    try {
      const principal = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
      return { ok: true, principal };
    } catch (error) {
      if (!this.game.runtimeReady) return { ok: false, response: undefined };
      return {
        ok: false,
        response: { ok: false, error: error instanceof Error ? error.message : defaultError },
      };
    }
  }

  private async migrateSocketRound(client: Socket, userId: string, matchId: string): Promise<boolean> {
    const sync = await this.game.collabSync(userId, matchId);
    this.game.assertServing();
    if (!ensureEmittable(client, this.game.runtimeReady)) return false;

    await client.leave(client.data.room);
    this.game.assertServing();
    if (!ensureEmittable(client, this.game.runtimeReady)) return false;

    client.data.room = sync.roomId;
    client.data.roundId = sync.roundId;
    await client.join(sync.roomId);
    this.game.assertServing();
    if (!ensureEmittable(client, this.game.runtimeReady)) return false;

    emitToSocket(client, "sync", sync, this.game.runtimeReady);
    return true;
  }

  private async relayCollabUpdate(client: Socket, payload: CollabUpdatePayload, revision: number): Promise<boolean> {
    if (!ensureEmittable(client, this.game.runtimeReady)) return false;
    await relayGated(
      client,
      this.server,
      client.data.room as string,
      "remote-update",
      { updateB64: payload.updateB64, revision, roundId: payload.roundId },
      () => this.game.runtimeReady,
    );
    return ensureEmittable(client, this.game.runtimeReady);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      this.game.assertServing();
      const principal = (await authenticateHandshake(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
      if (!canEmitTo(client, this.game.runtimeReady)) {
        safeDisconnect(client);
        return;
      }
      const sync = await this.game.collabSync(principal.userId, principal.matchId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        safeDisconnect(client);
        return;
      }
      client.data.room = sync.roomId;
      client.data.roundId = sync.roundId;
      await client.join(sync.roomId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        safeDisconnect(client);
        return;
      }
      emitToSocket(client, "sync", sync, this.game.runtimeReady);
    } catch {
      safeDisconnect(client);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    clearSocketExpiry(client);
    if (!this.game.runtimeReady) return;
    // Awareness is ephemeral: tell surviving teammates to drop the cursor.
    // Never touches game presence/forfeit (ticket 11 authority stays put).
    // Recipients are gated individually; an expired leaver still notifies
    // its live teammates.
    const room = client.data?.room;
    const principal = socketPrincipal(client, { matchIdRequired: true });
    if (typeof room === "string" && principal) {
      await broadcastGated(this.server, room, "peer-left", { userId: principal.userId }, () => this.game.runtimeReady);
    }
  }

  @SubscribeMessage("update")
  async onUpdate(@ConnectedSocket() client: Socket, @MessageBody() body: { roundId: string; updateB64: string }) {
    const auth = await this.authenticateSender(client, "update failed");
    if (!auth.ok) return auth.response;
    const { principal } = auth;

    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;

      const payload = validateCollabUpdate(body);
      const res = await this.game.applyCollabUpdate(principal.userId, principal.matchId, payload);
      this.game.assertServing();
      if (!ensureEmittable(client, this.game.runtimeReady)) return undefined;

      if (payload.roundId !== client.data.roundId) {
        const migrated = await this.migrateSocketRound(client, principal.userId, principal.matchId);
        if (!migrated) return undefined;
      }

      const relayed = await this.relayCollabUpdate(client, payload, res.revision);
      if (!relayed) return undefined;

      return { ok: true as const, revision: res.revision, changed: res.changed };
    } catch (error) {
      return formatGatewayError(client, this.game, error, "update failed");
    }
  }

  @SubscribeMessage("cursor")
  async onCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { clientId?: number; anchor?: number; head?: number; displayName?: string; color?: string },
  ) {
    // ponytail: awareness relay only — no engine call, no revision, no auth
    // re-check beyond the join-time gate. Ceiling: a compromised teammate
    // could spoof cursor labels; upgrade path is server-signed presence.
    const auth = await this.authenticateSender(client, "cursor failed");
    if (!auth.ok) return auth.response;
    const { principal } = auth;

    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      const room = client.data?.room;
      if (typeof room !== "string") throw new Error("unauthorized");

      const payload = sanitizeCursorPayload(principal.userId, body);
      await relayGated(client, this.server, room, "peer-cursor", payload, () => this.game.runtimeReady);
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      return { ok: true as const };
    } catch (error) {
      return formatGatewayError(client, this.game, error, "cursor failed");
    }
  }
}
