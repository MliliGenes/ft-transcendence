var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, ConflictException, Injectable, NotFoundException, } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { createHash } from 'crypto';
import { ChatGateway } from './gateway/chat.gateway.js';
import { UserProfilesService } from './user-profiles.service.js';
import { MinioService } from '../minio/minio.service.js';
let ChatService = class ChatService {
    prisma;
    chatGateway;
    userProfiles;
    minio;
    constructor(prisma, chatGateway, userProfiles, minio) {
        this.prisma = prisma;
        this.chatGateway = chatGateway;
        this.userProfiles = userProfiles;
        this.minio = minio;
    }
    async createAttachmentUploadUrl(userId, conversationId, authorization, contentType) {
        await this.getAccessibleConversation(userId, conversationId, authorization);
        return this.minio.createUploadUrl(conversationId, userId, contentType);
    }
    async createAttachmentDownloadUrl(userId, conversationId, objectKey, authorization) {
        await this.assertAttachmentAccessible(userId, conversationId, objectKey, authorization);
        return { url: await this.minio.createDownloadUrl(objectKey) };
    }
    async createAttachmentPreviewUrl(userId, conversationId, objectKey, authorization) {
        await this.assertAttachmentAccessible(userId, conversationId, objectKey, authorization);
        const object = await this.minio.getObjectInfo(objectKey);
        const contentType = Object.entries(object.metaData ?? {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
        const safeContentType = typeof contentType === 'string' ? contentType.split(';')[0].trim().toLowerCase() : '';
        return {
            contentType: safeContentType || 'application/octet-stream',
            previewUrl: safeContentType
                ? await this.minio.createInlineImageUrl(objectKey, safeContentType)
                : null,
        };
    }
    async assertAttachmentAccessible(userId, conversationId, objectKey, authorization) {
        if (typeof objectKey !== 'string' ||
            objectKey.length > 200 ||
            !objectKey.startsWith('attachments/')) {
            throw new BadRequestException('Invalid attachment reference');
        }
        await this.getAccessibleConversation(userId, conversationId, authorization);
        const message = await this.prisma.message.findFirst({
            where: { conversationId, deletedAt: null, attachments: { has: objectKey } },
            select: { id: true },
        });
        if (!message)
            throw new NotFoundException('Attachment not found');
    }
    async getMessages(userId, conversationId, _query) {
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
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
            },
        });
        return messages;
    }
    async createOrGetDm(userId, otherUserId, authorization) {
        if (userId === otherUserId) {
            throw new Error('Cannot create a DM with yourself.');
        }
        const [dmUserAId, dmUserBId] = [
            userId.toLowerCase(),
            otherUserId.toLowerCase(),
        ].sort();
        await this.userProfiles.ensureCanContact(otherUserId, authorization);
        await this.userProfiles.ensureActiveUsers([otherUserId]);
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
    async getConversations(userId) {
        const conversations = await this.prisma.conversation.findMany({
            where: {
                OR: [{ dmUserAId: userId }, { dmUserBId: userId }],
            },
            include: {
                dmUserA: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
                dmUserB: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
                readStates: {
                    where: { userId },
                    select: { lastReadMessageId: true },
                },
            },
        });
        const lastReadMessageIds = conversations.flatMap(({ readStates }) => readStates[0]?.lastReadMessageId
            ? [readStates[0].lastReadMessageId]
            : []);
        const lastReadMessages = await this.prisma.message.findMany({
            where: { id: { in: lastReadMessageIds } },
            select: { id: true, conversationId: true, createdAt: true },
        });
        const lastReadByConversationId = new Map(lastReadMessages.map((message) => [message.conversationId, message]));
        return Promise.all(conversations.map(async ({ readStates, ...conversation }) => {
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
        }));
    }
    async sendMessage(userId, msg, conversationId, authorization) {
        const conversation = await this.getAccessibleConversation(userId, conversationId, authorization);
        const attachments = msg.attachments ?? [];
        const requestHash = createHash('sha256')
            .update(JSON.stringify([conversationId, msg.content, attachments]))
            .digest('hex');
        const existingMessage = await this.prisma.message.findFirst({
            where: {
                authorId: userId,
                clientRequestId: msg.clientRequestId,
            },
            include: {
                author: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
            },
        });
        if (existingMessage) {
            if (existingMessage.requestHash !== requestHash) {
                throw new ConflictException('Request ID was already used for another message');
            }
            return existingMessage;
        }
        await Promise.all(attachments.map((objectKey) => this.minio.verifyUploadedAttachment(objectKey, conversationId, userId)));
        const newMessage = await this.prisma.message.create({
            data: {
                conversationId,
                authorId: userId,
                content: msg.content,
                attachments,
                clientRequestId: msg.clientRequestId,
                requestHash,
            },
            include: {
                author: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
            },
        });
        const recipientIds = conversation.kind === 'DM'
            ? [conversation.dmUserAId, conversation.dmUserBId].filter((id) => id !== null)
            : (conversation.group?.members.map(({ userId: memberId }) => memberId) ?? []);
        this.chatGateway.broadcastMessageCreated(recipientIds, newMessage);
        return newMessage;
    }
    async getAccessibleConversation(userId, conversationId, authorization) {
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
        if (!conversation)
            throw new NotFoundException('Conversation not found');
        if (conversation.kind === 'DM') {
            const otherUserId = conversation.dmUserAId === userId
                ? conversation.dmUserBId
                : conversation.dmUserAId;
            if (!otherUserId)
                throw new NotFoundException('Conversation not found');
            if (!authorization)
                throw new NotFoundException('Conversation not found');
            await this.userProfiles.ensureCanContact(otherUserId, authorization);
        }
        return conversation;
    }
    async editMessage(userId, messageId, body) {
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
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
            },
        });
    }
    async deleteMessage(userId, messageId) {
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
    async markRead(userId, conversationId, _messageId) {
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
        await this.prisma.conversationReadState.upsert({
            where: {
                conversationId_userId: { conversationId, userId },
            },
            update: { lastReadMessageId: _messageId },
            create: { conversationId, userId, lastReadMessageId: _messageId },
        });
    }
};
ChatService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        ChatGateway,
        UserProfilesService,
        MinioService])
], ChatService);
export { ChatService };
//# sourceMappingURL=chat.service.js.map