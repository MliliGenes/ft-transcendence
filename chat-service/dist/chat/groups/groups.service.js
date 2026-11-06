var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, ForbiddenException, Injectable, NotFoundException, } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserProfilesService } from '../user-profiles.service.js';
let GroupsService = class GroupsService {
    prisma;
    userProfiles;
    constructor(prisma, userProfiles) {
        this.prisma = prisma;
        this.userProfiles = userProfiles;
    }
    async createGroup(body, userId) {
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
    getGroups(userId) {
        return this.prisma.group.findMany({
            where: { members: { some: { userId } } },
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
    async getGroup(groupId, userId) {
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
    async updateGroup(groupId, userId, body) {
        await this.requireAdmin(groupId, userId);
        return this.prisma.group.update({
            where: { id: groupId },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.rules !== undefined && { rules: body.rules }),
            },
        });
    }
    async deleteGroup(groupId, userId) {
        await this.requireAdmin(groupId, userId);
        await this.prisma.group.delete({ where: { id: groupId } });
    }
    async getMembers(groupId, userId) {
        await this.requireMember(groupId, userId);
        return this.prisma.groupMember.findMany({
            where: { groupId },
            select: {
                role: true,
                joinedAt: true,
                user: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
            },
            orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        });
    }
    async addMember(groupId, actorId, userId) {
        await this.requireAdmin(groupId, actorId);
        await this.userProfiles.ensureActiveUsers([userId]);
        try {
            return await this.prisma.groupMember.create({
                data: { groupId, userId, role: 'MEMBER' },
                select: { groupId: true, userId: true, role: true, joinedAt: true },
            });
        }
        catch (error) {
            if (this.isUniqueViolation(error)) {
                throw new ConflictException('User is already a group member');
            }
            throw error;
        }
    }
    async updateMemberRole(groupId, actorId, userId, role) {
        await this.requireAdmin(groupId, actorId);
        return this.prisma.$transaction(async (tx) => {
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
        }, { isolationLevel: 'Serializable' });
    }
    async removeMember(groupId, actorId, userId) {
        return this.prisma.$transaction(async (tx) => {
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
        }, { isolationLevel: 'Serializable' });
    }
    async createChannel(groupId, userId, body) {
        await this.requireAdmin(groupId, userId);
        return this.prisma.conversation.create({
            data: {
                kind: 'CHANNEL',
                groupId,
                name: body.name,
                topic: body.topic,
            },
            select: { id: true, groupId: true, name: true, topic: true, createdAt: true },
        });
    }
    async getChannels(groupId, userId) {
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
        const lastReadMessageIds = channels.flatMap(({ readStates }) => readStates[0]?.lastReadMessageId ? [readStates[0].lastReadMessageId] : []);
        const lastReadMessages = await this.prisma.message.findMany({
            where: { id: { in: lastReadMessageIds } },
            select: { id: true, conversationId: true, createdAt: true },
        });
        const lastReadByChannelId = new Map(lastReadMessages.map((message) => [message.conversationId, message]));
        return Promise.all(channels.map(async ({ readStates, ...channel }) => {
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
        }));
    }
    async getChannel(groupId, channelId, userId) {
        await this.requireMember(groupId, userId);
        const channel = await this.prisma.conversation.findFirst({
            where: { id: channelId, groupId, kind: 'CHANNEL' },
            select: { id: true, groupId: true, name: true, topic: true, createdAt: true },
        });
        if (!channel)
            throw new NotFoundException('Channel not found');
        return channel;
    }
    async updateChannel(groupId, channelId, userId, body) {
        await this.requireAdmin(groupId, userId);
        const result = await this.prisma.conversation.updateMany({
            where: { id: channelId, groupId, kind: 'CHANNEL' },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.topic !== undefined && { topic: body.topic }),
            },
        });
        if (!result.count)
            throw new NotFoundException('Channel not found');
        return this.prisma.conversation.findUniqueOrThrow({
            where: { id: channelId },
            select: { id: true, groupId: true, name: true, topic: true, createdAt: true },
        });
    }
    async deleteChannel(groupId, channelId, userId) {
        await this.requireAdmin(groupId, userId);
        const result = await this.prisma.conversation.deleteMany({
            where: { id: channelId, groupId, kind: 'CHANNEL' },
        });
        if (!result.count)
            throw new NotFoundException('Channel not found');
    }
    async requireMember(groupId, userId, db = this.prisma) {
        const membership = await db.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
            select: { role: true },
        });
        if (!membership)
            throw new NotFoundException('Group not found');
        return membership;
    }
    async requireAdmin(groupId, userId, db = this.prisma) {
        const membership = await db.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
            select: { role: true },
        });
        if (!membership)
            throw new NotFoundException('Group not found');
        if (membership.role !== 'ADMIN') {
            throw new ForbiddenException('Only group admins can perform this action');
        }
        return membership;
    }
    isUniqueViolation(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002');
    }
};
GroupsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        UserProfilesService])
], GroupsService);
export { GroupsService };
//# sourceMappingURL=groups.service.js.map