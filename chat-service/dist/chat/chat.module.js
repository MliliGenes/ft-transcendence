var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatSharedModule } from './chat-shared.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { PresenceModule } from './presence/presence.module.js';
import { MinioModule } from '../minio/minio.module.js';
let ChatModule = class ChatModule {
};
ChatModule = __decorate([
    Module({
        imports: [AuthModule, ChatSharedModule, GroupsModule, PresenceModule, MinioModule],
        providers: [ChatService, ChatGateway],
        controllers: [ChatController],
    })
], ChatModule);
export { ChatModule };
//# sourceMappingURL=chat.module.js.map