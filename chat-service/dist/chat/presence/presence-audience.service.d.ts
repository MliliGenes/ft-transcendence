import { PrismaService } from '../../prisma/prisma.service.js';
export declare class PresenceAudienceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getUserIds(userId: string): Promise<string[]>;
}
