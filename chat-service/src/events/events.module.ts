import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { FeedModule } from '../feed/feed.module.js';
import { GameEventsConsumer } from './game-events.consumer.js';
import { UserEventsConsumer } from './user-events.consumer.js';

@Module({
  imports: [FeedModule, ChatModule],
  providers: [UserEventsConsumer, GameEventsConsumer],
})
export class EventsModule {}
