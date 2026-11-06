import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { ChatSharedModule } from '../chat-shared.module.js';
import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';

@Module({
  imports: [AuthModule, ChatSharedModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
