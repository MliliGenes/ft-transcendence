import { Module } from '@nestjs/common';
import { SocialController } from './social.controller.js';
import { BlocksService } from './blocks.service.js';
import { FollowsService } from './follows.service.js';
import { FriendshipsService } from './friendships.service.js';

@Module({
  controllers: [SocialController],
  providers: [BlocksService, FollowsService, FriendshipsService],
})
export class SocialModule {}