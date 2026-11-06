import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateGroupDto } from './dtos/create-group.dto.js';
import { UpdateGroupDto } from './dtos/update-group.dto.js';
import { CreateChannelDto } from './dtos/create-channel.dto.js';
import { UpdateChannelDto } from './dtos/update-channel.dto.js';
import { UserProfilesService } from '../user-profiles.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
export declare class GroupsService {
    private readonly prisma;
    private readonly userProfiles;
    constructor(prisma: PrismaService, userProfiles: UserProfilesService);
    createGroup(body: CreateGroupDto, userId: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        rules: string | null;
        createdAt: Date;
        updatedAt: Date;
        channels: {
            id: string;
            name: string | null;
            topic: string | null;
        }[];
    }>;
    getGroups(userId: string): Prisma.PrismaPromise<{
        id: string;
        name: string;
        description: string | null;
        members: {
            role: import("../../generated/prisma/enums.js").GroupRole;
        }[];
        channels: {
            id: string;
            name: string | null;
            topic: string | null;
        }[];
    }[]>;
    getGroup(groupId: string, userId: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        rules: string | null;
        createdAt: Date;
        updatedAt: Date;
        channels: {
            id: string;
            name: string | null;
            topic: string | null;
        }[];
    }>;
    updateGroup(groupId: string, userId: string, body: UpdateGroupDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        rules: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteGroup(groupId: string, userId: string): Promise<void>;
    getMembers(groupId: string, userId: string): Promise<{
        role: import("../../generated/prisma/enums.js").GroupRole;
        joinedAt: Date;
        user: {
            id: string;
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
        };
    }[]>;
    addMember(groupId: string, actorId: string, userId: string): Promise<{
        groupId: string;
        userId: string;
        role: import("../../generated/prisma/enums.js").GroupRole;
        joinedAt: Date;
    }>;
    updateMemberRole(groupId: string, actorId: string, userId: string, role: 'ADMIN' | 'MEMBER'): Promise<{
        groupId: string;
        userId: string;
        role: import("../../generated/prisma/enums.js").GroupRole;
        joinedAt: Date;
    }>;
    removeMember(groupId: string, actorId: string, userId: string): Promise<void>;
    createChannel(groupId: string, userId: string, body: CreateChannelDto): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }>;
    getChannels(groupId: string, userId: string): Promise<{
        lastReadMessageId: string | null;
        unreadCount: number;
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }[]>;
    getChannel(groupId: string, channelId: string, userId: string): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }>;
    updateChannel(groupId: string, channelId: string, userId: string, body: UpdateChannelDto): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }>;
    deleteChannel(groupId: string, channelId: string, userId: string): Promise<void>;
    private requireMember;
    private requireAdmin;
    private isUniqueViolation;
}
