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
import { type TeamChatEntry } from "arena-model";
import { TeamChat } from "arena-game-engine/team-chat";
import { AuthPrincipalClient } from "../auth/auth-principal-client.js";
import { GameService } from "./game.service.js";
import {
  authenticateHandshake,
  authorizeSocketMessage,
  broadcastGated,
  canEmitTo,
  emitToSocket,
  type SocketVerifier,
} from "./socket-auth.js";

function expiredStored(client: Socket): boolean {
  const data = (client.data ?? {}) as { arenaPrincipal?: { expiresAt?: number } };
  const exp = data.arenaPrincipal?.expiresAt;
  return typeof exp === "number" && exp <= Date.now();
}

/**
 * Team chat & contextual pings transport (ticket 16):
 * Authoritative 2v2 team-room isolation on the /chat namespace.
 *
 * Protocols separated:
 *   - / (default): Arena game authority (readiness, submit, reveal, clock)
 *   - /collab: Yjs document synchronization and awareness
 *   - /chat: Team chat messages and contextual quick pings
 *
 * Chat and pings NEVER mutate ArenaEngine state, NEVER touch Y.Doc or Yjs awareness,
 * NEVER increment DocumentRevision, and NEVER toggle game readiness.
 */
@WebSocketGateway({ namespace: "/chat", cors: { origin: true } })
@UseInterceptors(GameRuntimeInterceptor)
export class TeamChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  private readonly chat: TeamChat;

  // @Optional chat: no TeamChat provider is registered in GameModule — the
  // default below keeps direct construction and Nest DI working without one.
  constructor(
    @Inject(GameService) private readonly game: GameService,
    @Inject(TeamChat) @Optional() chat?: TeamChat,
    @Inject(AuthPrincipalClient) @Optional() private readonly verifier?: AuthPrincipalClient,
  ) {
    this.chat =
      chat ??
      new TeamChat({
        resolveContext: (userId, matchId) => this.game.resolveTeamChatContext(userId, matchId),
      });
  }

  private socketVerifier(): SocketVerifier | undefined {
    return this.verifier as unknown as SocketVerifier | undefined;
  }

  getRecentHistory(roomId: string): TeamChatEntry[] {
    this.game.assertServing();
    return this.chat.getRecentHistory(roomId);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      this.game.assertServing();
      const principal = (await authenticateHandshake(client, this.socketVerifier(), { matchIdRequired: true })) as { userId: string; matchId: string };
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      const context = await this.game.resolveTeamChatContext(principal.userId, principal.matchId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      client.data.sideId = context.sideId; client.data.roomId = context.roomId;
      await client.join(context.roomId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      emitToSocket(client, "authorized", context, this.game.runtimeReady);
      const recent = this.getRecentHistory(context.roomId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      if (recent.length > 0) emitToSocket(client, "history", recent, this.game.runtimeReady);
    } catch { try { client.disconnect(true); } catch { /* best-effort */ } }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.chat.releaseConnection(client.id);
  }

  @SubscribeMessage("message")
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { text: unknown; clientMessageId?: unknown },
  ): Promise<{ ok: boolean; id?: string; error?: string } | undefined> {
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let userId: string;
    let matchId: string;
    try {
      ({ userId, matchId } = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as { userId: string; matchId: string });
    } catch {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false, error: "unauthorized" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      const sideId = client.data?.sideId as string | undefined;
      const roomId = client.data?.roomId as string | undefined;
      if (!sideId || !roomId) return { ok: false, error: "unauthorized" };

      // Never trust payload identity: sender/room always derive from the
      // verified socket principal + join-time context.
      const { ack, entry } = await this.chat.acceptMessage({
        connectionId: client.id,
        userId,
        matchId,
        sideId,
        roomId,
        text: body?.text,
        clientMessageId: body?.clientMessageId,
      });
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;

      if (entry) {
        await broadcastGated(this.server, roomId, "message", entry, this.game.runtimeReady);
      }
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      return ack;
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false, error: error instanceof Error ? error.message : "message failed" };
    }
  }

  @SubscribeMessage("ping")
  async onPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ping: unknown },
  ): Promise<{ ok: boolean; id?: string; error?: string } | undefined> {
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let userId: string;
    let matchId: string;
    try {
      ({ userId, matchId } = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as { userId: string; matchId: string });
    } catch {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false, error: "unauthorized" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      const sideId = client.data?.sideId as string | undefined;
      const roomId = client.data?.roomId as string | undefined;
      if (!sideId || !roomId) return { ok: false, error: "unauthorized" };

      const { ack, entry } = await this.chat.acceptPing({
        connectionId: client.id,
        userId,
        matchId,
        sideId,
        roomId,
        ping: body?.ping,
      });
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;

      if (entry) {
        await broadcastGated(this.server, roomId, "ping", entry, this.game.runtimeReady);
      }
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      return ack;
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false, error: error instanceof Error ? error.message : "ping failed" };
    }
  }
}
