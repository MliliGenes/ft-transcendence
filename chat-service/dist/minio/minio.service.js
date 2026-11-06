var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './minio.constants.js';
import { minioBucket } from './minio.config.js';
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const INLINE_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);
let MinioService = class MinioService {
    client;
    presignClient;
    bucket;
    constructor(client, presignClient, config) {
        this.client = client;
        this.presignClient = presignClient;
        this.bucket = minioBucket(config);
    }
    async createUploadUrl(conversationId, userId, contentType) {
        const objectKey = `attachments/${conversationId}/${userId}/${randomUUID()}`;
        const policy = this.presignClient.newPostPolicy();
        policy.setBucket(this.bucket);
        policy.setKey(objectKey);
        policy.setContentType(contentType);
        policy.setContentLengthRange(1, MAX_UPLOAD_BYTES);
        policy.setExpires(new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000));
        const { postURL, formData } = await this.presignClient.presignedPostPolicy(policy);
        return {
            objectKey,
            uploadUrl: postURL,
            method: 'POST',
            fields: formData,
            expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
            maxBytes: MAX_UPLOAD_BYTES,
        };
    }
    createDownloadUrl(objectKey) {
        return this.presignClient.presignedGetObject(this.bucket, objectKey, DOWNLOAD_URL_TTL_SECONDS, { 'response-content-disposition': 'attachment' });
    }
    async createInlineImageUrl(objectKey, contentType) {
        if (!INLINE_IMAGE_TYPES.has(contentType))
            return null;
        return this.presignClient.presignedGetObject(this.bucket, objectKey, DOWNLOAD_URL_TTL_SECONDS, {
            'response-content-disposition': 'inline',
            'response-content-type': contentType,
        });
    }
    async verifyUploadedAttachment(objectKey, conversationId, userId) {
        const prefix = `attachments/${conversationId}/${userId}/`;
        const objectId = objectKey.startsWith(prefix)
            ? objectKey.slice(prefix.length)
            : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(objectId)) {
            throw new BadRequestException('Invalid attachment reference');
        }
        const object = await this.client.statObject(this.bucket, objectKey);
        if (object.size < 1 || object.size > MAX_UPLOAD_BYTES) {
            throw new BadRequestException('Attachment size is invalid');
        }
        return object;
    }
    getObjectInfo(objectKey) {
        return this.client.statObject(this.bucket, objectKey);
    }
    removeObject(objectKey) {
        return this.client.removeObject(this.bucket, objectKey);
    }
    async ensureBucketExists() {
        if (!(await this.client.bucketExists(this.bucket))) {
            await this.client.makeBucket(this.bucket);
        }
    }
};
MinioService = __decorate([
    Injectable(),
    __param(0, Inject(MINIO_CLIENT)),
    __param(1, Inject(MINIO_PRESIGN_CLIENT)),
    __metadata("design:paramtypes", [Client,
        Client,
        ConfigService])
], MinioService);
export { MinioService };
//# sourceMappingURL=minio.service.js.map