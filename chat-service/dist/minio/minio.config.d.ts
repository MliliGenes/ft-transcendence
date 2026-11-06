import type { ConfigService } from '@nestjs/config';
import type { ClientOptions } from 'minio';
export declare function minioClientOptions(config: ConfigService): ClientOptions;
export declare function minioPresignClientOptions(config: ConfigService): ClientOptions;
export declare function minioBucket(config: ConfigService): string;
