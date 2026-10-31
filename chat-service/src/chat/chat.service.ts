import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import { createHash } from 'crypto';
import { EditMessageDto } from './dtos/edit-message.dto.js';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(
    userId: string,
    conversationId: string,
    _query: GetMessagesQueryDto,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { dmUserAId: userId },
          { dmUserBId: userId },
          { group: { is: { members: { some: { userId } } } } },
        ],
      },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: _query.limit + 1,
      ...(_query.before ? { cursor: { id: _query.before }, skip: 1 } : {}),
    });
    return messages;
  }

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

  async editMessage(
    userId: string,
    messageId: string,
    body: EditMessageDto,
  ) {
    const result = await this.prisma.message.updateMany({
      where: {
        id: messageId,
        authorId: userId,
        deletedAt: null,
      },
      data: {
        content: body.content,
        editedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
    });
  }

  async deleteMessage(userId: string, messageId: string) {
    const result = await this.prisma.message.updateMany({
      where: {
        id: messageId,
        authorId: userId,
        deletedAt: null,
      },
      data: {
        content: null,
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Message not found');
    }
  }

  async markRead(userId: string, conversationId: string, _messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: _messageId, conversationId },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ dmUserAId: userId }, { dmUserBId: userId }],
      },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversationReadState.upsert({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      update: { lastReadMessageId: _messageId },
      create: { conversationId, userId, lastReadMessageId: _messageId },
    });
  }
}
