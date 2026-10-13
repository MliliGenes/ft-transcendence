import { UseInterceptors } from "@nestjs/common";
import { GameRuntimeInterceptor } from "./runtime-availability.interceptor.js";
import { Optional } from "@nestjs/common";
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
import { GameService } from "./game.service.js";
import { attachSocketPrincipal, principalFromHandshake, socketPrincipal } from "./socket-auth.js";

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

  constructor(
    private readonly game: GameService,
    @Optional() chat?: TeamChat,
  ) {
    this.chat =
      chat ??
      new TeamChat({
        resolveContext: (userId, matchId) => this.game.resolveTeamChatContext(userId, matchId),
      });
  }

  getRecentHistory(roomId: string): TeamChatEntry[] {
    this.game.assertServing();
    return this.chat.getRecentHistory(roomId);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      this.game.assertServing();
      const principal = principalFromHandshake(client, { matchIdRequired: true });
      const context = await this.game.resolveTeamChatContext(principal.userId, principal.matchId);
      this.game.assertServing();
      if (!client.connected) return;
      attachSocketPrincipal(client, principal);
      client.data.sideId = context.sideId; client.data.roomId = context.roomId;
      await client.join(context.roomId);
      this.game.assertServing();
      if (!client.connected) return;
      client.emit("authorized", context);
      const recent = this.getRecentHistory(context.roomId);
      this.game.assertServing();
      if (recent.length > 0 && client.connected) client.emit("history", recent);
    } catch { client.disconnect(true); }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.chat.releaseConnection(client.id);
  }

  @SubscribeMessage("message")
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { text: unknown; clientMessageId?: unknown },
  ): Promise<{ ok: boolean; id?: string; error?: string }> {
    this.game.assertServing();
    const sideId = client.data?.sideId as string | undefined;
    const roomId = client.data?.roomId as string | undefined;
    const principal = socketPrincipal(client, { matchIdRequired: true });

    if (!principal || !sideId || !roomId) {
      return { ok: false, error: "unauthorized" };
    }
    const { userId, matchId } = principal;

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

    if (entry) {
      this.server?.to(roomId).emit("message", entry);
    }
    return ack;
  }

  @SubscribeMessage("ping")
  async onPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ping: unknown },
  ): Promise<{ ok: boolean; id?: string; error?: string }> {
    this.game.assertServing();
    const sideId = client.data?.sideId as string | undefined;
    const roomId = client.data?.roomId as string | undefined;
    const principal = socketPrincipal(client, { matchIdRequired: true });

    if (!principal || !sideId || !roomId) {
      return { ok: false, error: "unauthorized" };
    }
    const { userId, matchId } = principal;

    const { ack, entry } = await this.chat.acceptPing({
      connectionId: client.id,
      userId,
      matchId,
      sideId,
      roomId,
      ping: body?.ping,
    });
    this.game.assertServing();

    if (entry) {
      this.server?.to(roomId).emit("ping", entry);
    }
    return ack;
  }
}
