import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const databaseUrl = new URL('postgresql://localhost');
    databaseUrl.hostname = config.getOrThrow<string>('POSTGRES_HOST');
    databaseUrl.port = config.getOrThrow<string>('POSTGRES_PORT');
    databaseUrl.username = config.getOrThrow<string>('POSTGRES_USER');
    databaseUrl.password = config.getOrThrow<string>('POSTGRES_PASSWORD');
    databaseUrl.pathname = `/${encodeURIComponent(config.getOrThrow<string>('POSTGRES_DB'))}`;

    super({
      adapter: new PrismaPg({ connectionString: databaseUrl.toString() }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
