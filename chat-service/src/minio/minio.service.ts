import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './minio.constants.js';
import { minioBucket } from './minio.config.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const INLINE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  ...VIDEO_TYPES,
]);

function maxBytesFor(contentType: string): number {
  return VIDEO_TYPES.has(contentType.toLowerCase())
    ? MAX_VIDEO_UPLOAD_BYTES
    : MAX_UPLOAD_BYTES;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly bucket: string;

  constructor(
    @Inject(MINIO_CLIENT) private readonly client: Client,
    @Inject(MINIO_PRESIGN_CLIENT) private readonly presignClient: Client,
    config: ConfigService,
  ) {
    this.bucket = minioBucket(config);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucketExists();
      this.logger.log(`Bucket "${this.bucket}" is ready`);
    } catch (error) {
      // Do not crash chat: messaging works without attachments. A bucket-scoped
      // service account cannot create buckets, so provision it with root creds.
      this.logger.error(
        `Cannot ensure bucket "${this.bucket}" exists; attachments will fail until it is created`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async createUploadUrl(
    conversationId: string,
    userId: string,
    contentType: string,
  ) {
    const objectKey = `attachments/${conversationId}/${userId}/${randomUUID()}`;
    const maxBytes = maxBytesFor(contentType);
    const policy = this.presignClient.newPostPolicy();
    policy.setBucket(this.bucket);
    policy.setKey(objectKey);
    policy.setContentType(contentType);
    policy.setContentLengthRange(1, maxBytes);
    policy.setExpires(new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000));
    const { postURL, formData } = await this.presignClient.presignedPostPolicy(policy);

    return {
      objectKey,
      uploadUrl: postURL,
      method: 'POST' as const,
      fields: formData,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      maxBytes,
    };
  }

  createDownloadUrl(objectKey: string) {
    return this.presignClient.presignedGetObject(
      this.bucket,
      objectKey,
      DOWNLOAD_URL_TTL_SECONDS,
      { 'response-content-disposition': 'attachment' },
    );
  }

  async createInlineImageUrl(objectKey: string, contentType: string) {
    // Images and videos only; anything else is download-only.
    if (!INLINE_MEDIA_TYPES.has(contentType)) return null;
    return this.presignClient.presignedGetObject(
      this.bucket,
      objectKey,
      DOWNLOAD_URL_TTL_SECONDS,
      {
        'response-content-disposition': 'inline',
        'response-content-type': contentType,
      },
    );
  }

  async verifyUploadedAttachment(
    objectKey: string,
    conversationId: string,
    userId: string,
  ) {
    const prefix = `attachments/${conversationId}/${userId}/`;
    const objectId = objectKey.startsWith(prefix)
      ? objectKey.slice(prefix.length)
      : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(objectId)) {
      throw new BadRequestException('Invalid attachment reference');
    }

    const object = await this.client.statObject(this.bucket, objectKey);
    const declaredType = Object.entries(object.metaData ?? {}).find(
      ([key]) => key.toLowerCase() === 'content-type',
    )?.[1];
    const limit = maxBytesFor(
      typeof declaredType === 'string'
        ? declaredType.split(';')[0].trim()
        : '',
    );
    if (object.size < 1 || object.size > limit) {
      throw new BadRequestException('Attachment size is invalid');
    }
    return object;
  }

  getObjectInfo(objectKey: string) {
    return this.client.statObject(this.bucket, objectKey);
  }

  removeObject(objectKey: string) {
    return this.client.removeObject(this.bucket, objectKey);
  }

  async ensureBucketExists() {
    if (!(await this.client.bucketExists(this.bucket))) {
      await this.client.makeBucket(this.bucket);
    }
  }
}
