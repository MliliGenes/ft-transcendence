import type { Request as ExpressRequest } from 'express';
import { GroupsService } from './groups.service.js';
import { CreateGroupDto } from './dtos/create-group.dto.js';
import { UpdateGroupDto } from './dtos/update-group.dto.js';
import { CreateChannelDto } from './dtos/create-channel.dto.js';
import { UpdateChannelDto } from './dtos/update-channel.dto.js';
import { AddGroupMemberDto } from './dtos/add-group-member.dto.js';
import { UpdateGroupMemberRoleDto } from './dtos/update-group-member-role.dto.js';
type AuthenticatedRequest = ExpressRequest & {
    user: {
        sub: string;
    };
};
export declare class GroupsController {
    private readonly groupsService;
    constructor(groupsService: GroupsService);
    createGroup(body: CreateGroupDto, req: AuthenticatedRequest): Promise<{
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
    getGroups(req: AuthenticatedRequest): import("../../generated/prisma/internal/prismaNamespace.js").PrismaPromise<{
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
    getGroup(groupId: string, req: AuthenticatedRequest): Promise<{
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
    updateGroup(groupId: string, body: UpdateGroupDto, req: AuthenticatedRequest): Promise<{
        id: string;
        name: string;
        description: string | null;
        rules: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteGroup(groupId: string, req: AuthenticatedRequest): Promise<void>;
    getMembers(groupId: string, req: AuthenticatedRequest): Promise<{
        role: import("../../generated/prisma/enums.js").GroupRole;
        joinedAt: Date;
        user: {
            id: string;
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
        };
    }[]>;
    addMember(groupId: string, body: AddGroupMemberDto, req: AuthenticatedRequest): Promise<{
        groupId: string;
        userId: string;
        role: import("../../generated/prisma/enums.js").GroupRole;
        joinedAt: Date;
    }>;
    updateMemberRole(groupId: string, userId: string, body: UpdateGroupMemberRoleDto, req: AuthenticatedRequest): Promise<{
        groupId: string;
        userId: string;
        role: import("../../generated/prisma/enums.js").GroupRole;
        joinedAt: Date;
    }>;
    leaveGroup(groupId: string, req: AuthenticatedRequest): Promise<void>;
    removeMember(groupId: string, userId: string, req: AuthenticatedRequest): Promise<void>;
    createChannel(groupId: string, body: CreateChannelDto, req: AuthenticatedRequest): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }>;
    getChannels(groupId: string, req: AuthenticatedRequest): Promise<{
        lastReadMessageId: string | null;
        unreadCount: number;
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }[]>;
    getChannel(groupId: string, channelId: string, req: AuthenticatedRequest): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }>;
    updateChannel(groupId: string, channelId: string, body: UpdateChannelDto, req: AuthenticatedRequest): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        groupId: string | null;
        topic: string | null;
    }>;
    deleteChannel(groupId: string, channelId: string, req: AuthenticatedRequest): Promise<void>;
}
export {};
