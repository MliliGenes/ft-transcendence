var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { EnsureActiveUserGuard } from './ensure-active-user.guard.js';
import { UserProfilesService } from './user-profiles.service.js';
let ChatSharedModule = class ChatSharedModule {
};
ChatSharedModule = __decorate([
    Module({
        providers: [UserProfilesService, EnsureActiveUserGuard],
        exports: [UserProfilesService, EnsureActiveUserGuard],
    })
], ChatSharedModule);
export { ChatSharedModule };
//# sourceMappingURL=chat-shared.module.js.map