import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserProfilesService } from './user-profiles.service.js';

@Module({
  imports: [AuthModule],
  providers: [ChatService, ChatGateway, UserProfilesService],
  controllers: [ChatController],
})
export class ChatModule {}
