import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatSharedModule } from './chat-shared.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { PresenceModule } from './presence/presence.module.js';
import { MinioModule } from '../minio/minio.module.js';
import { FeedModule } from '../feed/feed.module.js';
import { GameNotificationsService } from './game-notifications.service.js';
import { GameRoomsClient } from './game-rooms.client.js';

@Module({
  imports: [
    AuthModule,
    ChatSharedModule,
    GroupsModule,
    PresenceModule,
    MinioModule,
    FeedModule,
  ],
  providers: [
    ChatService,
    ChatGateway,
    GameNotificationsService,
    GameRoomsClient,
  ],
  exports: [GameNotificationsService],
  controllers: [ChatController],
})
export class ChatModule {}
