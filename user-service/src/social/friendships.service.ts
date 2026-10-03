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
  status: true,
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

    return friendships.map((friendship) =>
      friendship.requesterId === userId
        ? friendship.addressee
        : friendship.requester,
    );
  }

  async createFriendship(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new BadRequestException(
        'You cannot send a friendship request to yourself',
      );
    }

    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          {
            requesterId: requesterId,
            addresseeId: addresseeId,
          },
          {
            requesterId: addresseeId,
            addresseeId: requesterId,
          },
        ],
      },
      select: {
        id: true,
        requesterId: true,
        addresseeId: true,
        status: true,
      },
    });

    if (existingFriendship) {
      if (
        existingFriendship.requesterId === addresseeId &&
        existingFriendship.addresseeId === requesterId &&
        existingFriendship.status === 'PENDING'
      ) {
        return this.prisma.friendship.update({
          where: { id: existingFriendship.id },
          data: { status: 'ACCEPTED' },
          select: friendshipSelect,
        });
      }

      throw new ConflictException(
        existingFriendship.status === 'DECLINED'
          ? 'This friendship request was declined'
          : 'A friendship already exists between these users',
      );
    }

    return this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId,
        status: 'PENDING',
      },
      select: friendshipSelect,
    });
  }

  async acceptFriendship(friendshipId: string, userId: string) {
    const friendship = await this.requireFriendshipParticipant(
      friendshipId,
      userId,
    );
    return this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'ACCEPTED' },
      select: friendshipSelect,
    });
  }

  async rejectFriendship(friendshipId: string, userId: string) {
    const friendship = await this.requireFriendshipParticipant(
      friendshipId,
      userId,
    );
    return this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'DECLINED' },
      select: friendshipSelect,
    });
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
