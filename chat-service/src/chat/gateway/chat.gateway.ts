import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import type { Message } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PresenceAudienceService } from '../presence/presence-audience.service.js';
import { PresenceService, type PresenceChange } from '../presence/presence.service.js';

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
    private readonly prisma: PrismaService,
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

  @SubscribeMessage('typing:changed')
  async onTypingChanged(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    const userId = socket.data.userId as string;
    if (!body || typeof body !== 'object') return { ok: false as const };

    const { conversationId, typing } = body as {
      conversationId?: unknown;
      typing?: unknown;
    };
    if (
      typeof conversationId !== 'string' ||
      !isUUID(conversationId) ||
      typeof typing !== 'boolean'
    ) {
      return { ok: false as const };
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { dmUserAId: userId },
          { dmUserBId: userId },
          {
            kind: 'CHANNEL',
            group: { is: { members: { some: { userId } } } },
          },
        ],
      },
      select: {
        dmUserAId: true,
        dmUserBId: true,
        group: { select: { members: { select: { userId: true } } } },
      },
    });
    if (!conversation) return { ok: false as const };

    const recipients = conversation.group
      ? conversation.group.members.map(({ userId: memberId }) => memberId)
      : [conversation.dmUserAId, conversation.dmUserBId].filter(
          (id): id is string => id !== null,
        );
    const rooms = recipients
      .filter((recipientId) => recipientId !== userId)
      .map((recipientId) => `user:${recipientId}`);

    if (rooms.length) {
      this.namespace.to(rooms).emit('typing:changed', {
        conversationId,
        userId,
        typing,
      });
    }
    return { ok: true as const };
  }

  broadcastReadState(
    userIds: string[],
    readState: {
      conversationId: string;
      userId: string;
      messageId: string;
      readAt: string;
    },
  ) {
    const rooms = userIds.map((userId) => `user:${userId}`);
    if (rooms.length) this.namespace.to(rooms).emit('read:updated', readState);
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
