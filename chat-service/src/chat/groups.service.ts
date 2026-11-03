import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateGroupDto } from './dtos/create-group.dto.js';
import { group } from 'console';
import { UserProfilesService } from './user-profiles.service.js';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userProfilesService: UserProfilesService,
  ) {}

  async createGroup(createGroupDto: CreateGroupDto, userId: string) {
    await this.userProfilesService.ensureActiveUsers([userId]);

    const group = await this.prisma.group.create({
      data: {
        name: createGroupDto.name,
        description: createGroupDto.description,
        rules: createGroupDto.rules,
        members: {
          create: {
            userId: userId,
            role: 'ADMIN',
          },
        },
      },
    });

    return group;
  }

  async getGroup(groupId: string, userId: string) {
    await this.userProfilesService.ensureActiveUsers([userId]);

    const group = await this.prisma.group.findUnique({
      where: {
        id: groupId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!group) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return group;
  }

  async getGroups(userId: string) {
    await this.userProfilesService.ensureActiveUsers([userId]);

    const groups = await this.prisma.group.findMany({
      where: {
        members: { some: { userId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    return groups;
  }

  async updateGroup(groupId: string, userId: string, updateGroupDto: any) {
    await this.userProfilesService.ensureActiveUsers([userId]);

    const group = await this.prisma.group.findUnique({
      where: {
        id: groupId,
        members: {
          some: {
            userId: userId,
            role: 'ADMIN',
          },
        },
      },
    });

    if (!group) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const updatedGroup = await this.prisma.group.update({
      where: {
        id: groupId,
      },
      data: {
        name: updateGroupDto.name,
        description: updateGroupDto.description,
        rules: updateGroupDto.rules,
      },
    });

    return updatedGroup;
  }

  async deleteGroup(groupId: string, userId: string) {
    await this.userProfilesService.ensureActiveUsers([userId]);

    const group = await this.prisma.group.findUnique({
      where: {
        id: groupId,
        members: {
          some: {
            userId: userId,
            role: 'ADMIN',
          },
        },
      },
    });

    if (!group) {
      throw new ForbiddenException('You are not a member of this group');
    }

    await this.prisma.group.delete({
      where: {
        id: groupId,
      },
    });

    return { message: 'Group deleted successfully' };
  }
}
