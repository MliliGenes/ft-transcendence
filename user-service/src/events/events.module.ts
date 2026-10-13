import { Global, Module } from '@nestjs/common';
import { RabbitMqEventsService } from './rabbitmq-events.service.js';

@Global()
@Module({
  providers: [RabbitMqEventsService],
  exports: [RabbitMqEventsService],
})
export class EventsModule {}
