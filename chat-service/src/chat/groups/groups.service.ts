import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateGroupDto } from './dtos/create-group.dto.js';
import { UpdateGroupDto } from './dtos/update-group.dto.js';
import { CreateChannelDto } from './dtos/create-channel.dto.js';
import { UpdateChannelDto } from './dtos/update-channel.dto.js';
import { UserProfilesService } from '../user-profiles.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { FEED_GROUP_ID } from '../../feed/feed.constants.js';

type GroupDb = PrismaService | Prisma.TransactionClient;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userProfiles: UserProfilesService,
  ) {}

  async createGroup(body: CreateGroupDto, userId: string) {
    return this.prisma.group.create({
      data: {
        name: body.name,
        description: body.description,
        rules: body.rules,
        members: { create: { userId, role: 'ADMIN' } },
        channels: {
          create: { kind: 'CHANNEL', name: 'general' },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        rules: true,
        createdAt: true,
        updatedAt: true,
        channels: { select: { id: true, name: true, topic: true } },
      },
    });
  }

  getGroups(userId: string) {
    return this.prisma.group.findMany({
      // The global feed has its own page; keep it out of the chat sidebar.
      where: { id: { not: FEED_GROUP_ID }, members: { some: { userId } } },
      select: {
        id: true,
        name: true,
        description: true,
        members: { where: { userId }, select: { role: true } },
        channels: { select: { id: true, name: true, topic: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGroup(groupId: string, userId: string) {
    await this.requireMember(groupId, userId);
    return this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        rules: true,
        createdAt: true,
        updatedAt: true,
        channels: { select: { id: true, name: true, topic: true } },
      },
    });
  }

  async updateGroup(groupId: string, userId: string, body: UpdateGroupDto) {
    await this.requireAdmin(groupId, userId);
    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description,
        }),
        ...(body.rules !== undefined && { rules: body.rules }),
      },
    });
  }

  async deleteGroup(groupId: string, userId: string) {
    await this.requireAdmin(groupId, userId);
    await this.prisma.group.delete({ where: { id: groupId } });
  }

  async getMembers(groupId: string, userId: string) {
    await this.requireMember(groupId, userId);
    return this.prisma.groupMember.findMany({
      where: { groupId },
      select: {
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    });
  }

  async addMember(groupId: string, actorId: string, userId: string) {
    await this.requireAdmin(groupId, actorId);
    await this.userProfiles.ensureActiveUsers([userId]);
    try {
      return await this.prisma.groupMember.create({
        data: { groupId, userId, role: 'MEMBER' },
        select: { groupId: true, userId: true, role: true, joinedAt: true },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('User is already a group member');
      }
      throw error;
    }
  }

  async updateMemberRole(
    groupId: string,
    actorId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER',
  ) {
    await this.requireAdmin(groupId, actorId);
    return this.prisma.$transaction(
      async (tx) => {
        await this.requireMember(groupId, userId, tx);
        const target = await tx.groupMember.findUniqueOrThrow({
          where: { groupId_userId: { groupId, userId } },
          select: { role: true },
        });
        if (target.role === 'ADMIN' && role === 'MEMBER') {
          const adminCount = await tx.groupMember.count({
            where: { groupId, role: 'ADMIN' },
          });
          if (adminCount <= 1) {
            throw new ConflictException('A group must have at least one admin');
          }
        }
        return tx.groupMember.update({
          where: { groupId_userId: { groupId, userId } },
          data: { role },
          select: { groupId: true, userId: true, role: true, joinedAt: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async removeMember(groupId: string, actorId: string, userId: string) {
    if (groupId === FEED_GROUP_ID) {
      throw new ForbiddenException('Everyone belongs to the feed');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const actor = await this.requireMember(groupId, actorId, tx);
        const target = await this.requireMember(groupId, userId, tx);
        if (actorId !== userId && actor.role !== 'ADMIN') {
          throw new ForbiddenException('Only group admins can remove members');
        }
        if (target.role === 'ADMIN') {
          const adminCount = await tx.groupMember.count({
            where: { groupId, role: 'ADMIN' },
          });
          if (adminCount <= 1) {
            throw new ConflictException('A group must have at least one admin');
          }
        }
        await tx.groupMember.delete({
          where: { groupId_userId: { groupId, userId } },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async createChannel(groupId: string, userId: string, body: CreateChannelDto) {
    await this.requireAdmin(groupId, userId);
    return this.prisma.conversation.create({
      data: {
        kind: 'CHANNEL',
        groupId,
        name: body.name,
        topic: body.topic,
      },
      select: {
        id: true,
        groupId: true,
        name: true,
        topic: true,
        createdAt: true,
      },
    });
  }

  async getChannels(groupId: string, userId: string) {
    await this.requireMember(groupId, userId);
    const channels = await this.prisma.conversation.findMany({
      where: { groupId, kind: 'CHANNEL' },
      select: {
        id: true,
        groupId: true,
        name: true,
        topic: true,
        createdAt: true,
        readStates: {
          where: { userId },
          select: { lastReadMessageId: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const lastReadMessageIds = channels.flatMap(({ readStates }) =>
      readStates[0]?.lastReadMessageId ? [readStates[0].lastReadMessageId] : [],
    );
    const lastReadMessages = await this.prisma.message.findMany({
      where: { id: { in: lastReadMessageIds } },
      select: { id: true, conversationId: true, createdAt: true },
    });
    const lastReadByChannelId = new Map(
      lastReadMessages.map((message) => [message.conversationId, message]),
    );

    return Promise.all(
      channels.map(async ({ readStates, ...channel }) => {
        const lastReadMessageId = readStates[0]?.lastReadMessageId ?? null;
        const lastReadMessage = lastReadByChannelId.get(channel.id);
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: channel.id,
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
        return { ...channel, lastReadMessageId, unreadCount };
      }),
    );
  }

  async getChannel(groupId: string, channelId: string, userId: string) {
    await this.requireMember(groupId, userId);
    const channel = await this.prisma.conversation.findFirst({
      where: { id: channelId, groupId, kind: 'CHANNEL' },
      select: {
        id: true,
        groupId: true,
        name: true,
        topic: true,
        createdAt: true,
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async updateChannel(
    groupId: string,
    channelId: string,
    userId: string,
    body: UpdateChannelDto,
  ) {
    await this.requireAdmin(groupId, userId);
    const result = await this.prisma.conversation.updateMany({
      where: { id: channelId, groupId, kind: 'CHANNEL' },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.topic !== undefined && { topic: body.topic }),
      },
    });
    if (!result.count) throw new NotFoundException('Channel not found');
    return this.prisma.conversation.findUniqueOrThrow({
      where: { id: channelId },
      select: {
        id: true,
        groupId: true,
        name: true,
        topic: true,
        createdAt: true,
      },
    });
  }

  async deleteChannel(groupId: string, channelId: string, userId: string) {
    await this.requireAdmin(groupId, userId);
    const result = await this.prisma.conversation.deleteMany({
      where: { id: channelId, groupId, kind: 'CHANNEL' },
    });
    if (!result.count) throw new NotFoundException('Channel not found');
  }

  private async requireMember(
    groupId: string,
    userId: string,
    db: GroupDb = this.prisma,
  ) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Group not found');
    return membership;
  }

  private async requireAdmin(
    groupId: string,
    userId: string,
    db: GroupDb = this.prisma,
  ) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Group not found');
    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only group admins can perform this action');
    }
    return membership;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
