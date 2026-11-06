import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
export declare class UserProfilesService {
    private readonly prisma;
    private readonly userServiceUrl;
    constructor(prisma: PrismaService, config: ConfigService);
    ensureActiveUsers(userIds: string[]): Promise<void>;
    ensureCanContact(otherUserId: string, authorization: string): Promise<void>;
    private fetchPublicUser;
    private isPublicUser;
}
