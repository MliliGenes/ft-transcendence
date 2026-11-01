import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import type { Message } from '../../generated/prisma/client.js';

@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  namespace: Namespace;

  constructor(private readonly jwt: JwtService) {}

  afterInit(namespace: Namespace) {
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
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string;
    socket.leave(`user:${userId}`);
  }

  broadcastMessageCreated(userIds: string[], message: Message) {
    const rooms = userIds.map((userId) => `user:${userId}`);
    this.namespace.to(rooms).emit('message:created', message);
  }
}
