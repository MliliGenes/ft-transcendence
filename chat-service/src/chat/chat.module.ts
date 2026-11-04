import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { GroupsController } from './groups.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserProfilesService } from './user-profiles.service.js';
import { GroupsService } from './groups.service.js';
import { EnsureActiveUserGuard } from './ensure-active-user.guard.js';
import { PresenceModule } from './presence.module.js';

@Module({
  imports: [AuthModule, PresenceModule],
  providers: [
    ChatService,
    GroupsService,
    ChatGateway,
    UserProfilesService,
    EnsureActiveUserGuard,
  ],
  controllers: [ChatController, GroupsController],
})
export class ChatModule {}
