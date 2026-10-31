import { Inject, Optional, UseInterceptors } from "@nestjs/common";
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
import { AuthPrincipalClient } from "../auth/auth-principal-client.js";
import { GameService } from "./game.service.js";
import {
  authenticateHandshake,
  clearSocketExpiry,
  authorizeSocketMessage,
  broadcastGated,
  canEmitTo,
  socketPrincipal,
  type SocketVerifier,
} from "./socket-auth.js";

function userChannel(userId: string): string {
  return `user:${userId}`;
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function expiredStored(client: Socket): boolean {
  const p = socketPrincipal(client);
  return !!p && typeof p.expiresAt === "number" && p.expiresAt <= Date.now();
}

function isClientDead(client: Socket): boolean {
  if (!client.connected || expiredStored(client)) {
    try { client.disconnect(true); } catch {}
    return true;
  }
  return false;
}

@WebSocketGateway({ namespace: "/lobby", cors: { origin: true } })
@UseInterceptors(GameRuntimeInterceptor)
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap, OnModuleDestroy {
  @WebSocketServer()
  server!: Namespace;

  private disposeLobbySub?: () => void;

  constructor(
    @Inject(GameService) private readonly game: GameService,
    @Inject(AuthPrincipalClient) @Optional() private readonly verifier?: AuthPrincipalClient,
  ) {}

  private socketVerifier(): SocketVerifier | undefined {
    return this.verifier as unknown as SocketVerifier | undefined;
  }

  private handleRoomUpdated(payload: unknown): void {
    const p = payload as { roomId: string; room: unknown; members: Array<{ userId: string }>; audienceUserIds?: string[] };
    if (!p?.roomId) return;
    const audience = p.audienceUserIds ?? p.members?.map((member) => member.userId) ?? [];
    if (audience.length > 0) {
      void broadcastGated(this.server, audience.map(userChannel), "lobby.roomUpdated", p, () => this.game.runtimeReady);
    }
  }

  private handleMatchFound(payload: unknown): void {
    const p = payload as { roomId: string; matchId: string; userIds: string[] };
    if (p?.roomId && Array.isArray(p.userIds)) {
      void broadcastGated(this.server, p.userIds.map(userChannel), "lobby.matchFound", { roomId: p.roomId, matchId: p.matchId }, () => this.game.runtimeReady);
    }
  }

  private handleQueueMatched(payload: unknown): void {
    const p = payload as { matchId: string; userIds: string[] };
    if (p?.userIds && Array.isArray(p.userIds)) {
      for (const uid of p.userIds) {
        void broadcastGated(this.server, userChannel(uid), "lobby.queueMatched", { matchId: p.matchId }, () => this.game.runtimeReady);
      }
    }
  }

  onApplicationBootstrap(): void {
    this.disposeLobbySub = this.game.onLobbyEvent((event, payload) => {
      if (!this.game.runtimeReady) return;
      if (event === "lobby.roomUpdated") {
        this.handleRoomUpdated(payload);
      } else if (event === "lobby.matchFound") {
        this.handleMatchFound(payload);
      } else if (event === "lobby.queueMatched") {
        this.handleQueueMatched(payload);
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
      const principal = await authenticateHandshake(client, this.socketVerifier());
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      await client.join(userChannel(principal.userId));
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
    } catch { try { client.disconnect(true); } catch { /* best-effort */ } }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    clearSocketExpiry(client);
    // Rooms are automatically cleaned up by Socket.io on disconnect
  }

  private canServeClient(client: Socket): boolean {
    try {
      this.game.assertServing();
      return canEmitTo(client, this.game.runtimeReady);
    } catch {
      return false;
    }
  }

  private async executeJoinRoom(client: Socket, userId: string, roomId: string): Promise<{ ok: boolean; error?: string } | undefined> {
    if (!this.canServeClient(client)) return undefined;
    await this.game.roomForMember(userId, roomId);
    if (!this.canServeClient(client)) return undefined;
    await client.join(roomChannel(roomId));
    if (!this.canServeClient(client)) return undefined;
    return { ok: true };
  }

  private formatJoinError(error: unknown, client: Socket): { ok: false; error: string } | undefined {
    if (!this.canServeClient(client)) return undefined;
    return { ok: false, error: error instanceof Error ? error.message : "failed to join room" };
  }

  @SubscribeMessage("lobby:join_room")
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ ok: boolean; error?: string } | undefined> {
    if (isClientDead(client)) return undefined;

    let userId: string;
    try {
      ({ userId } = await authorizeSocketMessage(client, this.socketVerifier()));
    } catch (error) {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false, error: error instanceof Error ? error.message : "failed to join room" };
    }

    if (!body?.roomId) return { ok: false, error: "roomId is required" };

    try {
      return await this.executeJoinRoom(client, userId, body.roomId);
    } catch (error) {
      return this.formatJoinError(error, client);
    }
  }

  @SubscribeMessage("lobby:leave_room")
  async onLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ ok: boolean } | undefined> {
    if (isClientDead(client)) return undefined;

    try {
      await authorizeSocketMessage(client, this.socketVerifier());
    } catch {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false };
    }

    try {
      if (!this.canServeClient(client)) return undefined;
      if (body?.roomId) await client.leave(roomChannel(body.roomId));
      if (!this.canServeClient(client)) return undefined;
      return { ok: true };
    } catch {
      if (!this.canServeClient(client)) return undefined;
      return { ok: false };
    }
  }
}
