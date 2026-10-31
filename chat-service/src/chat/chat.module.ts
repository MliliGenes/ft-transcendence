import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
})
export class ChatModule {}
