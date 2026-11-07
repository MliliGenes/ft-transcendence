import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/browser.js';

const friendUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bannerUrl: true,
} satisfies Prisma.UserSelect;

const friendshipSelect = {
  id: true,
  requesterId: true,
  addresseeId: true,
  status: true,
  createdAt: true,
  requester: {
    select: friendUserSelect,
  },
  addressee: {
    select: friendUserSelect,
  },
} satisfies Prisma.FriendshipSelect;

@Injectable()
export class FriendshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFriendships(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: friendshipSelect,
    });

    return friendships.map((friendship) => ({
      ...(friendship.requesterId === userId
        ? friendship.addressee
        : friendship.requester),
      friendshipId: friendship.id,
    }));
  }

  async createFriendship(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new BadRequestException(
        'You cannot send a friendship request to yourself',
      );
    }

    return this.withUserPairLock(requesterId, addresseeId, async (tx) => {
      const existingBlock = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: requesterId, blockedId: addresseeId },
            { blockerId: addresseeId, blockedId: requesterId },
          ],
        },
        select: { id: true },
      });

      if (existingBlock) {
        throw new ForbiddenException(
          'You cannot send a friendship request to a blocked user',
        );
      }

      const addressee = await tx.user.findUnique({
        where: { id: addresseeId },
        select: { id: true },
      });
      if (!addressee) {
        throw new NotFoundException('User not found');
      }

      const existingFriendship = await tx.friendship.findFirst({
        where: {
          OR: [
            { requesterId, addresseeId },
            { requesterId: addresseeId, addresseeId: requesterId },
          ],
        },
        select: { id: true, status: true },
      });

      if (existingFriendship) {
        // TODO: conflict should only happen when the status is still pending of theere is already a firnedship
        if (existingFriendship.status === 'DECLINED') {
          return tx.friendship.update({
            where: { id: existingFriendship.id },
            data: { status: 'PENDING' },
          });
        }
        if (existingFriendship.status === 'ACCEPTED')
          throw new ConflictException('A friendship already exists between these users');
        if (existingFriendship.status === 'PENDING')
          throw new ConflictException('A request is still pending')
      }

      return tx.friendship.create({
        data: { requesterId, addresseeId, status: 'PENDING' },
        select: friendshipSelect,
      });
    });
  }

  async acceptFriendship(friendshipId: string, userId: string) {
    const friendship = await this.requireFriendshipParticipant(
      friendshipId,
      userId,
    );
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException(
        'Only the addressee can accept a friendship request',
      );
    }

    return this.respondToFriendship(friendship.id, userId, 'ACCEPTED');
  }

  async rejectFriendship(friendshipId: string, userId: string) {
    const friendship = await this.requireFriendshipParticipant(
      friendshipId,
      userId,
    );
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException(
        'Only the addressee can reject a friendship request',
      );
    }
    return this.respondToFriendship(friendship.id, userId, 'DECLINED');
  }

  async deleteFriendship(friendshipId: string, userId: string) {
    const friendship = await this.requireFriendshipParticipant(
      friendshipId,
      userId,
    );
    return this.prisma.friendship.delete({
      where: { id: friendship.id },
      select: friendshipSelect,
    });
  }

  async getSentFriendships(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        requesterId: userId,
        status: 'PENDING',
      },
      select: friendshipSelect,
    });
  }

  async getFriendshipRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: 'PENDING',
      },
      select: friendshipSelect,
    });
  }

  private async withUserPairLock<T>(
    firstUserId: string,
    secondUserId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const [first, second] = [firstUserId, secondUserId].sort();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${first} FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${second} FOR UPDATE
      `;

      return work(tx);
    });
  }

  private async respondToFriendship(
    friendshipId: string,
    userId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ) {
    const result = await this.prisma.friendship.updateMany({
      where: {
        id: friendshipId,
        addresseeId: userId,
        status: 'PENDING',
      },
      data: { status },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'No pending friendship request for you with this ID',
      );
    }

    return this.prisma.friendship.findUniqueOrThrow({
      where: { id: friendshipId },
      select: friendshipSelect,
    });
  }

  private async requireFriendshipParticipant(
    friendshipId: string,
    userId: string,
  ) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
      select: {
        id: true,
        requesterId: true,
        addresseeId: true,
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    if (
      friendship.requesterId !== userId &&
      friendship.addresseeId !== userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to modify this friendship',
      );
    }

    return friendship;
  }
}
