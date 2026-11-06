import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
export declare class MinioService {
    private readonly client;
    private readonly presignClient;
    private readonly bucket;
    constructor(client: Client, presignClient: Client, config: ConfigService);
    createUploadUrl(conversationId: string, userId: string, contentType: string): Promise<{
        objectKey: string;
        uploadUrl: string;
        method: "POST";
        fields: {
            [key: string]: any;
        };
        expiresInSeconds: number;
        maxBytes: number;
    }>;
    createDownloadUrl(objectKey: string): Promise<string>;
    createInlineImageUrl(objectKey: string, contentType: string): Promise<string | null>;
    verifyUploadedAttachment(objectKey: string, conversationId: string, userId: string): Promise<import("minio").BucketItemStat>;
    getObjectInfo(objectKey: string): Promise<import("minio").BucketItemStat>;
    removeObject(objectKey: string): Promise<void>;
    ensureBucketExists(): Promise<void>;
}
