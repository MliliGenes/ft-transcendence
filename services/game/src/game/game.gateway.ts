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
import type { Server, Socket } from "socket.io";
import { AuthPrincipalClient } from "../auth/auth-principal-client.js";
import { GameService } from "./game.service.js";
import {
  authenticateHandshake,
  clearSocketExpiry,
  authorizeSocketMessage,
  broadcastGated,
  canEmitTo,
  emitToSocket,
  socketPrincipal,
  type MatchSocketPrincipal,
  type SocketVerifier,
} from "./socket-auth.js";

function roomFor(matchId: string): string {
  return `match:${matchId}`;
}

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
  safeDisconnect(client);
  return false;
}

type SenderAuthResult =
  | { ok: true; principal: MatchSocketPrincipal }
  | { ok: false; response: { ok: false; error: string } | undefined };

/**
 * Real-time transport: game-owned event fan-out per match room.
 * Connection: handshake accessToken verified -> membership verified
 * against the match -> authorized room only -> authoritative snapshot ->
 * incremental events. Client payloads never carry identity: every action
 * re-verifies the stored token and re-resolves the side from the socket
 * principal. Per-recipient expiry gates every output.
 */
@WebSocketGateway({ cors: { origin: true } })
@UseInterceptors(GameRuntimeInterceptor)
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // @Inject: explicit tokens (vitest/esbuild drops design:paramtypes).
  // Verifier optional so legacy direct-construction tests (DEV seam, no
  // fixture) keep working; production Nest always injects it.
  constructor(
    @Inject(GameService) private readonly game: GameService,
    @Inject(AuthPrincipalClient) @Optional() private readonly verifier?: AuthPrincipalClient,
  ) {
    this.game.onEvent((event, matchId, payload) => {
      if (!this.game.runtimeReady) return;
      if (matchId) void broadcastGated(this.server, roomFor(matchId), event, payload, () => this.game.runtimeReady);
    });
  }

  private socketVerifier(): SocketVerifier | undefined {
    return this.verifier as unknown as SocketVerifier | undefined;
  }

  private async cleanupAdmissionFailure(
    client: Socket,
    principal: MatchSocketPrincipal | null,
    opened: boolean,
  ): Promise<void> {
    if (opened && principal?.matchId) {
      try {
        await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id);
      } catch {
        /* Existing best-effort cleanup policy. */
      }
    }
    safeDisconnect(client);
  }

  private async abortOpenConnection(
    client: Socket,
    principal: MatchSocketPrincipal,
  ): Promise<void> {
    await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id);
    safeDisconnect(client);
  }

  private async checkOpenEmittable(client: Socket, principal: MatchSocketPrincipal): Promise<boolean> {
    this.game.assertServing();
    if (canEmitTo(client, this.game.runtimeReady)) return true;
    await this.abortOpenConnection(client, principal);
    return false;
  }

  /**
   * Authoritative reconnect attach (ticket 11 §2/§3, strategy C): verify
   * membership, register the socket (presence), join the room FIRST, then
   * take the snapshot and send it as the ONE baseline. Events emitted between
   * join and baseline still reach this socket (it is already in the room) and
   * each triggers a full authoritative refresh client-side, so nothing is
   * lost between snapshot and subscription. Revision ordering (§3) lets the
   * client drop stale/out-of-order updates after reconnect.
   */
  async handleConnection(client: Socket): Promise<void> {
    let opened = false;
    let principal: MatchSocketPrincipal | null = null;
    try {
      this.game.assertServing();
      principal = (await authenticateHandshake(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
      if (!canEmitTo(client, this.game.runtimeReady)) {
        await this.cleanupAdmissionFailure(client, principal, opened);
        return;
      }
      const { userId, matchId } = principal;
      await this.game.snapshot(userId, matchId);
      this.game.assertServing();
      if (!ensureEmittable(client, this.game.runtimeReady)) return;

      await this.game.noteSocketOpen(userId, matchId, client.id);
      opened = true;
      if (!(await this.checkOpenEmittable(client, principal))) return;

      await client.join(roomFor(matchId));
      if (!(await this.checkOpenEmittable(client, principal))) return;

      const snapshot = await this.game.snapshot(userId, matchId);
      if (!(await this.checkOpenEmittable(client, principal))) return;

      emitToSocket(client, "snapshot", snapshot, this.game.runtimeReady);
    } catch {
      await this.cleanupAdmissionFailure(client, principal, opened);
    }
  }

  /**
   * Socket loss is NEVER a leave (ticket 11 §15): it only decrements the
   * per-user socket count, flipping the side offline at the last socket so
   * grace accounting starts. The match, clock, and evaluations continue.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    clearSocketExpiry(client);
    const principal = socketPrincipal(client, { matchIdRequired: true });
    if (principal?.matchId) {
      await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id);
    }
  }

  private async authenticateSender(
    client: Socket,
    fallbackError: string,
  ): Promise<SenderAuthResult> {
    if (!client.connected) {
      safeDisconnect(client);
      return { ok: false, response: undefined };
    }
    if (expiredStored(client)) {
      safeDisconnect(client);
      return { ok: false, response: undefined };
    }
    try {
      const principal = (await authorizeSocketMessage(client, this.socketVerifier(), {
        matchIdRequired: true,
      })) as MatchSocketPrincipal;
      return { ok: true, principal };
    } catch (error) {
      if (!this.game.runtimeReady) return { ok: false, response: undefined };
      return {
        ok: false,
        response: {
          ok: false,
          error: error instanceof Error ? error.message : fallbackError,
        },
      };
    }
  }

  private async dispatchGameCommand<TSuccess extends { ok: true }>(
    client: Socket,
    fallbackError: string,
    execute: (principal: MatchSocketPrincipal) => Promise<TSuccess>,
  ): Promise<TSuccess | { ok: false; error: string } | undefined> {
    const auth = await this.authenticateSender(client, fallbackError);
    if (!auth.ok) return auth.response;

    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;

      const successAck = await execute(auth.principal);

      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) safeDisconnect(client);
        return undefined;
      }
      this.game.assertServing();
      return successAck;
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try {
        this.game.assertServing();
      } catch {
        return undefined;
      }
      return { ok: false, error: error instanceof Error ? error.message : fallbackError };
    }
  }

  @SubscribeMessage("run")
  async onRun(@ConnectedSocket() client: Socket, @MessageBody() body: { code: string; language: string }) {
    return this.dispatchGameCommand(client, "run failed", async (principal) => {
      const result = await this.game.run(principal.userId, principal.matchId, body);
      return { ok: true as const, result };
    });
  }

  @SubscribeMessage("submit")
  async onSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code: string; language: string; submissionId?: string; evaluationId?: string },
  ) {
    return this.dispatchGameCommand(client, "submit failed", async (principal) => {
      const result = await this.game.submit(principal.userId, principal.matchId, body);
      return { ok: true as const, result };
    });
  }

  @SubscribeMessage("setReady")
  async onReady(@ConnectedSocket() client: Socket, @MessageBody() body: { value: boolean; documentRevision?: number }) {
    return this.dispatchGameCommand(client, "setReady failed", async (principal) => {
      await this.game.setReady(principal.userId, principal.matchId, {
        ready: body?.value === true,
        documentRevision: body?.documentRevision,
      });
      return { ok: true as const };
    });
  }

  @SubscribeMessage("leave")
  async onLeave(@ConnectedSocket() client: Socket) {
    return this.dispatchGameCommand(client, "leave failed", async (principal) => {
      const result = await this.game.leave(principal.userId, principal.matchId);
      return { ok: true as const, result };
    });
  }
}
