import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

type PublicUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

@Injectable()
export class UserProfilesService {
  private readonly userServiceUrl: URL;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.userServiceUrl = new URL(
      config.getOrThrow<string>('USER_SERVICE_URL'),
    );
  }

  async ensureActiveUsers(userIds: string[]) {
    const ids = [...new Set(userIds.map((id) => id.toLowerCase()))];
    const existing = await this.prisma.chatUser.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map(({ id }) => id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    if (missingIds.length) {
      const users = await Promise.all(
        missingIds.map((id) => this.fetchPublicUser(id)),
      );
      await this.prisma.chatUser.createMany({
        data: users.map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          // Public profiles do not expose updatedAt. createdAt is a lower bound,
          // allowing any later versioned RabbitMQ update to replace this snapshot.
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

  async ensureCanContact(otherUserId: string, authorization: string) {
    const url = new URL(
      `/social/blocks/check/${encodeURIComponent(otherUserId)}`,
      this.userServiceUrl,
    );
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { authorization },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new ServiceUnavailableException('User service is unavailable');
    }
    if (!response.ok)
      throw new ServiceUnavailableException('User service is unavailable');

    const result: unknown = await response.json().catch(() => null);
    if (
      !result ||
      typeof result !== 'object' ||
      typeof (result as { blocked?: unknown }).blocked !== 'boolean'
    ) {
      throw new ServiceUnavailableException(
        'User service returned invalid data',
      );
    }
    if ((result as { blocked: boolean }).blocked)
      throw new ForbiddenException('You cannot contact this user');
  }

  private async fetchPublicUser(userId: string): Promise<PublicUser> {
    const url = new URL(
      `/accounts/${encodeURIComponent(userId)}`,
      this.userServiceUrl,
    );
    let response: Response;

    try {
      response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    } catch {
      throw new ServiceUnavailableException('User service is unavailable');
    }

    if (response.status === 404) throw new NotFoundException('User not found');
    if (!response.ok)
      throw new ServiceUnavailableException('User service is unavailable');

    const value: unknown = await response.json().catch(() => null);
    if (!this.isPublicUser(value, userId))
      throw new ServiceUnavailableException(
        'User service returned invalid data',
      );
    return value;
  }

  private isPublicUser(
    value: unknown,
    expectedId: string,
  ): value is PublicUser {
    if (!value || typeof value !== 'object') return false;
    const user = value as Record<string, unknown>;
    return (
      user.id === expectedId &&
      typeof user.username === 'string' &&
      (user.displayName === null || typeof user.displayName === 'string') &&
      (user.avatarUrl === null || typeof user.avatarUrl === 'string') &&
      typeof user.createdAt === 'string' &&
      !Number.isNaN(Date.parse(user.createdAt))
    );
  }
}
