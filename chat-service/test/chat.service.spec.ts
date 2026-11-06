import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../src/chat/chat.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ChatGateway } from '../src/chat/gateway/chat.gateway.js';
import { UserProfilesService } from '../src/chat/user-profiles.service.js';

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
