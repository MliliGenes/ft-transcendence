import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import { createHash } from 'crypto';
import { EditMessageDto } from './dtos/edit-message.dto.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { UserProfilesService } from './user-profiles.service.js';
import { MinioService } from '../minio/minio.service.js';
import { GameRoomsClient } from './game-rooms.client.js';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly userProfiles: UserProfilesService,
    private readonly minio: MinioService,
    private readonly gameRooms: GameRoomsClient,
  ) {}

  async createAttachmentUploadUrl(
    userId: string,
    conversationId: string,
    authorization: string,
    contentType: string,
  ) {
    await this.getAccessibleConversation(userId, conversationId, authorization);
    return this.minio.createUploadUrl(conversationId, userId, contentType);
  }

  async createAttachmentDownloadUrl(
    userId: string,
    conversationId: string,
    objectKey: string,
    authorization: string,
  ) {
    await this.assertAttachmentAccessible(
      userId,
      conversationId,
      objectKey,
      authorization,
    );
    return { url: await this.minio.createDownloadUrl(objectKey) };
  }

  async createAttachmentPreviewUrl(
    userId: string,
    conversationId: string,
    objectKey: string,
    authorization: string,
  ) {
    await this.assertAttachmentAccessible(
      userId,
      conversationId,
      objectKey,
      authorization,
    );
    const object = await this.minio.getObjectInfo(objectKey);
    const contentType = Object.entries(object.metaData ?? {}).find(
      ([key]) => key.toLowerCase() === 'content-type',
    )?.[1];
    const safeContentType =
      typeof contentType === 'string'
        ? contentType.split(';')[0].trim().toLowerCase()
        : '';
    return {
      contentType: safeContentType || 'application/octet-stream',
      previewUrl: safeContentType
        ? await this.minio.createInlineImageUrl(objectKey, safeContentType)
        : null,
    };
  }

  private async assertAttachmentAccessible(
    userId: string,
    conversationId: string,
    objectKey: string,
    authorization: string,
  ) {
    if (
      typeof objectKey !== 'string' ||
      objectKey.length > 200 ||
      !objectKey.startsWith('attachments/')
    ) {
      throw new BadRequestException('Invalid attachment reference');
    }
    await this.getAccessibleConversation(userId, conversationId, authorization);
    const message = await this.prisma.message.findFirst({
      where: {
        conversationId,
        deletedAt: null,
        attachments: { has: objectKey },
      },
      select: { id: true },
    });
    if (!message) throw new NotFoundException('Attachment not found');
  }

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
          {
            kind: 'CHANNEL',
            group: { is: { members: { some: { userId } } } },
          },
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
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    return messages;
  }

  async getReadStates(userId: string, conversationId: string) {
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
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const states = await this.prisma.conversationReadState.findMany({
      where: { conversationId },
      select: {
        userId: true,
        lastReadMessageId: true,
        updatedAt: true,
      },
    });
    const messageIds = states.flatMap(({ lastReadMessageId }) =>
      lastReadMessageId ? [lastReadMessageId] : [],
    );
    const messages = await this.prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, createdAt: true },
    });
    const readAtById = new Map(
      messages.map((message) => [message.id, message.createdAt.toISOString()]),
    );

    return states.map((state) => ({
      ...state,
      lastReadAt: state.lastReadMessageId
        ? (readAtById.get(state.lastReadMessageId) ?? null)
        : null,
    }));
  }

  async createOrGetDm(
    userId: string,
    otherUserId: string,
    authorization: string,
  ) {
    const [dmUserAId, dmUserBId] = [
      userId.toLowerCase(),
      otherUserId.toLowerCase(),
    ].sort();

    if (dmUserAId === dmUserBId) {
      throw new BadRequestException('Cannot create a DM with yourself.');
    }

    await this.userProfiles.ensureCanContact(
      otherUserId.toLowerCase(),
      authorization,
    );
    await this.userProfiles.ensureActiveUsers([otherUserId.toLowerCase()]);

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
      include: {
        dmUserA: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        dmUserB: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        readStates: {
          where: { userId },
          select: { lastReadMessageId: true },
        },
      },
    });

    const lastReadMessageIds = conversations.flatMap(({ readStates }) =>
      readStates[0]?.lastReadMessageId ? [readStates[0].lastReadMessageId] : [],
    );

    const lastReadMessages = await this.prisma.message.findMany({
      where: { id: { in: lastReadMessageIds } },
      select: { id: true, conversationId: true, createdAt: true },
    });

    const lastReadByConversationId = new Map(
      lastReadMessages.map((message) => [message.conversationId, message]),
    );

    return Promise.all(
      conversations.map(async ({ readStates, ...conversation }) => {
        const lastReadMessageId = readStates[0]?.lastReadMessageId ?? null;
        const lastReadMessage = lastReadByConversationId.get(conversation.id);

        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            authorId: { not: userId },
            deletedAt: null,
            ...(lastReadMessage
              ? {
                  OR: [
                    { createdAt: { gt: lastReadMessage.createdAt } },
                    {
                      createdAt: lastReadMessage.createdAt,
                      id: { gt: lastReadMessage.id },
                    },
                  ],
                }
              : {}),
          },
        });

        return { ...conversation, lastReadMessageId, unreadCount };
      }),
    );
  }

  async sendMessage(
    userId: string,
    msg: SendMessageDto,
    conversationId: string,
    authorization?: string,
  ) {
    const conversation = await this.getAccessibleConversation(
      userId,
      conversationId,
      authorization,
    );

    const attachments = msg.attachments ?? [];
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify([
          conversationId,
          msg.content,
          attachments,
          msg.gameChallenge?.roomCode ?? null,
        ]),
      )
      .digest('hex');

    const existingMessage = await this.prisma.message.findFirst({
      where: {
        authorId: userId,
        clientRequestId: msg.clientRequestId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (existingMessage) {
      if (existingMessage.requestHash !== requestHash) {
        throw new ConflictException(
          'Request ID was already used for another message',
        );
      }

      // The message and its challenge binding were written together, so a
      // replay has nothing to add: it must not recreate a missing binding
      // without checking the room again.
      return existingMessage;
    }

    await Promise.all(
      attachments.map((objectKey) =>
        this.minio.verifyUploadedAttachment(objectKey, conversationId, userId),
      ),
    );

    const roomCode = msg.gameChallenge?.roomCode;
    if (roomCode) {
      // The Game service owns the room and its membership, so it decides
      // whether this caller may announce this room here. Nothing is written
      // before that answer, so a refusal leaves no message and no link.
      await this.assertChallengeAuthorized(userId, roomCode, authorization);
    }

    const messageData = {
      conversationId,
      authorId: userId,
      content: msg.content,
      attachments,
      clientRequestId: msg.clientRequestId,
      requestHash,
    };

    // A challenge and its message are written together, so a failure never
    // leaves one of them behind. The binding is also checked inside the
    // transaction: a room code that another conversation owns is a conflict,
    // and this message is rolled back with it.
    const newMessage = roomCode
      ? await this.createChallengeMessage(messageData, roomCode, conversationId)
      : await this.prisma.message.create({
          data: messageData,
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });

    const recipientIds =
      conversation.kind === 'DM'
        ? [conversation.dmUserAId, conversation.dmUserBId].filter(
            (id): id is string => id !== null,
          )
        : (conversation.group?.members.map(
            ({ userId: memberId }) => memberId,
          ) ?? []);

    this.chatGateway.broadcastMessageCreated(recipientIds, newMessage);

    return newMessage;
  }

  /**
   * A Code Arena challenge may only be linked to a conversation when the
   * caller owns that room.
   */
  private async assertChallengeAuthorized(
    userId: string,
    roomCode: string,
    authorization?: string,
  ): Promise<void> {
    if (!authorization) {
      throw new ForbiddenException(
        'A Code Arena challenge needs an authenticated session',
      );
    }
    const allowed = await this.gameRooms.canAnnounce(
      roomCode,
      userId,
      authorization,
    );
    if (!allowed) {
      throw new ForbiddenException('You may not announce that Code Arena room');
    }
  }

  /**
   * Write the message and bind the room in one transaction. The first
   * conversation that binds a room code owns it; a second one is a conflict
   * and its message is rolled back with the binding.
   */
  private async createChallengeMessage(
    messageData: {
      conversationId: string;
      authorId: string;
      content: string;
      attachments: string[];
      clientRequestId: string;
      requestHash: string;
    },
    roomCode: string,
    conversationId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: messageData,
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });
        const link = await tx.gameChallenge.upsert({
          where: { roomCode },
          create: { roomCode, conversationId },
          update: {},
        });
        if (link.conversationId !== conversationId) {
          throw new ConflictException(
            'That Code Arena challenge is already linked to another conversation',
          );
        }
        return created;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Two conversations claimed the same room code at once: the loser must
      // not keep its message.
      const link = await this.prisma.gameChallenge.findUnique({
        where: { roomCode },
        select: { conversationId: true },
      });
      if (link && link.conversationId !== conversationId) {
        throw new ConflictException(
          'That Code Arena challenge is already linked to another conversation',
        );
      }
      throw error;
    }
  }

  private async getAccessibleConversation(
    userId: string,
    conversationId: string,
    authorization?: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          {
            kind: 'DM',
            OR: [{ dmUserAId: userId }, { dmUserBId: userId }],
          },
          {
            kind: 'CHANNEL',
            group: { is: { members: { some: { userId } } } },
          },
        ],
      },
      select: {
        id: true,
        kind: true,
        dmUserAId: true,
        dmUserBId: true,
        group: {
          select: { members: { select: { userId: true } } },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    if (conversation.kind === 'DM') {
      const otherUserId =
        conversation.dmUserAId === userId
          ? conversation.dmUserBId
          : conversation.dmUserAId;
      if (!otherUserId) throw new NotFoundException('Conversation not found');
      if (!authorization) throw new NotFoundException('Conversation not found');
      await this.userProfiles.ensureCanContact(otherUserId, authorization);
    }

    return conversation;
  }

  async editMessage(userId: string, messageId: string, body: EditMessageDto) {
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
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
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

  async markRead(userId: string, conversationId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true, createdAt: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
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

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversationReadState.upsert({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      update: { lastReadMessageId: messageId },
      create: { conversationId, userId, lastReadMessageId: messageId },
    });

    const recipientIds = conversation.group
      ? conversation.group.members.map(({ userId: memberId }) => memberId)
      : [conversation.dmUserAId, conversation.dmUserBId].filter(
          (id): id is string => id !== null,
        );
    const readAt = message.createdAt.toISOString();
    this.chatGateway.broadcastReadState(recipientIds, {
      conversationId,
      userId,
      messageId,
      readAt,
    });

    return { messageId, readAt };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
