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
      if (matchId) void broadcastGated(this.server, roomFor(matchId), event, payload, this.game.runtimeReady);
    });
  }

  private socketVerifier(): SocketVerifier | undefined {
    return this.verifier as unknown as SocketVerifier | undefined;
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
        if (opened && principal?.matchId) {
          try { await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id); } catch { /* best-effort */ }
        }
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      const { userId, matchId } = principal;
      await this.game.snapshot(userId, matchId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      await this.game.noteSocketOpen(userId, matchId, client.id);
      opened = true;
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        await this.game.noteSocketClosed(userId, matchId, client.id);
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      await client.join(roomFor(matchId));
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        await this.game.noteSocketClosed(userId, matchId, client.id);
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      const snapshot = await this.game.snapshot(userId, matchId);
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) {
        await this.game.noteSocketClosed(userId, matchId, client.id);
        try { client.disconnect(true); } catch { /* best-effort */ }
        return;
      }
      emitToSocket(client, "snapshot", snapshot, this.game.runtimeReady);
    } catch {
      if (opened && principal?.matchId) {
        try { await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id); }
        catch { /* Existing best-effort cleanup policy. */ }
      }
      try { client.disconnect(true); } catch { /* best-effort */ }
    }
  }

  /**
   * Socket loss is NEVER a leave (ticket 11 §15): it only decrements the
   * per-user socket count, flipping the side offline at the last socket so
   * grace accounting starts. The match, clock, and evaluations continue.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const principal = socketPrincipal(client, { matchIdRequired: true });
    if (principal?.matchId) {
      await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id);
    }
  }

  @SubscribeMessage("run")
  async onRun(@ConnectedSocket() client: Socket, @MessageBody() body: { code: string; language: string }) {
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let principal: MatchSocketPrincipal;
    try {
      principal = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
    } catch (error) {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false as const, error: error instanceof Error ? error.message : "run failed" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      // Never read payload identity: side resolves from the socket principal.
      const result = await this.game.run(principal.userId, principal.matchId, body);
      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) try { client.disconnect(true); } catch {}
        return undefined;
      }
      this.game.assertServing();
      return { ok: true as const, result };
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false as const, error: error instanceof Error ? error.message : "run failed" };
    }
  }

  @SubscribeMessage("submit")
  async onSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code: string; language: string; submissionId?: string; evaluationId?: string },
  ) {
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let principal: MatchSocketPrincipal;
    try {
      principal = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
    } catch (error) {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false as const, error: error instanceof Error ? error.message : "submit failed" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      // Auth failure throws before the engine: an accepted Evaluation is
      // never failed here — late expiry only suppresses the ack.
      const result = await this.game.submit(principal.userId, principal.matchId, body);
      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) try { client.disconnect(true); } catch {}
        return undefined;
      }
      this.game.assertServing();
      return { ok: true as const, result };
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false as const, error: error instanceof Error ? error.message : "submit failed" };
    }
  }

  @SubscribeMessage("setReady")
  async onReady(@ConnectedSocket() client: Socket, @MessageBody() body: { value: boolean; documentRevision?: number }) {
    // 2v2: revision-bound per-player readiness (engine-enforced). 1v1 keeps
    // the legacy no-op ack — the engine returns without effect there.
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let principal: MatchSocketPrincipal;
    try {
      principal = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
    } catch (error) {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false as const, error: error instanceof Error ? error.message : "setReady failed" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      await this.game.setReady(principal.userId, principal.matchId, {
        ready: body?.value === true,
        documentRevision: body?.documentRevision,
      });
      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) try { client.disconnect(true); } catch {}
        return undefined;
      }
      this.game.assertServing();
      return { ok: true as const };
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false as const, error: error instanceof Error ? error.message : "setReady failed" };
    }
  }

  @SubscribeMessage("leave")
  async onLeave(@ConnectedSocket() client: Socket) {
    // Deliberate leave only: immediate forfeit (§15). Socket loss never lands
    // here — handleDisconnect owns that path and never forfeits.
    if (!client.connected) { try { client.disconnect(true); } catch {} return undefined; }
    if (expiredStored(client)) { try { client.disconnect(true); } catch {} return undefined; }
    let principal: MatchSocketPrincipal;
    try {
      principal = (await authorizeSocketMessage(client, this.socketVerifier(), { matchIdRequired: true })) as MatchSocketPrincipal;
    } catch (error) {
      if (!this.game.runtimeReady) return undefined;
      return { ok: false as const, error: error instanceof Error ? error.message : "leave failed" };
    }
    try {
      this.game.assertServing();
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      const result = await this.game.leave(principal.userId, principal.matchId);
      if (!canEmitTo(client, this.game.runtimeReady)) {
        if (expiredStored(client)) try { client.disconnect(true); } catch {}
        return undefined;
      }
      this.game.assertServing();
      return { ok: true as const, result };
    } catch (error) {
      if (!canEmitTo(client, this.game.runtimeReady)) return undefined;
      try { this.game.assertServing(); } catch { return undefined; }
      return { ok: false as const, error: error instanceof Error ? error.message : "leave failed" };
    }
  }
}
