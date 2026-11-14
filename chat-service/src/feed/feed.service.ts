import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SYSTEM_AUTHOR_ID } from '../chat/system-author.js';
import {
  FEED_CHANNEL_ID,
  FEED_CHANNEL_NAME,
  FEED_GROUP_ID,
  FEED_GROUP_NAME,
} from './feed.constants.js';

const BACKFILL_BATCH = 1000;

@Injectable()
export class FeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  private ready?: Promise<void>;

  /**
   * The user-event consumer can start before bootstrap finishes, so every entry
   * point waits for the feed rows to exist. A failure is not cached.
   */
  private ensureReady(): Promise<void> {
    this.ready ??= this.ensureFeed().catch((error: unknown) => {
      this.ready = undefined;
      throw error;
    });
    return this.ready;
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureReady();
      const added = await this.backfillMembers();
      this.logger.log(`Feed ready (${added} member(s) added)`);
    } catch (error) {
      // Chat keeps working without the feed; it is retried on the next boot
      // and lazily per user through ensureMember().
      this.logger.error(
        'Could not provision the feed group',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Idempotently creates the feed group and its single channel. */
  async ensureFeed(): Promise<void> {
    await this.prisma.group.upsert({
      where: { id: FEED_GROUP_ID },
      update: {},
      create: {
        id: FEED_GROUP_ID,
        name: FEED_GROUP_NAME,
        description: 'Everything everyone is sharing on Nook.',
      },
    });
    await this.prisma.conversation.upsert({
      where: { id: FEED_CHANNEL_ID },
      update: {},
      create: {
        id: FEED_CHANNEL_ID,
        kind: 'CHANNEL',
        groupId: FEED_GROUP_ID,
        name: FEED_CHANNEL_NAME,
      },
    });
  }

  /** Adds every active user who is not already in the feed. Safe to re-run. */
  async backfillMembers(): Promise<number> {
    let added = 0;
    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.chatUser.findMany({
        // The system account is not a person and never posts to the feed.
        where: {
          deletedAt: null,
          username: { not: null },
          id: { not: SYSTEM_AUTHOR_ID },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: BACKFILL_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (users.length === 0) break;
      const result = await this.prisma.groupMember.createMany({
        data: users.map((user) => ({
          groupId: FEED_GROUP_ID,
          userId: user.id,
          role: 'MEMBER' as const,
        })),
        skipDuplicates: true,
      });
      added += result.count;
      cursor = users[users.length - 1].id;
      if (users.length < BACKFILL_BATCH) break;
    }
    return added;
  }

  /** Joins one user to the feed. Idempotent; the user's ChatUser row must exist. */
  async ensureMember(userId: string): Promise<void> {
    await this.ensureReady();
    await this.prisma.groupMember.createMany({
      data: [{ groupId: FEED_GROUP_ID, userId, role: 'MEMBER' }],
      skipDuplicates: true,
    });
  }

  /**
   * One author's feed posts, newest first. Follows the message-history contract:
   * up to `limit + 1` rows, where the extra row tells the client there is more.
   * The viewer is joined first because attachment URLs require feed membership.
   */
  async getUserPosts(
    viewerId: string,
    authorId: string,
    query: { limit: number; before?: string },
  ) {
    await this.ensureMember(viewerId);
    return this.prisma.message.findMany({
      where: { conversationId: FEED_CHANNEL_ID, authorId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /** Makes sure the caller belongs to the feed and returns where to post. */
  async getFeedForUser(userId: string) {
    await this.ensureMember(userId);
    return { groupId: FEED_GROUP_ID, channelId: FEED_CHANNEL_ID };
  }
}
