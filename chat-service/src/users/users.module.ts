import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { UserServiceClient } from './user-service.client.js';
import { UserProjectionService } from './user-projection.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [UserServiceClient, UserProjectionService],
  exports: [UserProjectionService, UserServiceClient],
})
export class UsersModule {}
