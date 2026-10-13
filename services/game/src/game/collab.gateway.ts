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
  authorizeSocketMessage,
  broadcastGated,
  canEmitTo,
  emitToSocket,
  relayGated,
  socketPrincipal,
  type MatchSocketPrincipal,
  type SocketVerifier,
} from "./socket-auth.js";

function expiredStored(client: Socket): boolean {
  const p = socketPrincipal(client);
  return !!p && typeof p.expiresAt === "number" && p.expiresAt <= Date.now();
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

  async handleConnection(client: Socket): Promise<void> {
    try {
      this.game.assertServing();
      const principal = (await authenticateHandshake(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      const sync = await this.game.collabSync(principal.userId, principal.matchId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      client.data.room = sync.roomId;
      client.data.roundId = sync.roundId;
      await client.join(sync.roomId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      emitToSocket(client, "sync", sync, this.game.runtimeReady);
    } catch {
      try { client.disconnect(true); } catch { /* best-effort */ }
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    if (!this.game.runtimeReady) return;
    // Awareness is ephemeral: tell surviving teammates to drop the cursor.
    // Never touches game presence/forfeit (ticket 11 authority stays put).
    // Recipients are gated individually; an expired leaver still notifies
    // its live teammates.
    const room = client.data?.room;
    const principal = socketPrincipal(client, { matchIdRequired: true });
    if (typeof room === "string" && principal) {
      await broadcastGated(this.server, room, "peer-left", { userId: principal.userId }, this.game.runtimeReady);
    }
  }

  @SubscribeMessage("update")
  async onUpdate(@ConnectedSocket() client: Socket, @MessageBody() body: { roundId: string; updateB64: string }) {
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let principal: MatchSocketPrincipal;
    try {
      principal = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
    } catch (error) {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false as const, error: error instanceof Error ? error.message : "update failed" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      const { userId, matchId } = principal;
      if (!body || typeof body.roundId !== "string" || typeof body.updateB64 !== "string") {
        throw new Error("malformed collab update");
      }
      if (body.updateB64.length > 262144 || body.roundId.length > 128) {
        throw new Error("collab update frame exceeds limit");
      }
      const res = await this.game.applyCollabUpdate(userId, matchId, { roundId: body.roundId, updateB64: body.updateB64 });
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) try { client.disconnect(true); } catch {}
        return undefined;
      }
      // Round advanced since join: move the socket to the current room so
      // later frames broadcast to the right teammates.
      if (body.roundId !== client.data.roundId) {
        const sync = await this.game.collabSync(userId, matchId);
        this.game.assertServing();
        if (!canEmitTo(client, this.game.runtimeReady)) {
          if (expiredStored(client)) try { client.disconnect(true); } catch {}
          return undefined;
        }
        await client.leave(client.data.room);
        this.game.assertServing();
        if (!canEmitTo(client, this.game.runtimeReady)) {
          if (expiredStored(client)) try { client.disconnect(true); } catch {}
          return undefined;
        }
        client.data.room = sync.roomId;
        client.data.roundId = sync.roundId;
        await client.join(sync.roomId);
        this.game.assertServing();
        if (!canEmitTo(client, this.game.runtimeReady)) {
          if (expiredStored(client)) try { client.disconnect(true); } catch {}
          return undefined;
        }
        emitToSocket(client, "sync", sync, this.game.runtimeReady);
      }
      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) try { client.disconnect(true); } catch {}
        return undefined;
      }
      await relayGated(client, this.server, client.data.room as string, "remote-update", { updateB64: body.updateB64, revision: res.revision, roundId: body.roundId }, this.game.runtimeReady);
      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) try { client.disconnect(true); } catch {}
        return undefined;
      }
      return { ok: true as const, revision: res.revision, changed: res.changed };
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false as const, error: error instanceof Error ? error.message : "update failed" };
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
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let principal: MatchSocketPrincipal;
    try {
      principal = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
    } catch (error) {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false as const, error: error instanceof Error ? error.message : "cursor failed" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      const room = client.data?.room;
      if (typeof room !== "string") throw new Error("unauthorized");
      await relayGated(client, this.server, room, "peer-cursor", {
        userId: principal.userId,
        clientId: typeof body?.clientId === "number" ? body.clientId : null,
        anchor: typeof body?.anchor === "number" ? body.anchor : null,
        head: typeof body?.head === "number" ? body.head : null,
        displayName: typeof body?.displayName === "string" ? body.displayName.slice(0, 40) : null,
        color: typeof body?.color === "string" ? body.color.slice(0, 16) : null,
      }, this.game.runtimeReady);
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      return { ok: true as const };
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false as const, error: error instanceof Error ? error.message : "cursor failed" };
    }
  }
}
