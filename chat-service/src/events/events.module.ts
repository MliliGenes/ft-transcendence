import { Module } from '@nestjs/common';
import { FeedModule } from '../feed/feed.module.js';
import { UserEventsConsumer } from './user-events.consumer.js';

@Module({ imports: [FeedModule], providers: [UserEventsConsumer] })
export class EventsModule {}
