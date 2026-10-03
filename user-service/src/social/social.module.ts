import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FriendshipsService } from './friendships.service.js';
import { SocialController } from './social.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [SocialController],
  providers: [FriendshipsService],
})
export class SocialModule {}