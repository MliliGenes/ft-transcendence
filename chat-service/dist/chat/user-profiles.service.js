var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
let UserProfilesService = class UserProfilesService {
    prisma;
    userServiceUrl;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.userServiceUrl = new URL(config.getOrThrow('USER_SERVICE_URL'));
    }
    async ensureActiveUsers(userIds) {
        const ids = [...new Set(userIds.map((id) => id.toLowerCase()))];
        const existing = await this.prisma.chatUser.findMany({
            where: { id: { in: ids } },
            select: { id: true },
        });
        const existingIds = new Set(existing.map(({ id }) => id));
        const missingIds = ids.filter((id) => !existingIds.has(id));
        if (missingIds.length) {
            const users = await Promise.all(missingIds.map((id) => this.fetchPublicUser(id)));
            await this.prisma.chatUser.createMany({
                data: users.map((user) => ({
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    sourceUpdatedAt: new Date(user.createdAt),
                })),
                skipDuplicates: true,
            });
        }
        const activeUsers = await this.prisma.chatUser.count({
            where: { id: { in: ids }, deletedAt: null },
        });
        if (activeUsers !== ids.length)
            throw new NotFoundException('User not found');
    }
    async ensureCanContact(otherUserId, authorization) {
        const url = new URL(`/social/blocks/check/${encodeURIComponent(otherUserId)}`, this.userServiceUrl);
        let response;
        try {
            response = await fetch(url, {
                headers: { authorization },
                signal: AbortSignal.timeout(3000),
            });
        }
        catch {
            throw new ServiceUnavailableException('User service is unavailable');
        }
        if (!response.ok)
            throw new ServiceUnavailableException('User service is unavailable');
        const result = await response.json().catch(() => null);
        if (!result ||
            typeof result !== 'object' ||
            typeof result.blocked !== 'boolean') {
            throw new ServiceUnavailableException('User service returned invalid data');
        }
        if (result.blocked)
            throw new ForbiddenException('You cannot contact this user');
    }
    async fetchPublicUser(userId) {
        const url = new URL(`/accounts/${encodeURIComponent(userId)}`, this.userServiceUrl);
        let response;
        try {
            response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        }
        catch {
            throw new ServiceUnavailableException('User service is unavailable');
        }
        if (response.status === 404)
            throw new NotFoundException('User not found');
        if (!response.ok)
            throw new ServiceUnavailableException('User service is unavailable');
        const value = await response.json().catch(() => null);
        if (!this.isPublicUser(value, userId))
            throw new ServiceUnavailableException('User service returned invalid data');
        return value;
    }
    isPublicUser(value, expectedId) {
        if (!value || typeof value !== 'object')
            return false;
        const user = value;
        return (user.id === expectedId &&
            typeof user.username === 'string' &&
            (user.displayName === null || typeof user.displayName === 'string') &&
            (user.avatarUrl === null || typeof user.avatarUrl === 'string') &&
            typeof user.createdAt === 'string' &&
            !Number.isNaN(Date.parse(user.createdAt)));
    }
};
UserProfilesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        ConfigService])
], UserProfilesService);
export { UserProfilesService };
//# sourceMappingURL=user-profiles.service.js.map