import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PresenceAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserIds(userId: string): Promise<string[]> {
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
      ].filter((id): id is string => id !== null && id !== userId)),
    ];
  }
}
