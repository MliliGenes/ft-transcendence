import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { createHash } from 'crypto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetDm(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new Error('Cannot create a DM with yourself.');
    }

    const targetUser = await this.prisma.chatUser.findUnique({
      where: { id: otherUserId.toLowerCase() },
      select: { deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt !== null) {
      // TODO: fallbacks to the user-service so we can fetch the user from there ofc if it exists
      throw new NotFoundException('User not found');
    }

    const [dmUserAId, dmUserBId] = [
      userId.toLowerCase(),
      otherUserId.toLowerCase(),
    ].sort();

    const existingConversation = await this.prisma.conversation.findUnique({
      where: {
        dmUserAId_dmUserBId: {
          dmUserAId,
          dmUserBId,
        },
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    const newConversation = await this.prisma.conversation.create({
      data: {
        kind: 'DM',
        dmUserAId,
        dmUserBId,
      },
    });

    return newConversation;
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ dmUserAId: userId }, { dmUserBId: userId }],
      },
    });

    return conversations;
  }

  async sendMessage(
    userId: string,
    msg: SendMessageDto,
    conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
        AND: [{ OR: [{ dmUserAId: userId }, { dmUserBId: userId }] }],
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const requestHash = createHash('sha256')
      .update(JSON.stringify([conversationId, msg.content]))
      .digest('hex');

    const existingMessage = await this.prisma.message.findFirst({
      where: {
        authorId: userId,
        clientRequestId: msg.clientRequestId,
      },
      select: {
        requestHash: true,
      },
    });

    if (existingMessage) {
      if (existingMessage.requestHash !== requestHash) {
        throw new ConflictException(
          'Request ID was already used for another message',
        );
      }

      return existingMessage;
    }

    const newMessage = await this.prisma.message.create({
      data: {
        conversationId,
        authorId: userId,
        content: msg.content,
        clientRequestId: msg.clientRequestId,
        requestHash,
      },
    });

    return newMessage;
  }
}
