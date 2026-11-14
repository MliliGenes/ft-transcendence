import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import amqp from 'amqp-connection-manager';
import type {
  AmqpConnectionManager,
  Channel,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';
import { GameService } from './game.service.js';

const USER_EVENTS_EXCHANGE = 'user.events';
const GAME_USER_EVENTS_QUEUE = 'game.user-events';
const DELETED_EVENT_ROUTING_KEY = 'user.deleted';
const MAX_EVENT_BYTES = 64 * 1024;

export function parseDeletedUserId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const event = value as Record<string, unknown>;
  const data = event.data;
  if (
    event.eventType !== DELETED_EVENT_ROUTING_KEY ||
    typeof event.eventId !== 'string' ||
    typeof event.version !== 'string' ||
    typeof event.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(event.occurredAt)) ||
    !data ||
    typeof data !== 'object'
  )
    return undefined;
  const userId = (data as Record<string, unknown>).userId;
  if (typeof userId !== 'string' || !userId.trim() || userId.length > 256)
    return undefined;
  return userId;
}

@Injectable()
export class GameUserEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameUserEventsConsumer.name);
  private connection?: AmqpConnectionManager;
  private durableChannel?: ChannelWrapper;
  private liveChannel?: ChannelWrapper;

  constructor(private readonly game: GameService) {}

  onModuleInit(): void {
    const host = process.env.RABBITMQ_HOST;
    const username = process.env.RABBITMQ_DEFAULT_USER;
    const password = process.env.RABBITMQ_DEFAULT_PASS;
    if (!host || !username || !password) {
      if (process.env.DATABASE_URL) {
        throw new Error(
          'RabbitMQ is required when the persistent Game database is enabled',
        );
      }
      this.logger.warn(
        'RabbitMQ user-deletion consumer disabled because broker configuration is incomplete',
      );
      return;
    }

    const brokerUrl = new URL(`amqp://${host}`);
    brokerUrl.port = process.env.RABBITMQ_PORT ?? '5672';
    brokerUrl.username = username;
    brokerUrl.password = password;
    this.connection = amqp.connect(brokerUrl.toString(), {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 2,
    });
    this.connection.on('connectFailed', () =>
      this.logger.warn('RabbitMQ connection failed; reconnecting'),
    );

    this.durableChannel = this.connection.createChannel({
      name: 'game-user-deletion-consumer',
      confirm: false,
      setup: async (channel: Channel) => {
        await channel.assertExchange(USER_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
        await channel.assertQueue(GAME_USER_EVENTS_QUEUE, { durable: true });
        await channel.bindQueue(
          GAME_USER_EVENTS_QUEUE,
          USER_EVENTS_EXCHANGE,
          DELETED_EVENT_ROUTING_KEY,
        );
        await channel.prefetch(1);
        await channel.consume(
          GAME_USER_EVENTS_QUEUE,
          (message) => {
            if (message) void this.consumeDurable(channel, message);
          },
          { noAck: false },
        );
      },
    });
    this.durableChannel.on('error', () =>
      this.logger.error('RabbitMQ game deletion channel error'),
    );

    // A durable queue performs the actual purge even when Game is offline.
    // Each live instance also owns an exclusive queue so it can revoke its
    // local sockets immediately; database-backed guards cover missed events.
    this.liveChannel = this.connection.createChannel({
      name: 'game-user-deletion-live-fanout',
      confirm: false,
      setup: async (channel: Channel) => {
        await channel.assertExchange(USER_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
        const instanceId = (process.env.HOSTNAME ?? `pid-${process.pid}`)
          .replace(/[^a-zA-Z0-9_.-]/g, '_')
          .slice(0, 180);
        const { queue } = await channel.assertQueue(
          `game.user-events.live.${instanceId}`,
          {
            durable: false,
            exclusive: true,
            autoDelete: true,
          },
        );
        await channel.bindQueue(
          queue,
          USER_EVENTS_EXCHANGE,
          DELETED_EVENT_ROUTING_KEY,
        );
        await channel.prefetch(50);
        await channel.consume(
          queue,
          (message) => {
            if (message) void this.consumeLive(channel, message);
          },
          { noAck: false },
        );
      },
    });
    this.liveChannel.on('error', () =>
      this.logger.error('RabbitMQ game deletion fanout channel error'),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  private readDeletedUser(message: ConsumeMessage): string | undefined {
    if (message.content.length > MAX_EVENT_BYTES) return undefined;
    try {
      return parseDeletedUserId(
        JSON.parse(message.content.toString('utf8')) as unknown,
      );
    } catch {
      return undefined;
    }
  }

  private async consumeDurable(
    channel: Channel,
    message: ConsumeMessage,
  ): Promise<void> {
    const userId = this.readDeletedUser(message);
    if (!userId) {
      this.logger.warn('Discarded malformed user-deletion event');
      channel.ack(message);
      return;
    }
    try {
      await this.game.eraseDeletedAccount(userId);
      channel.ack(message);
    } catch {
      this.logger.error(
        'Failed to erase deleted user from Game; requeueing event',
      );
      await new Promise((resolve) => setTimeout(resolve, 2500));
      channel.nack(message, false, true);
    }
  }

  private async consumeLive(
    channel: Channel,
    message: ConsumeMessage,
  ): Promise<void> {
    const userId = this.readDeletedUser(message);
    if (!userId) {
      this.logger.warn('Discarded malformed live user-deletion event');
      channel.ack(message);
      return;
    }
    try {
      this.game.blockDeletedAccount(userId);
      channel.ack(message);
    } catch {
      channel.nack(message, false, true);
    }
  }
}
