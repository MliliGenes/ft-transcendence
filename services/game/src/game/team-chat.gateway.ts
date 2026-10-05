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
import { TeamChat } from "arena-game-engine";
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
export class TeamChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  private readonly chat: TeamChat;

  constructor(
    private readonly game: GameService,
    chat?: TeamChat,
  ) {
    this.chat =
      chat ??
      new TeamChat({
        resolveContext: (userId, matchId) => this.game.resolveTeamChatContext(userId, matchId),
      });
  }

  getRecentHistory(roomId: string): TeamChatEntry[] {
    return this.chat.getRecentHistory(roomId);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const principal = principalFromHandshake(client, { matchIdRequired: true });
      const { userId, matchId } = principal;
      // Authoritative game resolution: strangers (NotMemberError) and 1v1 (IllegalStateError) fail closed
      const context = await this.game.resolveTeamChatContext(userId, matchId);

      attachSocketPrincipal(client, principal);
      client.data.sideId = context.sideId;
      client.data.roomId = context.roomId;

      await client.join(context.roomId);
      client.emit("authorized", context);

      const recent = this.getRecentHistory(context.roomId);
      if (recent.length > 0) {
        client.emit("history", recent);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.chat.releaseConnection(client.id);
  }

  @SubscribeMessage("message")
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { text: unknown; clientMessageId?: unknown },
  ): Promise<{ ok: boolean; id?: string; error?: string }> {
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

    if (entry) {
      this.server?.to(roomId).emit("ping", entry);
    }
    return ack;
  }
}
