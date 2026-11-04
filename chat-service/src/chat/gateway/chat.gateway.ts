import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import type { Message } from '../../generated/prisma/client.js';
import { PresenceAudienceService } from '../presence-audience.service.js';
import { PresenceService, type PresenceChange } from '../presence.service.js';

@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  namespace: Namespace;

  private idleSweep?: ReturnType<typeof setInterval>;

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    private readonly presenceAudience: PresenceAudienceService,
  ) {}

  afterInit(namespace: Namespace) {
    this.idleSweep = setInterval(() => {
      this.presence.expireIdleUsers().forEach((change) => {
        void this.emitPresenceChange(change);
      });
    }, 15_000);
    this.idleSweep.unref?.();

    namespace.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.token;

        if (!token || typeof token !== 'string') {
          return next(new Error('Unauthorized'));
        }

        const payload = await this.jwt.verifyAsync<{
          sub?: string;
          exp?: number;
        }>(token);

        if (
          typeof payload.sub !== 'string' ||
          !isUUID(payload.sub) ||
          typeof payload.exp !== 'number'
        ) {
          return next(new Error('Unauthorized'));
        }

        socket.data.userId = payload.sub;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(socket: Socket) {
    const userId = socket.data.userId as string;
    await socket.join(`user:${userId}`);
    const change = this.presence.connect(userId, socket.id);
    const audience = await this.getPresenceAudience(userId);
    this.namespace.to(`user:${userId}`).emit('presence:snapshot', {
      users: this.presence.getStatuses([userId, ...audience]),
    });
    if (change) await this.emitPresenceChange(change, audience);
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string;
    const change = this.presence.disconnect(userId, socket.id);
    if (change) await this.emitPresenceChange(change);
    socket.leave(`user:${userId}`);
  }

  @SubscribeMessage('presence:activity')
  async onPresenceActivity(@ConnectedSocket() socket: Socket) {
    const userId = socket.data.userId as string;
    const change = this.presence.recordActivity(userId, socket.id);
    if (change) await this.emitPresenceChange(change);
  }

  onModuleDestroy() {
    if (this.idleSweep) clearInterval(this.idleSweep);
  }

  broadcastMessageCreated(userIds: string[], message: Message) {
    const rooms = userIds.map((userId) => `user:${userId}`);
    this.namespace.to(rooms).emit('message:created', message);
  }

  private async emitPresenceChange(
    change: PresenceChange,
    knownAudience?: string[],
  ) {
    this.namespace.to(`user:${change.userId}`).emit('presence:changed', change);
    const audience = knownAudience ?? await this.getPresenceAudience(change.userId);
    const rooms = audience
      .filter((userId) => userId !== change.userId)
      .map((userId) => `user:${userId}`);
    if (!rooms.length) return;
    this.namespace.to(rooms).emit('presence:changed', change);
  }

  private async getPresenceAudience(userId: string): Promise<string[]> {
    try {
      return await this.presenceAudience.getUserIds(userId);
    } catch (error) {
      this.logger.warn(`Could not resolve presence audience for ${userId}`, error);
      return [];
    }
  }
}
