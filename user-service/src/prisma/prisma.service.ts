import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor(configService: ConfigService) {
		const databaseUrl = new URL('postgresql://localhost');
		databaseUrl.hostname = configService.getOrThrow<string>('POSTGRES_HOST');
		databaseUrl.port = configService.getOrThrow<string>('POSTGRES_PORT');
		databaseUrl.username = configService.getOrThrow<string>('POSTGRES_USER');
		databaseUrl.password = configService.getOrThrow<string>('POSTGRES_PASSWORD');
		databaseUrl.pathname = `/${encodeURIComponent(
			configService.getOrThrow<string>('POSTGRES_DB'),
		)}`;

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
