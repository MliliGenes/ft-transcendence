import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { lockGroup } from '../database/group-lock.js';
import type { Prisma, Conversation } from '../generated/prisma/client.js';
import { UserProjectionService } from '../users/user-projection.service.js';
import { UserServiceClient } from '../users/user-service.client.js';
import { nextCursor, type Page } from './pagination.js';

const publicUser = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  deletedAt: true,
} as const;
const messageFields = {
  id: true,
  conversationId: true,
  authorId: true,
  content: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  clientRequestId: true,
  version: true,
} as const;
const conversationFields = {
  id: true,
  kind: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  groupId: true,
  name: true,
  topic: true,
  dmUserA: { select: publicUser },
  dmUserB: { select: publicUser },
} as const;

@Injectable()
export class ConversationsService {
  // Single Chat process in this phase. Share the limiter if replicas are introduced.
  private readonly writes = new Map<string, { count: number; until: number }>();
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(UserProjectionService)
    private readonly users: UserProjectionService,
    @Inject(UserServiceClient) private readonly source: UserServiceClient,
  ) {}

  private limitWrites(userId: string) {
    const now = Date.now();
    let window = this.writes.get(userId);
    if (window && window.until <= now) {
      this.writes.delete(userId);
      window = undefined;
    }
    if (!window) {
      // Reclaim other expired entries only when capacity is needed, not on every send.
      if (this.writes.size >= 10000)
        for (const [id, entry] of this.writes)
          if (entry.until <= now) this.writes.delete(id);
      if (this.writes.size >= 10000)
        throw new ServiceUnavailableException(
          'Write capacity is temporarily full',
        );
      window = { count: 0, until: now + 60000 };
      this.writes.set(userId, window);
    }
    if (window.count >= 60)
      throw new HttpException('Too many writes; retry after one minute', 429);
    window.count++;
  }

  async openDm(userId: string, otherId: string) {
    if (userId === otherId)
      throw new BadRequestException('You cannot open a DM with yourself');
    this.limitWrites(userId);
    // The authentication guard already checked the caller on this request.
    await Promise.all([
      this.users.ensureUsers([otherId], true),
      this.source.assertUnblocked(userId, otherId),
    ]);
    const [dmUserAId, dmUserBId] = [userId, otherId].sort();
    // skipDuplicates lets PostgreSQL arbitrate simultaneous A->B and B->A opens.
    await this.database.conversation.createMany({
      data: [{ id: randomUUID(), kind: 'DM', dmUserAId, dmUserBId }],
      skipDuplicates: true,
    });
    return this.database.conversation.findUniqueOrThrow({
      where: {
        dmUserAId_dmUserBId: { dmUserAId: dmUserAId!, dmUserBId: dmUserBId! },
      },
      select: conversationFields,
    });
  }

  private accessWhere(userId: string): Prisma.ConversationWhereInput {
    return {
      OR: [
        { kind: 'DM', OR: [{ dmUserAId: userId }, { dmUserBId: userId }] },
        {
          kind: 'CHANNEL',
          group: { members: { some: { userId, user: { deletedAt: null } } } },
        },
      ],
    };
  }

  private async access(
    db: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    const conversation = await db.conversation.findFirst({
      where: { id, ...this.accessWhere(userId) },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async list(userId: string, page: Page) {
    const scope = 'conversations:' + userId;
    const after = page.after;
    let older: Prisma.ConversationWhereInput = {};
    if (after)
      older =
        after.time === null
          ? { lastMessageAt: null, id: { lt: after.id } }
          : {
              OR: [
                { lastMessageAt: { lt: after.time } },
                { lastMessageAt: after.time, id: { lt: after.id } },
                { lastMessageAt: null },
              ],
            };
    const rows = await this.database.conversation.findMany({
      where: { AND: [this.accessWhere(userId), older] },
      select: conversationFields,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
      take: page.limit + 1,
    });
    const items = rows.slice(0, page.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > page.limit && last
          ? nextCursor(scope, last.id, last.lastMessageAt)
          : null,
    };
  }

  async history(userId: string, id: string, page: Page) {
    if (page.after?.time === null)
      throw new BadRequestException('Invalid history cursor');
    return this.database.$transaction(async (tx) => {
      const conversation = await this.access(tx, userId, id);
      if (conversation.groupId) {
        await lockGroup(tx, conversation.groupId);
        await this.access(tx, userId, id);
      }
      const after = page.after;
      const rows = await tx.message.findMany({
        where: {
          conversationId: id,
          ...(after
            ? {
                OR: [
                  { createdAt: { lt: after.time! } },
                  { createdAt: after.time!, id: { lt: after.id } },
                ],
              }
            : {}),
        },
        select: messageFields,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      });
      const items = rows.slice(0, page.limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > page.limit && last
            ? nextCursor('messages:' + id, last.id, last.createdAt)
            : null,
      };
    });
  }

  private async checkDmWrite(userId: string, conversation: Conversation) {
    if (conversation.kind !== 'DM') return;
    const other =
      conversation.dmUserAId === userId
        ? conversation.dmUserBId!
        : conversation.dmUserAId!;
    await Promise.all([
      this.users.ensureUsers([other], true),
      this.source.assertUnblocked(userId, other),
    ]);
  }

  async send(
    userId: string,
    id: string,
    content: string,
    clientRequestId: string,
  ) {
    this.limitWrites(userId);
    const conversation = await this.access(this.database, userId, id);
    await this.checkDmWrite(userId, conversation);
    const requestHash = createHash('sha256')
      .update(JSON.stringify([id, content]))
      .digest('hex');
    return this.database.$transaction(async (tx) => {
      if (conversation.groupId) await lockGroup(tx, conversation.groupId);
      await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await this.access(tx, userId, id);
      const inserted = await tx.message.createMany({
        data: [
          {
            id: randomUUID(),
            conversationId: id,
            authorId: userId,
            content,
            clientRequestId,
            requestHash,
          },
        ],
        skipDuplicates: true,
      });
      const message = await tx.message.findUniqueOrThrow({
        where: {
          authorId_clientRequestId: { authorId: userId, clientRequestId },
        },
      });
      if (message.requestHash !== requestHash)
        throw new ConflictException(
          'clientRequestId was already used for a different message',
        );
      if (inserted.count)
        await tx.conversation.updateMany({
          where: {
            id,
            OR: [
              { lastMessageAt: null },
              { lastMessageAt: { lt: message.createdAt } },
            ],
          },
          data: {
            lastMessageAt: message.createdAt,
            updatedAt: current.updatedAt,
          },
        });
      // Never expose requestHash or profile synchronization metadata to browsers.
      return Object.fromEntries(
        Object.keys(messageFields).map((key) => [
          key,
          message[key as keyof typeof messageFields],
        ]),
      );
    });
  }
}
