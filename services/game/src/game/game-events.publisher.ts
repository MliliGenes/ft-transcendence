import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import amqp from "amqp-connection-manager";
import type { AmqpConnectionManager, Channel, ChannelWrapper } from "amqp-connection-manager";
import {
  GAME_EVENT_TYPES,
  type ChallengeCancelledData,
  type GameEvent,
  type MatchEndedData,
  type MatchStartedData,
} from "./game-event.js";

const GAME_EVENTS_EXCHANGE = "game.events";
const CHAT_GAME_EVENTS_QUEUE = "chat.game-events";
const GAME_EVENTS_ROUTING_KEY = "game.#";
const PUBLISH_TIMEOUT_MS = 5000;

/**
 * Publishes authoritative match lifecycle events for other services to consume.
 *
 * The Game service owns match state; it never writes to another service's
 * database. Chat subscribes to this exchange and turns the events into
 * conversation notifications.
 */
@Injectable()
export class GameEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameEventsPublisher.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  onModuleInit(): void {
    const host = process.env.RABBITMQ_HOST;
    const username = process.env.RABBITMQ_DEFAULT_USER;
    const password = process.env.RABBITMQ_DEFAULT_PASS;
    if (!host || !username || !password) {
      this.logger.warn("RabbitMQ game-events publisher disabled because broker configuration is incomplete");
      return;
    }

    const brokerUrl = new URL(`amqp://${host}`);
    brokerUrl.port = process.env.RABBITMQ_PORT ?? "5672";
    brokerUrl.username = username;
    brokerUrl.password = password;
    this.connection = amqp.connect(brokerUrl.toString(), {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 2,
    });
    this.connection.on("connectFailed", () => this.logger.warn("RabbitMQ connection failed; reconnecting"));

    this.channel = this.connection.createChannel({
      name: "game-events-publisher",
      confirm: true,
      publishTimeout: PUBLISH_TIMEOUT_MS,
      setup: async (channel: Channel) => {
        await channel.assertExchange(GAME_EVENTS_EXCHANGE, "topic", { durable: true });
        // The durable queue is declared here so lifecycle events survive a Chat
        // outage instead of being dropped between the two services.
        await channel.assertQueue(CHAT_GAME_EVENTS_QUEUE, { durable: true });
        await channel.bindQueue(CHAT_GAME_EVENTS_QUEUE, GAME_EVENTS_EXCHANGE, GAME_EVENTS_ROUTING_KEY);
      },
    });
    this.channel.on("error", () => this.logger.error("RabbitMQ game-events channel error"));
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  /** Publish one event. Returns false when the broker is unavailable. */
  async publish(event: GameEvent): Promise<boolean> {
    if (!this.channel) return false;
    try {
      return await this.channel.publish(
        GAME_EVENTS_EXCHANGE,
        event.eventType,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: "application/json",
          messageId: event.eventId,
          timestamp: Date.now(),
        },
      );
    } catch (error) {
      this.logger.error(`Failed to publish ${event.eventType}`, error);
      return false;
    }
  }

  async publishMatchStarted(data: MatchStartedData): Promise<boolean> {
    return this.publish({
      eventId: randomUUID(),
      eventType: GAME_EVENT_TYPES.MATCH_STARTED,
      occurredAt: new Date().toISOString(),
      data,
    });
  }

  async publishMatchEnded(data: MatchEndedData): Promise<boolean> {
    return this.publish({
      eventId: randomUUID(),
      eventType: GAME_EVENT_TYPES.MATCH_ENDED,
      occurredAt: new Date().toISOString(),
      data,
    });
  }

  async publishChallengeCancelled(data: ChallengeCancelledData): Promise<boolean> {
    return this.publish({
      eventId: randomUUID(),
      eventType: GAME_EVENT_TYPES.CHALLENGE_CANCELLED,
      occurredAt: new Date().toISOString(),
      data,
    });
  }
}
