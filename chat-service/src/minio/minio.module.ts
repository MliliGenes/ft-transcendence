import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './minio.constants.js';
import {
  minioClientOptions,
  minioPresignClientOptions,
} from './minio.config.js';
import { MinioService } from './minio.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Client(minioClientOptions(config)),
    },
    {
      provide: MINIO_PRESIGN_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Client(minioPresignClientOptions(config)),
    },
    MinioService,
  ],
  exports: [MinioService],
})
export class MinioModule {}
