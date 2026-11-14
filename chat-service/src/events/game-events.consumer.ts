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
import { GameNotificationsService } from '../chat/game-notifications.service.js';
import { parseGameEvent } from './game-event.js';

const GAME_EVENTS_EXCHANGE = 'game.events';
const CHAT_GAME_EVENTS_QUEUE = 'chat.game-events';
const GAME_EVENTS_ROUTING_KEY = 'game.#';
const MAX_EVENT_BYTES = 64 * 1024;

/**
 * Consumes authoritative game lifecycle events and turns them into chat
 * notifications. The Game service owns match state; this consumer only
 * reacts to what the Game service already decided.
 */
@Injectable()
export class GameEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameEventsConsumer.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: GameNotificationsService,
  ) {}

  onModuleInit(): void {
    const brokerUrl = new URL(
      `amqp://${this.config.getOrThrow<string>('RABBITMQ_HOST')}`,
    );
    brokerUrl.port = this.config.get<string>('RABBITMQ_PORT', '5672');
    brokerUrl.username = this.config.getOrThrow<string>(
      'RABBITMQ_DEFAULT_USER',
    );
    brokerUrl.password = this.config.getOrThrow<string>(
      'RABBITMQ_DEFAULT_PASS',
    );

    this.connection = amqp.connect(brokerUrl.toString(), {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 2,
    });
    this.connection.on('connect', () =>
      this.logger.log('RabbitMQ game-events consumer connected'),
    );
    this.connection.on('connectFailed', () =>
      this.logger.warn('RabbitMQ connection failed; reconnecting'),
    );

    this.channel = this.connection.createChannel({
      name: 'chat-game-events-consumer',
      confirm: false,
      setup: async (channel: Channel) => {
        await channel.assertExchange(GAME_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
        await channel.assertQueue(CHAT_GAME_EVENTS_QUEUE, { durable: true });
        await channel.bindQueue(
          CHAT_GAME_EVENTS_QUEUE,
          GAME_EVENTS_EXCHANGE,
          GAME_EVENTS_ROUTING_KEY,
        );
        await channel.prefetch(1);
        await channel.consume(
          CHAT_GAME_EVENTS_QUEUE,
          (message) => {
            if (message) void this.consume(channel, message);
          },
          { noAck: false },
        );
      },
    });
    this.channel.on('error', () =>
      this.logger.error('RabbitMQ game-events channel error'),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  private async consume(channel: Channel, message: ConsumeMessage) {
    if (message.content.length > MAX_EVENT_BYTES) {
      this.logger.warn('Discarded oversized game event');
      channel.ack(message);
      return;
    }

    let value: unknown;
    try {
      value = JSON.parse(message.content.toString('utf8'));
    } catch {
      this.logger.warn('Discarded malformed game event JSON');
      channel.ack(message);
      return;
    }

    const event = parseGameEvent(value);
    if (!event) {
      this.logger.warn('Discarded invalid game event');
      channel.ack(message);
      return;
    }

    try {
      const outcome = await this.notifications.applyGameEvent(event);
      if (!outcome.delivered) {
        this.logger.log(`Ignored ${event.eventType}: ${outcome.reason}`);
      }
      channel.ack(message);
    } catch {
      this.logger.error(`Failed to apply ${event.eventType}; requeueing`);
      channel.nack(message, false, true);
    }
  }
}
