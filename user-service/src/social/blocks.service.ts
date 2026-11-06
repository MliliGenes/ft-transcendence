import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  blockUser(_blockerId: string, _blockedId: string) {
    if (_blockerId === _blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const [first, second] = [_blockerId, _blockedId].sort();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${first} FOR UPDATE
        `;
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${second} FOR UPDATE
        `;

      const blockedUser = await tx.user.findUnique({
        where: { id: _blockedId },
        select: { id: true },
      });

      if (!blockedUser) {
        throw new NotFoundException('User not found');
      }

      const block = await tx.block.upsert({
        // Generated from @@unique([blockerId, blockedId]) in the Prisma schema.
        where: {
          blockerId_blockedId: { blockerId: _blockerId, blockedId: _blockedId },
        },
        create: { blockerId: _blockerId, blockedId: _blockedId },
        update: {},
      });

      await tx.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: _blockerId, addresseeId: _blockedId },
            { requesterId: _blockedId, addresseeId: _blockerId },
          ],
        },
      });

      return block;
    });
  }

  unblockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot unblock yourself');
    }
    return this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  async getBlocks(blockerId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId },
      select: {
        blocked: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bannerUrl: true,
          },
        },
      },
    });

    return blocks.map(({ blocked }) => blocked);
  }

  async isBlockedBetween(userId: string, otherUserId: string) {
    if (userId === otherUserId) return false;
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
      select: { id: true },
    });
    return Boolean(block);
  }
}
