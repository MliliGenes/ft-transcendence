import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp from 'amqp-connection-manager';
import type {
  AmqpConnectionManager,
  Channel,
  ChannelWrapper,
} from 'amqp-connection-manager';
import { randomUUID } from 'node:crypto';
import type { UserEvent, UserProfileSnapshot } from './user-event.types.js';

const USER_EVENTS_EXCHANGE = 'user.events';
const CHAT_USER_EVENTS_QUEUE = 'chat.user-events';

@Injectable()
export class RabbitMqEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqEventsService.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const brokerUrl = new URL(
      `amqp://${this.config.getOrThrow<string>('RABBITMQ_HOST')}`,
    );
    brokerUrl.port = this.config.getOrThrow<string>('RABBITMQ_PORT');
    brokerUrl.username = this.config.getOrThrow<string>('RABBITMQ_USER');
    brokerUrl.password = this.config.getOrThrow<string>('RABBITMQ_PASS');

    this.connection = amqp.connect(brokerUrl.toString(), {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 2,
    });
    this.connection.on('connectFailed', () => {
      // Do not log the broker URL; it contains credentials.
      this.logger.warn('RabbitMQ connection failed; reconnecting');
    });

    this.channel = this.connection.createChannel({
      name: 'user-events-publisher',
      confirm: true,
      publishTimeout: 5000,
      setup: async (channel: Channel) => {
        await channel.assertExchange(USER_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
        await channel.assertQueue(CHAT_USER_EVENTS_QUEUE, { durable: true });
        await channel.bindQueue(
          CHAT_USER_EVENTS_QUEUE,
          USER_EVENTS_EXCHANGE,
          'user.#',
        );
      },
    });
    this.channel.on('error', () => {
      this.logger.error('RabbitMQ user-events channel error');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  publishCreated(user: UserProfileSnapshot): Promise<boolean> {
    return this.publishProfile('user.created', user);
  }

  publishUpdated(user: UserProfileSnapshot): Promise<boolean> {
    return this.publishProfile('user.updated', user);
  }

  publishDeleted(userId: string): Promise<boolean> {
    const occurredAt = new Date().toISOString();
    return this.publish({
      eventId: randomUUID(),
      eventType: 'user.deleted',
      version: occurredAt,
      occurredAt,
      data: { userId },
    });
  }

  private publishProfile(
    eventType: 'user.created' | 'user.updated',
    user: UserProfileSnapshot,
  ): Promise<boolean> {
    return this.publish({
      eventId: randomUUID(),
      eventType,
      version: user.updatedAt.toISOString(),
      occurredAt: new Date().toISOString(),
      data: {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  }

  private async publish(event: UserEvent): Promise<boolean> {
    if (!this.channel) {
      throw new Error('RabbitMQ user-events publisher is not initialized');
    }

    return this.channel.publish(
      USER_EVENTS_EXCHANGE,
      event.eventType,
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        timestamp: Date.now(),
      },
    );
  }
}
