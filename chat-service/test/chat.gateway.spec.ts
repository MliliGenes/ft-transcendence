import type { JwtService } from '@nestjs/jwt';
import type { Namespace, Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { ChatGateway } from '../src/chat/gateway/chat.gateway.js';
import type { PresenceAudienceService } from '../src/chat/presence/presence-audience.service.js';
import type { PresenceService } from '../src/chat/presence/presence.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const conversationId = '0a1b2c3d-4444-4444-8444-444444444444';
const alice = '0a1b2c3d-1111-4111-8111-111111111111';
const bob = '0a1b2c3d-2222-4222-8222-222222222222';

function gatewayWith(prisma: PrismaService, emit = vi.fn()) {
  const gateway = new ChatGateway(
    {} as JwtService,
    {} as PresenceService,
    {} as PresenceAudienceService,
    prisma,
  );
  gateway.namespace = {
    to: vi.fn().mockReturnValue({ emit }),
  } as unknown as Namespace;
  return { gateway, emit };
}

describe('ChatGateway typing indicators', () => {
  it('broadcasts typing only to the other direct-message participant', async () => {
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          dmUserAId: alice,
          dmUserBId: bob,
          group: null,
        }),
      },
    } as unknown as PrismaService;
    const { gateway, emit } = gatewayWith(prisma);
    const socket = { data: { userId: alice } } as unknown as Socket;

    await expect(gateway.onTypingChanged(socket, { conversationId, typing: true }))
      .resolves.toEqual({ ok: true });

    expect(gateway.namespace.to).toHaveBeenCalledWith([`user:${bob}`]);
    expect(emit).toHaveBeenCalledWith('typing:changed', {
      conversationId,
      userId: alice,
      typing: true,
    });
  });

  it('rejects typing for a conversation the socket user cannot access', async () => {
    const prisma = {
      conversation: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { gateway, emit } = gatewayWith(prisma);
    const socket = { data: { userId: alice } } as unknown as Socket;

    await expect(gateway.onTypingChanged(socket, { conversationId, typing: true }))
      .resolves.toEqual({ ok: false });

    expect(gateway.namespace.to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects malformed typing payloads before querying the database', async () => {
    const prisma = { conversation: { findFirst: vi.fn() } } as unknown as PrismaService;
    const { gateway } = gatewayWith(prisma);

    await expect(gateway.onTypingChanged({ data: { userId: alice } } as unknown as Socket, {
      conversationId: 'not-a-uuid',
      typing: true,
    })).resolves.toEqual({ ok: false });

    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });
});

describe('ChatGateway read receipts', () => {
  it('emits read state updates to every participant room', () => {
    const { gateway, emit } = gatewayWith({} as PrismaService);
    gateway.broadcastReadState([alice, bob], {
      conversationId,
      userId: alice,
      messageId: '0a1b2c3d-3333-4333-8333-333333333333',
      readAt: '2026-11-10T04:00:00.000Z',
    });

    expect(gateway.namespace.to).toHaveBeenCalledWith([`user:${alice}`, `user:${bob}`]);
    expect(emit).toHaveBeenCalledWith('read:updated', expect.objectContaining({ conversationId, userId: alice }));
  });
});
