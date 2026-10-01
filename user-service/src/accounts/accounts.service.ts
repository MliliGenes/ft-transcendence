import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import sharp from 'sharp';
import {
  IMAGE_SETTINGS,
  MAX_IMAGE_PIXELS,
  type UploadedImage,
} from './image.constants.js';
import type { UserImageKind } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';

import type { PaginationDto } from './dto/pagination.dto.js';

// Public profile fields shared with other services; private details stay in /me.
const publicProfileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bannerUrl: true,
  status: true,
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
  status: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: accountSelect,
    });
    if (!user) throw new NotFoundException('Account not found');
    return user;
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

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicProfileSelect,
    });
    if (!user) throw new NotFoundException('Account not found');
    return user;
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
    };

    try {
      if (dto.email !== undefined) {
        return await this.prisma.$transaction(async (tx) => {
          // Keep the comparison and update together, including concurrent edits.
          const users = await tx.$queryRaw<{ email: string }[]>`
            SELECT "email" FROM "User" WHERE "id" = ${id} FOR UPDATE
          `;
          if (!users[0]) throw new NotFoundException('Account not found');
          if (dto.email !== users[0].email) data.emailVerifiedAt = null;
          return tx.user.update({ where: { id }, data, select: accountSelect });
        });
      }
      return await this.prisma.user.update({
        where: { id },
        data,
        select: accountSelect,
      });
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
    return this.prisma.$transaction(async (tx) => {
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
  }
}
