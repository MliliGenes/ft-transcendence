var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './minio.constants.js';
import { minioClientOptions, minioPresignClientOptions, } from './minio.config.js';
import { MinioService } from './minio.service.js';
let MinioModule = class MinioModule {
};
MinioModule = __decorate([
    Module({
        imports: [ConfigModule],
        providers: [
            {
                provide: MINIO_CLIENT,
                inject: [ConfigService],
                useFactory: (config) => new Client(minioClientOptions(config)),
            },
            {
                provide: MINIO_PRESIGN_CLIENT,
                inject: [ConfigService],
                useFactory: (config) => new Client(minioPresignClientOptions(config)),
            },
            MinioService,
        ],
        exports: [MinioService],
    })
], MinioModule);
export { MinioModule };
//# sourceMappingURL=minio.module.js.map