import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatSharedModule } from './chat-shared.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { PresenceModule } from './presence/presence.module.js';
import { MinioModule } from '../minio/minio.module.js';

@Module({
  imports: [AuthModule, ChatSharedModule, GroupsModule, PresenceModule, MinioModule],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
})
export class ChatModule {}
