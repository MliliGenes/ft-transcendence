var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
let PresenceAudienceService = class PresenceAudienceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUserIds(userId) {
        const [dms, groupMembers] = await Promise.all([
            this.prisma.conversation.findMany({
                where: {
                    kind: 'DM',
                    OR: [{ dmUserAId: userId }, { dmUserBId: userId }],
                },
                select: { dmUserAId: true, dmUserBId: true },
            }),
            this.prisma.groupMember.findMany({
                where: {
                    userId: { not: userId },
                    group: { is: { members: { some: { userId } } } },
                },
                select: { userId: true },
            }),
        ]);
        return [
            ...new Set([
                ...dms.flatMap(({ dmUserAId, dmUserBId }) => [dmUserAId, dmUserBId]),
                ...groupMembers.map(({ userId: memberId }) => memberId),
            ].filter((id) => id !== null && id !== userId)),
        ];
    }
};
PresenceAudienceService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], PresenceAudienceService);
export { PresenceAudienceService };
//# sourceMappingURL=presence-audience.service.js.map