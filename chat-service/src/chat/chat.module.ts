import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { GroupsController } from './groups.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserProfilesService } from './user-profiles.service.js';
import { GroupsService } from './groups.service.js';

@Module({
  imports: [AuthModule],
  providers: [ChatService, GroupsService, ChatGateway, UserProfilesService],
  controllers: [ChatController, GroupsController],
})
export class ChatModule {}
