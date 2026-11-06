import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './minio.constants.js';
import { minioBucket } from './minio.config.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

@Injectable()
export class MinioService {
  private readonly bucket: string;

  constructor(
    @Inject(MINIO_CLIENT) private readonly client: Client,
    @Inject(MINIO_PRESIGN_CLIENT) private readonly presignClient: Client,
    config: ConfigService,
  ) {
    this.bucket = minioBucket(config);
  }

  async createUploadUrl(conversationId: string, userId: string) {
    const objectKey = `attachments/${conversationId}/${userId}/${randomUUID()}`;
    const url = await this.presignClient.presignedPutObject(
      this.bucket,
      objectKey,
      UPLOAD_URL_TTL_SECONDS,
    );

    return { objectKey, url, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
  }

  createDownloadUrl(objectKey: string) {
    return this.presignClient.presignedGetObject(
      this.bucket,
      objectKey,
      DOWNLOAD_URL_TTL_SECONDS,
    );
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
