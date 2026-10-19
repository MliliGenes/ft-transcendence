import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../database/database.service.js';
import { lockGroup } from '../database/group-lock.js';
import type { Prisma } from '../generated/prisma/client.js';
import { UserServiceClient } from './user-service.client.js';

const PROFILE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class UserProjectionService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(UserServiceClient) private readonly source: UserServiceClient,
  ) {}

  async ensureUsers(values: string[], forceRefresh = false) {
    if (
      values.length < 1 ||
      values.length > 100 ||
      values.some((id) => !isUUID(id))
    ) {
      throw new BadRequestException('Provide 1 to 100 UUIDs');
    }
    const ids = [...new Set(values.map((id) => id.toLowerCase()))].sort();
    const cached = await this.database.chatUser.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(cached.map((user) => [user.id, user]));
    const now = Date.now();
    const refresh = ids.filter((id) => {
      const user = byId.get(id);
      if (user?.deletedAt) return false;
      return (
        !user || forceRefresh || now - user.syncedAt.getTime() >= PROFILE_TTL_MS
      );
    });

    if (refresh.length) {
      const batch = await this.source.getUsers(refresh);
      const snapshots = new Map(batch.users.map((user) => [user.id, user]));
      const missing = new Set(batch.missingIds);
      const syncedAt = new Date();
      await this.database.$transaction(
        async (tx) => {
          // Lock groups before profile rows, in a stable order, to avoid deadlocks.
          const memberships = await tx.groupMember.findMany({
            where: { userId: { in: batch.missingIds } },
            select: { groupId: true },
          });
          const groups = [
            ...new Set(memberships.map((member) => member.groupId)),
          ].sort();
          for (const groupId of groups) await lockGroup(tx, groupId);

          for (const id of [...refresh].sort()) {
            const user = snapshots.get(id);
            if (user) {
              const sourceUpdatedAt = new Date(user.updatedAt);
              const profile = {
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              };
              await tx.chatUser.createMany({
                data: [{ id, ...profile, sourceUpdatedAt, syncedAt }],
                skipDuplicates: true,
              });
              await tx.chatUser.updateMany({
                where: {
                  id,
                  deletedAt: null,
                  sourceUpdatedAt: { lt: sourceUpdatedAt },
                },
                data: { ...profile, sourceUpdatedAt },
              });
            } else if (missing.has(id)) {
              const deletedAt = new Date(batch.asOf);
              await tx.chatUser.createMany({
                data: [{ id, sourceUpdatedAt: deletedAt, syncedAt, deletedAt }],
                skipDuplicates: true,
              });
              // Deletion is terminal: an older response must never restore a profile.
              await tx.chatUser.updateMany({
                where: { id, deletedAt: null },
                data: {
                  username: null,
                  displayName: null,
                  avatarUrl: null,
                  deletedAt,
                },
              });
            }
            await tx.chatUser.updateMany({
              where: { id, syncedAt: { lt: syncedAt } },
              data: { syncedAt },
            });
          }
          for (const groupId of groups) await this.cleanGroup(tx, groupId);
        },
        { maxWait: 2000, timeout: 15000 },
      );
    }

    const users = await this.database.chatUser.findMany({
      where: { id: { in: ids } },
    });
    if (
      users.length !== ids.length ||
      users.some((user) => user.deletedAt !== null)
    ) {
      throw new NotFoundException('One or more accounts are unavailable');
    }
    const results = new Map(users.map((user) => [user.id, user]));
    return ids.map((id) => results.get(id)!);
  }

  private async cleanGroup(
    tx: Prisma.TransactionClient,
    groupId: string,
  ): Promise<void> {
    await tx.groupMember.deleteMany({
      where: { groupId, user: { deletedAt: { not: null } } },
    });
    const members = await tx.groupMember.findMany({
      where: { groupId, user: { deletedAt: null } },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    });
    if (!members.length) {
      await tx.group.deleteMany({ where: { id: groupId } });
    } else if (!members.some((member) => member.role === 'ADMIN')) {
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId: members[0]!.userId } },
        data: { role: 'ADMIN' },
      });
    }
  }
}
