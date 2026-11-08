import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common';
import sharp from 'sharp';
import * as bcrypt from 'bcrypt';
import type {
  SetPasswordDto,
  UpdatePasswordDto,
} from './dto/update-password.dto.js';
import {
  IMAGE_SETTINGS,
  MAX_IMAGE_PIXELS,
  type UploadedImage,
} from './image.constants.js';
import type { UserImageKind } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMqEventsService } from '../events/rabbitmq-events.service.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';

import type { PaginationDto } from './dto/pagination.dto.js';
import type { AccountSearchDto, JoinedWithin } from './dto/account-search.dto.js';

const JOINED_WITHIN_DAYS: Record<JoinedWithin, number> = { '7d': 7, '30d': 30, '365d': 365 };

// Public profile fields shared with other services; private details stay in /me.
const publicProfileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bannerUrl: true,
  bio: true,
  statusText: true,
  statusIcon: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const accountSelect = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatarUrl: true,
  bannerUrl: true,
  bio: true,
  statusText: true,
  statusIcon: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  authProviders: { select: { provider: true } },
} satisfies Prisma.UserSelect;

function accountResponse<T extends { passwordHash: string | null }>(
  account: T,
) {
  const { passwordHash, authProviders, ...response } = account as T & {
    authProviders?: { provider: string }[];
  };
  return {
    ...response,
    hasPassword: Boolean(passwordHash),
    hasDiscord: Boolean(
      authProviders?.some(({ provider }) => provider === 'DISCORD'),
    ),
    hasGithub: Boolean(
      authProviders?.some(({ provider }) => provider === 'GITHUB'),
    ),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: RabbitMqEventsService,
  ) {}

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: accountSelect,
    });
    if (!user) throw new NotFoundException('Account not found');
    return accountResponse(user);
  }

  async getUsers({ page, limit }: PaginationDto) {
    const [users, total] = await this.prisma.$transaction(
      [
        this.prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: publicProfileSelect,
        }),
        this.prisma.user.count(),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async searchUsers({
    username,
    sortBy = 'username',
    sortOrder = 'asc',
    joinedWithin,
    hasStatus,
    hasBio,
    page,
    limit,
  }: AccountSearchDto) {
    const conditions: Prisma.UserWhereInput[] = [];
    if (username) {
      conditions.push({
        OR: [
          { username: { contains: username, mode: 'insensitive' } },
          { displayName: { contains: username, mode: 'insensitive' } },
        ],
      });
    }
    if (joinedWithin) {
      const days = JOINED_WITHIN_DAYS[joinedWithin];
      conditions.push({ createdAt: { gte: new Date(Date.now() - days * 86_400_000) } });
    }
    if (hasStatus === true) conditions.push({ NOT: [{ statusText: null }, { statusText: '' }] });
    if (hasStatus === false) conditions.push({ OR: [{ statusText: null }, { statusText: '' }] });
    if (hasBio === true) conditions.push({ NOT: [{ bio: null }, { bio: '' }] });
    if (hasBio === false) conditions.push({ OR: [{ bio: null }, { bio: '' }] });
    const where: Prisma.UserWhereInput =
      conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { AND: conditions };

    // displayName is optional, so put members without one at the end.
    const primarySort: Prisma.UserOrderByWithRelationInput =
      sortBy === 'displayName'
        ? { displayName: { sort: sortOrder, nulls: 'last' } }
        : { [sortBy]: sortOrder };

    const [users, total] = await this.prisma.$transaction(
      [
        this.prisma.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          // id breaks ties so pages never repeat or skip a member.
          orderBy: [primarySort, { id: 'asc' }],
          select: publicProfileSelect,
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
      select: publicProfileSelect,
    });
    if (!user) throw new NotFoundException('Account not found');
    return user;
  }

  async updatePassword(id: string, dto: UpdatePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.passwordHash)
      throw new ConflictException(
        'This account has no password. Setting an initial password requires a separate flow.',
      );
    if (!(await bcrypt.compare(dto.oldPassword, user.passwordHash)))
      throw new ForbiddenException('The old password is incorrect.');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    // Only replace the hash we verified. A concurrent password change must win
    // once, rather than letting a stale old password overwrite the new one.
    const updated = await this.prisma.user.updateMany({
      where: { id, passwordHash: user.passwordHash },
      data: { passwordHash },
    });
    if (updated.count !== 1)
      throw new ConflictException(
        'Your account changed while updating the password. Please try again with your current password.',
      );
  }

  async setPassword(id: string, dto: SetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (user.passwordHash)
      throw new ConflictException(
        'This account already has a password. Use the change password flow.',
      );

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.prisma.user.updateMany({
      where: { id, passwordHash: null },
      data: { passwordHash },
    });
    if (updated.count !== 1)
      throw new ConflictException(
        'A password was set while this request was in progress. Please use the change password flow.',
      );
  }

  async updateMe(id: string, dto: UpdateAccountDto) {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'Provide at least one account field to update',
      );
    }

    // Explicit allowlist: never spread a request DTO into a Prisma write.
    const data: Prisma.UserUpdateInput = {
      username: dto.username,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      displayName: dto.displayName,
      bio: dto.bio,
      statusText: dto.statusText,
      statusIcon: dto.statusIcon,
    };

    try {
      let user;
      if (dto.email !== undefined) {
        user = await this.prisma.$transaction(async (tx) => {
          // Keep the comparison and update together, including concurrent edits.
          const users = await tx.$queryRaw<{ email: string }[]>`
            SELECT "email" FROM "User" WHERE "id" = ${id} FOR UPDATE
          `;
          if (!users[0]) throw new NotFoundException('Account not found');
          if (dto.email !== users[0].email) data.emailVerifiedAt = null;
          return tx.user.update({
            where: { id },
            data,
            select: accountSelect,
          });
        });
      } else {
        user = await this.prisma.user.update({
          where: { id },
          data,
          select: accountSelect,
        });
      }
      await this.events?.publishUpdated(user);
      return accountResponse(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Email or username is already in use');
        if (error.code === 'P2025')
          throw new NotFoundException('Account not found');
      }
      throw error;
    }
  }

  async deleteMe(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Serialize deletion with refresh/logout before removing their records.
      const users = await tx.$queryRaw<{ id: string; role: string }[]>`
        SELECT "id", "role" FROM "User" WHERE "id" = ${id} FOR UPDATE
      `;
      if (users.length === 0) throw new NotFoundException('Account not found');
      if (users[0].role === 'SUPERADMIN') {
        throw new ForbiddenException(
          'Superadmins must use the admin deletion endpoint',
        );
      }

      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.authProvider.deleteMany({ where: { userId: id } });
      // Two-factor settings and recovery codes already cascade in the schema.
      await tx.user.delete({ where: { id } });
    });
    await this.events?.publishDeleted(id);
  }

  async getImage(id: string, kind: UserImageKind) {
    const image = await this.prisma.userImage.findUnique({
      where: { userId_kind: { userId: id, kind } },
      select: { data: true, contentType: true },
    });
    if (!image) {
      throw new NotFoundException(
        `${kind === 'AVATAR' ? 'Avatar' : 'Banner'} not found`,
      );
    }
    return image;
  }

  async removeImage(id: string, kind: UserImageKind): Promise<void> {
    const user = await this.prisma.$transaction(async (tx) => {
      // Use the same account lock as uploads and account deletion.
      const users = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE
      `;
      if (users.length === 0) throw new NotFoundException('Account not found');

      await tx.userImage.deleteMany({ where: { userId: id, kind } });
      return tx.user.update({
        where: { id },
        data: kind === 'AVATAR' ? { avatarUrl: null } : { bannerUrl: null },
        select: accountSelect,
      });
    });
    if (kind === 'AVATAR') await this.events?.publishUpdated(user);
  }

  async storeImage(id: string, kind: UserImageKind, file?: UploadedImage) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Upload an image using the file form-data field',
      );
    }
    const settings = IMAGE_SETTINGS[kind];
    if (file.buffer.length > settings.maxBytes) {
      throw new PayloadTooLargeException('Image exceeds the upload size limit');
    }

    let data: Buffer;
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
        (metadata.pages ?? 1) > 1
      ) {
        throw new Error('Unsupported image');
      }
      // Auto-orient before cropping; re-encoding also removes original metadata.
      data = await image
        .rotate()
        .resize(settings.width, settings.height, {
          fit: 'cover',
          position: 'centre',
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Upload a valid, non-animated JPEG, PNG, or WebP image of at most 20 megapixels',
      );
    }
    if (data.length > settings.maxBytes) {
      throw new PayloadTooLargeException(
        'Processed image exceeds the storage size limit',
      );
    }

    const url = `/accounts/${id}/${kind.toLowerCase()}`;
    const bytes = new Uint8Array(data);
    const user = await this.prisma.$transaction(async (tx) => {
      // Lock the account so replacements and account deletion cannot interleave.
      const users = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE
      `;
      if (users.length === 0) throw new NotFoundException('Account not found');

      await tx.userImage.upsert({
        where: { userId_kind: { userId: id, kind } },
        create: { userId: id, kind, data: bytes, contentType: 'image/webp' },
        update: { data: bytes, contentType: 'image/webp' },
        select: { id: true },
      });
      // Store the URL and image together, or roll both changes back.
      return tx.user.update({
        where: { id },
        data: kind === 'AVATAR' ? { avatarUrl: url } : { bannerUrl: url },
        select: accountSelect,
      });
    });
    if (kind === 'AVATAR') await this.events?.publishUpdated(user);
    return accountResponse(user);
  }
}
