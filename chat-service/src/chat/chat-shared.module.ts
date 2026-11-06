import { Module } from '@nestjs/common';
import { EnsureActiveUserGuard } from './ensure-active-user.guard.js';
import { UserProfilesService } from './user-profiles.service.js';

@Module({
  providers: [UserProfilesService, EnsureActiveUserGuard],
  exports: [UserProfilesService, EnsureActiveUserGuard],
})
export class ChatSharedModule {}
