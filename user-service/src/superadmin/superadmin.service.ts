import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMqEventsService } from '../events/rabbitmq-events.service.js';
import type { UpdateAccountDto } from '../accounts/dto/update-account.dto.js';
import type { UserQueryDto } from './dto/user-query.dto.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateRoleDto } from './dto/update-role.dto.js';

const adminUserSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatarUrl: true,
  bannerUrl: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class SuperadminService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: RabbitMqEventsService,
  ) {}

  async getStats() {
    const now = new Date();
    const since = (days: number) => new Date(now.getTime() - days * 86400000);
    const [totalUsers, superadmins, newUsersLast7Days, newUsersLast30Days] =
      await this.prisma.$transaction(
        [
          this.prisma.user.count(),
          this.prisma.user.count({ where: { role: 'SUPERADMIN' } }),
          this.prisma.user.count({
            where: { createdAt: { gte: since(7), lte: now } },
          }),
          this.prisma.user.count({
            where: { createdAt: { gte: since(30), lte: now } },
          }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    return {
      totalUsers,
      regularUsers: totalUsers - superadmins,
      superadmins,
      newUsersLast7Days,
      newUsersLast30Days,
      asOf: now,
    };
  }

  async getUsers(query: UserQueryDto) {
    const {
      page,
      limit,
      search,
      role,
      createdFrom,
      createdTo,
      sortBy,
      sortOrder,
    } = query;
    const from = createdFrom ? new Date(createdFrom) : undefined;
    const to = createdTo ? new Date(createdTo) : undefined;
    if (from && to && from > to)
      throw new BadRequestException('createdFrom must not be after createdTo');
    // contains + insensitive produces ILIKE '%term%'. Escape user-supplied wildcards.
    const term = search?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
      ...(term
        ? {
            OR: ['username', 'email', 'displayName'].map((field) => ({
              [field]: { contains: term, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction(
      [
        this.prisma.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }],
          select: adminUserSelect,
        }),
        this.prisma.user.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: adminUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createUser(actorId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.mutate(actorId, (tx) =>
      tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          role: dto.role ?? 'USER',
        },
        select: adminUserSelect,
      }),
    );
    await this.events?.publishCreated(user);
    return user;
  }

  async updateUser(actorId: string, id: string, dto: UpdateAccountDto) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException(
        'Provide at least one user field to update',
      );
    const user = await this.mutate(actorId, async (tx) => {
      const current = await this.lockUser(tx, id);
      return tx.user.update({
        where: { id },
        data: {
          username: dto.username,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          displayName: dto.displayName,
          ...(dto.email !== undefined && dto.email !== current.email
            ? { emailVerifiedAt: null }
            : {}),
        },
        select: adminUserSelect,
      });
    });
    await this.events?.publishUpdated(user);
    return user;
  }

  async updateRole(actorId: string, id: string, dto: UpdateRoleDto) {
    return this.mutate(actorId, async (tx) => {
      const current = await this.lockUser(tx, id);
      if (current.role === 'SUPERADMIN' && dto.role !== 'SUPERADMIN')
        await this.requireAnotherAdmin(tx);
      return tx.user.update({
        where: { id },
        data: { role: dto.role },
        select: adminUserSelect,
      });
    });
  }

  async deleteUser(actorId: string, id: string): Promise<void> {
    await this.mutate(actorId, async (tx) => {
      const current = await this.lockUser(tx, id);
      if (current.role === 'SUPERADMIN') await this.requireAnotherAdmin(tx);
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.authProvider.deleteMany({ where: { userId: id } });
      // Images, two-factor settings, and recovery codes cascade on deletion.
      await tx.user.delete({ where: { id } });
    });
    await this.events?.publishDeleted(id);
  }

  private async lockUser(tx: Prisma.TransactionClient, id: string) {
    const users = await tx.$queryRaw<
      { id: string; role: string; email: string }[]
    >`
      SELECT "id", "role", "email" FROM "User" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!users[0]) throw new NotFoundException('User not found');
    return users[0];
  }

  private async requireAnotherAdmin(tx: Prisma.TransactionClient) {
    if ((await tx.user.count({ where: { role: 'SUPERADMIN' } })) <= 1) {
      throw new ConflictException(
        'The last superadmin cannot be deleted or demoted',
      );
    }
  }

  private async mutate<T>(
    actorId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize admin writes across instances, including the last-admin count.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(73929101)`;
        const actor = await tx.user.findUnique({
          where: { id: actorId },
          select: { role: true },
        });
        if (actor?.role !== 'SUPERADMIN')
          throw new ForbiddenException('Superadmin access is required');
        return action(tx);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Email or username is already in use');
        if (error.code === 'P2025')
          throw new NotFoundException('User not found');
      }
      throw error;
    }
  }
}
