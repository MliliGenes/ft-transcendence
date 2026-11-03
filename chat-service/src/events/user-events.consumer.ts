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
import type { ConsumeMessage } from 'amqplib';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  parseUserEvent,
  USER_EVENT_TYPES,
  type UserEvent,
} from './user-event.js';

const USER_EVENTS_EXCHANGE = 'user.events';
const CHAT_USER_EVENTS_QUEUE = 'chat.user-events';
const USER_EVENTS_ROUTING_KEY = 'user.#';

@Injectable()
export class UserEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserEventsConsumer.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const brokerUrl = new URL(
      `amqp://${this.config.getOrThrow<string>('RABBITMQ_HOST')}`,
    );
    brokerUrl.port = this.config.get<string>('RABBITMQ_PORT', '5672');
    brokerUrl.username = this.config.getOrThrow<string>('RABBITMQ_DEFAULT_USER');
    brokerUrl.password = this.config.getOrThrow<string>('RABBITMQ_DEFAULT_PASS');

    this.connection = amqp.connect(brokerUrl.toString(), {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 2,
    });
    this.connection.on('connect', () =>
      this.logger.log('RabbitMQ user-events consumer connected'),
    );
    this.connection.on('connectFailed', () =>
      this.logger.warn('RabbitMQ connection failed; reconnecting'),
    );

    this.channel = this.connection.createChannel({
      name: 'chat-user-events-consumer',
      confirm: false,
      setup: async (channel: Channel) => {
        await channel.assertExchange(USER_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
        await channel.assertQueue(CHAT_USER_EVENTS_QUEUE, { durable: true });
        await channel.bindQueue(
          CHAT_USER_EVENTS_QUEUE,
          USER_EVENTS_EXCHANGE,
          USER_EVENTS_ROUTING_KEY,
        );
        await channel.prefetch(1);
        await channel.consume(
          CHAT_USER_EVENTS_QUEUE,
          (message) => {
            if (message) void this.consume(channel, message);
          },
          { noAck: false },
        );
      },
    });
    this.channel.on('error', () =>
      this.logger.error('RabbitMQ user-events channel error'),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  private async consume(channel: Channel, message: ConsumeMessage) {
    let value: unknown;
    try {
      value = JSON.parse(message.content.toString('utf8'));
    } catch {
      this.logger.warn('Discarded malformed user event JSON');
      channel.ack(message);
      return;
    }

    const event = parseUserEvent(value);
    if (!event) {
      this.logger.warn('Discarded invalid user event');
      channel.ack(message);
      return;
    }

    try {
      await this.applyEvent(event);
      channel.ack(message);
    } catch {
      this.logger.error(`Failed to apply ${event.eventType}; requeueing`);
      channel.nack(message, false, true);
    }
  }

  async applyEvent(event: UserEvent) {
    const sourceUpdatedAt = new Date(event.version);
    const common = {
      sourceUpdatedAt,
      deletedAt:
        event.eventType === USER_EVENT_TYPES.DELETED
          ? new Date(event.occurredAt)
          : null,
    };
    const profile =
      event.eventType === USER_EVENT_TYPES.DELETED
        ? { username: null, displayName: null, avatarUrl: null }
        : {
            username: event.data.username,
            displayName: event.data.displayName,
            avatarUrl: event.data.avatarUrl,
          };

    const updated = await this.prisma.chatUser.updateMany({
      where: {
        id: event.data.userId,
        sourceUpdatedAt: { lt: sourceUpdatedAt },
      },
      data: { ...profile, ...common },
    });
    if (updated.count > 0) return;

    await this.prisma.chatUser.createMany({
      data: { id: event.data.userId, ...profile, ...common },
      skipDuplicates: true,
    });
  }
}
