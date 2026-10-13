import { UseInterceptors } from "@nestjs/common";
import { GameRuntimeInterceptor } from "./runtime-availability.interceptor.js";
import { OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
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
import { GameService } from "./game.service.js";
import { attachSocketPrincipal, principalFromHandshake, requireSocketPrincipal } from "./socket-auth.js";

function userChannel(userId: string): string {
  return `user:${userId}`;
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

@WebSocketGateway({ namespace: "/lobby", cors: { origin: true } })
@UseInterceptors(GameRuntimeInterceptor)
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap, OnModuleDestroy {
  @WebSocketServer()
  server!: Namespace;

  private disposeLobbySub?: () => void;

  constructor(private readonly game: GameService) {}

  onApplicationBootstrap(): void {
    this.disposeLobbySub = this.game.onLobbyEvent((event, payload) => {
      if (!this.game.runtimeReady) return;
      if (event === "lobby.roomUpdated") {
        const p = payload as { roomId: string; room: unknown; members: Array<{ userId: string }>; audienceUserIds?: string[] };
        if (p?.roomId) {
          const audience = p.audienceUserIds ?? p.members?.map((member) => member.userId) ?? [];
          if (audience.length > 0) {
            this.server?.to(audience.map(userChannel)).emit("lobby.roomUpdated", p);
          }
        }
      } else if (event === "lobby.matchFound") {
        const p = payload as { roomId: string; matchId: string; userIds: string[] };
        if (p?.roomId && Array.isArray(p.userIds)) {
          this.server?.to(p.userIds.map(userChannel)).emit("lobby.matchFound", { roomId: p.roomId, matchId: p.matchId });
        }
      } else if (event === "lobby.queueMatched") {
        const p = payload as { matchId: string; userIds: string[] };
        if (p?.userIds && Array.isArray(p.userIds)) {
          for (const uid of p.userIds) {
            this.server?.to(userChannel(uid)).emit("lobby.queueMatched", { matchId: p.matchId });
          }
        }
      }
    });
  }

  onModuleDestroy(): void {
    this.disposeLobbySub?.();
    this.disposeLobbySub = undefined;
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      this.game.assertServing();
      const principal = principalFromHandshake(client);
      attachSocketPrincipal(client, principal);
      await client.join(userChannel(principal.userId));
      this.game.assertServing();
      if (!client.connected) return;
    } catch { client.disconnect(true); }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // Rooms are automatically cleaned up by Socket.io on disconnect
  }

  @SubscribeMessage("lobby:join_room")
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      this.game.assertServing();
      const { userId } = requireSocketPrincipal(client);
      if (!body?.roomId) return { ok: false, error: "roomId is required" };
      await this.game.roomForMember(userId, body.roomId);
      this.game.assertServing();
      if (!client.connected) return { ok: false };
      await client.join(roomChannel(body.roomId));
      this.game.assertServing();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "failed to join room" };
    }
  }

  @SubscribeMessage("lobby:leave_room")
  async onLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ ok: boolean }> {
    try {
      this.game.assertServing(); requireSocketPrincipal(client);
      if (body?.roomId) await client.leave(roomChannel(body.roomId));
      this.game.assertServing();
      return { ok: true };
    } catch { return { ok: false }; }
  }
}
