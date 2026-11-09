import { Module } from '@nestjs/common';
import { FeedService } from './feed.service.js';

@Module({
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
