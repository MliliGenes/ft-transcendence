import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../src/chat/chat.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ChatGateway } from '../src/chat/gateway/chat.gateway.js';
import { UserProfilesService } from '../src/chat/user-profiles.service.js';
import { MinioService } from '../src/minio/minio.service.js';
import { GameNotificationsService } from '../src/chat/game-notifications.service.js';
import { GameRoomsClient } from '../src/chat/game-rooms.client.js';

describe('ChatService.sendMessage channel delivery', () => {
  it('saves a channel message and emits it to the current group members', async () => {
    const authorId = '0a1b2c3d-1111-4111-8111-111111111111';
    const memberId = '0a1b2c3d-2222-4222-8222-222222222222';
    const message = {
      id: '0a1b2c3d-3333-4333-8333-333333333333',
      conversationId: '0a1b2c3d-4444-4444-8444-444444444444',
      authorId,
      content: 'Hello group',
    };
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: message.conversationId,
          kind: 'CHANNEL',
          dmUserAId: null,
          dmUserBId: null,
          group: { members: [{ userId: authorId }, { userId: memberId }] },
        }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(message),
      },
    } as unknown as PrismaService;
    const gateway = {
      broadcastMessageCreated: vi.fn(),
    } as unknown as ChatGateway;
    const service = new ChatService(
      prisma,
      gateway,
      {} as UserProfilesService,
      {} as MinioService,
      { linkChallenge: vi.fn() } as unknown as GameNotificationsService,
      { canAnnounce: vi.fn() } as unknown as GameRoomsClient,
    );

    const result = await service.sendMessage(
      authorId,
      {
        content: 'Hello group',
        clientRequestId: '0a1b2c3d-5555-4555-8555-555555555555',
      },
      message.conversationId,
    );

    expect(result).toBe(message);
    expect(gateway.broadcastMessageCreated).toHaveBeenCalledWith(
      [authorId, memberId],
      message,
    );
  });

  it('rejects a non-member without saving or emitting a channel message', async () => {
    const prisma = {
      conversation: { findFirst: vi.fn().mockResolvedValue(null) },
      message: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as PrismaService;
    const gateway = {
      broadcastMessageCreated: vi.fn(),
    } as unknown as ChatGateway;
    const service = new ChatService(
      prisma,
      gateway,
      {} as UserProfilesService,
      {} as MinioService,
      { linkChallenge: vi.fn() } as unknown as GameNotificationsService,
      { canAnnounce: vi.fn() } as unknown as GameRoomsClient,
    );

    await expect(
      service.sendMessage(
        '0a1b2c3d-1111-4111-8111-111111111111',
        {
          content: 'Unauthorized',
          clientRequestId: '0a1b2c3d-5555-4555-8555-555555555555',
        },
        '0a1b2c3d-4444-4444-8444-444444444444',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(gateway.broadcastMessageCreated).not.toHaveBeenCalled();
  });
});

describe('ChatService block enforcement', () => {
  it('refuses a direct message when either participant has blocked the other', async () => {
    const authorId = '0a1b2c3d-1111-4111-8111-111111111111';
    const blockedUserId = '0a1b2c3d-2222-4222-8222-222222222222';
    const conversationId = '0a1b2c3d-4444-4444-8444-444444444444';
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: conversationId,
          kind: 'DM',
          dmUserAId: authorId,
          dmUserBId: blockedUserId,
          group: null,
        }),
      },
      message: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as PrismaService;
    const gateway = {
      broadcastMessageCreated: vi.fn(),
    } as unknown as ChatGateway;
    const userProfiles = {
      ensureCanContact: vi.fn().mockRejectedValue(new ForbiddenException('You cannot contact this user')),
    } as unknown as UserProfilesService;
    const service = new ChatService(
      prisma,
      gateway,
      userProfiles,
      {} as MinioService,
      { linkChallenge: vi.fn() } as unknown as GameNotificationsService,
      { canAnnounce: vi.fn() } as unknown as GameRoomsClient,
    );

    await expect(service.sendMessage(
      authorId,
      {
        content: 'Blocked message',
        clientRequestId: '0a1b2c3d-5555-4555-8555-555555555555',
      },
      conversationId,
      'Bearer token',
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(gateway.broadcastMessageCreated).not.toHaveBeenCalled();
  });
});

describe('ChatService read receipts', () => {
  it('stores the read marker and broadcast it to every conversation participant', async () => {
    const readerId = '0a1b2c3d-1111-4111-8111-111111111111';
    const otherUserId = '0a1b2c3d-2222-4222-8222-222222222222';
    const conversationId = '0a1b2c3d-4444-4444-8444-444444444444';
    const messageId = '0a1b2c3d-3333-4333-8333-333333333333';
    const readAt = new Date('2026-11-10T04:00:00.000Z');
    const prisma = {
      message: {
        findFirst: vi.fn().mockResolvedValue({ id: messageId, createdAt: readAt }),
      },
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          dmUserAId: readerId,
          dmUserBId: otherUserId,
          group: null,
        }),
      },
      conversationReadState: { upsert: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const gateway = {
      broadcastReadState: vi.fn(),
    } as unknown as ChatGateway;
    const service = new ChatService(
      prisma,
      gateway,
      {} as UserProfilesService,
      {} as MinioService,
      { linkChallenge: vi.fn() } as unknown as GameNotificationsService,
      { canAnnounce: vi.fn() } as unknown as GameRoomsClient,
    );

    await expect(service.markRead(readerId, conversationId, messageId)).resolves.toEqual({
      messageId,
      readAt: readAt.toISOString(),
    });

    expect(prisma.conversationReadState.upsert).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId, userId: readerId } },
      update: { lastReadMessageId: messageId },
      create: { conversationId, userId: readerId, lastReadMessageId: messageId },
    });
    expect(gateway.broadcastReadState).toHaveBeenCalledWith(
      [readerId, otherUserId],
      {
        conversationId,
        userId: readerId,
        messageId,
        readAt: readAt.toISOString(),
      },
    );
  });

  it('returns each participant marker with the read message timestamp', async () => {
    const readerId = '0a1b2c3d-1111-4111-8111-111111111111';
    const conversationId = '0a1b2c3d-4444-4444-8444-444444444444';
    const messageId = '0a1b2c3d-3333-4333-8333-333333333333';
    const updatedAt = new Date('2026-11-10T04:01:00.000Z');
    const createdAt = new Date('2026-11-10T04:00:00.000Z');
    const prisma = {
      conversation: { findFirst: vi.fn().mockResolvedValue({ id: conversationId }) },
      conversationReadState: {
        findMany: vi.fn().mockResolvedValue([{ userId: readerId, lastReadMessageId: messageId, updatedAt }]),
      },
      message: {
        findMany: vi.fn().mockResolvedValue([{ id: messageId, createdAt }]),
      },
    } as unknown as PrismaService;
    const service = new ChatService(
      prisma,
      {} as ChatGateway,
      {} as UserProfilesService,
      {} as MinioService,
      { linkChallenge: vi.fn() } as unknown as GameNotificationsService,
      { canAnnounce: vi.fn() } as unknown as GameRoomsClient,
    );

    await expect(service.getReadStates(readerId, conversationId)).resolves.toEqual([
      {
        userId: readerId,
        lastReadMessageId: messageId,
        updatedAt,
        lastReadAt: createdAt.toISOString(),
      },
    ]);
  });
});
