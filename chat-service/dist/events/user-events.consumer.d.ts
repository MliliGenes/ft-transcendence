import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { type UserEvent } from './user-event.js';
export declare class UserEventsConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly prisma;
    private readonly logger;
    private connection?;
    private channel?;
    constructor(config: ConfigService, prisma: PrismaService);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
    private consume;
    applyEvent(event: UserEvent): Promise<void>;
}
