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
import type { TeamChatEntry } from "arena-model";
import { TeamChat, type TeamChatAck } from "arena-game-engine/team-chat";
import { AuthPrincipalClient } from "../auth/auth-principal-client.js";
import { GameService } from "./game.service.js";
import {
  authenticateHandshake,
  clearSocketExpiry,
  authorizeSocketMessage,
  broadcastGated,
  canEmitTo,
  emitToSocket,
  type SocketVerifier,
} from "./socket-auth.js";

interface ChatSenderContext {
  userId: string;
  matchId: string;
  sideId: string;
  roomId: string;
}

type SenderAuthResult =
  | { ok: true; userId: string; matchId: string }
  | { ok: false; response: TeamChatAck | undefined };

function expiredStored(client: Socket): boolean {
  const data = (client.data ?? {}) as { arenaPrincipal?: { expiresAt?: number } };
  const exp = data.arenaPrincipal?.expiresAt;
  return typeof exp === "number" && exp <= Date.now();
}

function safeDisconnect(client: Socket): void {
  try {
    client.disconnect(true);
  } catch {
    /* best-effort */
  }
}

function ensureAdmissionEmittable(client: Socket, runtimeReady: boolean): boolean {
  if (canEmitTo(client, runtimeReady)) return true;
  safeDisconnect(client);
  return false;
}

function clientRoomContext(client: Socket): { sideId: string; roomId: string } | undefined {
  const sideId = client.data?.sideId as string | undefined;
  const roomId = client.data?.roomId as string | undefined;
  if (!sideId || !roomId) return undefined;
  return { sideId, roomId };
}

function formatGatewayError(
  client: Socket,
  game: GameService,
  error: unknown,
  fallback: string,
): TeamChatAck | undefined {
  if (!canEmitTo(client, game.runtimeReady)) return undefined;
  try {
    game.assertServing();
  } catch {
    return undefined;
  }
  return { ok: false, error: error instanceof Error ? error.message : fallback };
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

  private async authenticateSender(client: Socket): Promise<SenderAuthResult> {
    if (!client.connected) {
      safeDisconnect(client);
      return { ok: false, response: undefined };
    }
    if (expiredStored(client)) {
      safeDisconnect(client);
      return { ok: false, response: undefined };
    }
    try {
      const { userId, matchId } = (await authorizeSocketMessage(client, this.socketVerifier(), {
        matchIdRequired: true,
      })) as { userId: string; matchId: string };
      return { ok: true, userId, matchId };
    } catch {
      if (!this.game.runtimeReady) return { ok: false, response: undefined };
      return { ok: false, response: { ok: false, error: "unauthorized" } };
    }
  }

  private async broadcastCommitted(
    roomId: string,
    eventName: "message" | "ping",
    entry: TeamChatEntry | undefined,
  ): Promise<void> {
    if (!entry) return;
    await broadcastGated(this.server, roomId, eventName, entry, () => this.game.runtimeReady);
  }

  private async dispatchChatAction(
    client: Socket,
    eventName: "message" | "ping",
    fallbackError: string,
    action: (context: ChatSenderContext) => Promise<{ ack: TeamChatAck; entry?: TeamChatEntry }>,
  ): Promise<TeamChatAck | undefined> {
    const auth = await this.authenticateSender(client);
    if (!auth.ok) return auth.response;

    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;

      const room = clientRoomContext(client);
      if (!room) return { ok: false, error: "unauthorized" };

      const { ack, entry } = await action({
        userId: auth.userId,
        matchId: auth.matchId,
        sideId: room.sideId,
        roomId: room.roomId,
      });
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;

      await this.broadcastCommitted(room.roomId, eventName, entry);
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      return ack;
    } catch (error) {
      return formatGatewayError(client, this.game, error, fallbackError);
    }
  }

  getRecentHistory(roomId: string): TeamChatEntry[] {
    this.game.assertServing();
    return this.chat.getRecentHistory(roomId);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      this.game.assertServing();
      const principal = (await authenticateHandshake(client, this.socketVerifier(), {
        matchIdRequired: true,
      })) as { userId: string; matchId: string };
      if (!ensureAdmissionEmittable(client, this.game.runtimeReady)) return;

      const context = await this.game.resolveTeamChatContext(principal.userId, principal.matchId);
      this.game.assertServing();
      if (!ensureAdmissionEmittable(client, this.game.runtimeReady)) return;

      client.data.sideId = context.sideId;
      client.data.roomId = context.roomId;
      await client.join(context.roomId);
      this.game.assertServing();
      if (!ensureAdmissionEmittable(client, this.game.runtimeReady)) return;

      emitToSocket(client, "authorized", context, this.game.runtimeReady);
      const recent = this.getRecentHistory(context.roomId);
      this.game.assertServing();
      if (!ensureAdmissionEmittable(client, this.game.runtimeReady)) return;

      if (recent.length > 0) emitToSocket(client, "history", recent, this.game.runtimeReady);
    } catch {
      safeDisconnect(client);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    clearSocketExpiry(client);
    this.chat.releaseConnection(client.id);
  }

  @SubscribeMessage("message")
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { text: unknown; clientMessageId?: unknown },
  ): Promise<TeamChatAck | undefined> {
    return this.dispatchChatAction(client, "message", "message failed", (ctx) =>
      this.chat.acceptMessage({
        connectionId: client.id,
        userId: ctx.userId,
        matchId: ctx.matchId,
        sideId: ctx.sideId,
        roomId: ctx.roomId,
        text: body?.text,
        clientMessageId: body?.clientMessageId,
      }),
    );
  }

  @SubscribeMessage("ping")
  async onPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ping: unknown },
  ): Promise<TeamChatAck | undefined> {
    return this.dispatchChatAction(client, "ping", "ping failed", (ctx) =>
      this.chat.acceptPing({
        connectionId: client.id,
        userId: ctx.userId,
        matchId: ctx.matchId,
        sideId: ctx.sideId,
        roomId: ctx.roomId,
        ping: body?.ping,
      }),
    );
  }
}
