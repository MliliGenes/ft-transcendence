var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UserEventsConsumer_1;
import { Injectable, Logger, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp from 'amqp-connection-manager';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseUserEvent, USER_EVENT_TYPES, } from './user-event.js';
const USER_EVENTS_EXCHANGE = 'user.events';
const CHAT_USER_EVENTS_QUEUE = 'chat.user-events';
const USER_EVENTS_ROUTING_KEY = 'user.#';
let UserEventsConsumer = UserEventsConsumer_1 = class UserEventsConsumer {
    config;
    prisma;
    logger = new Logger(UserEventsConsumer_1.name);
    connection;
    channel;
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
    }
    onModuleInit() {
        const brokerUrl = new URL(`amqp://${this.config.getOrThrow('RABBITMQ_HOST')}`);
        brokerUrl.port = this.config.get('RABBITMQ_PORT', '5672');
        brokerUrl.username = this.config.getOrThrow('RABBITMQ_DEFAULT_USER');
        brokerUrl.password = this.config.getOrThrow('RABBITMQ_DEFAULT_PASS');
        this.connection = amqp.connect(brokerUrl.toString(), {
            heartbeatIntervalInSeconds: 30,
            reconnectTimeInSeconds: 2,
        });
        this.connection.on('connect', () => this.logger.log('RabbitMQ user-events consumer connected'));
        this.connection.on('connectFailed', () => this.logger.warn('RabbitMQ connection failed; reconnecting'));
        this.channel = this.connection.createChannel({
            name: 'chat-user-events-consumer',
            confirm: false,
            setup: async (channel) => {
                await channel.assertExchange(USER_EVENTS_EXCHANGE, 'topic', {
                    durable: true,
                });
                await channel.assertQueue(CHAT_USER_EVENTS_QUEUE, { durable: true });
                await channel.bindQueue(CHAT_USER_EVENTS_QUEUE, USER_EVENTS_EXCHANGE, USER_EVENTS_ROUTING_KEY);
                await channel.prefetch(1);
                await channel.consume(CHAT_USER_EVENTS_QUEUE, (message) => {
                    if (message)
                        void this.consume(channel, message);
                }, { noAck: false });
            },
        });
        this.channel.on('error', () => this.logger.error('RabbitMQ user-events channel error'));
    }
    async onModuleDestroy() {
        await this.connection?.close();
    }
    async consume(channel, message) {
        let value;
        try {
            value = JSON.parse(message.content.toString('utf8'));
        }
        catch {
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
        }
        catch {
            this.logger.error(`Failed to apply ${event.eventType}; requeueing`);
            channel.nack(message, false, true);
        }
    }
    async applyEvent(event) {
        const sourceUpdatedAt = new Date(event.version);
        const common = {
            sourceUpdatedAt,
            deletedAt: event.eventType === USER_EVENT_TYPES.DELETED
                ? new Date(event.occurredAt)
                : null,
        };
        const profile = event.eventType === USER_EVENT_TYPES.DELETED
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
        if (updated.count > 0)
            return;
        await this.prisma.chatUser.createMany({
            data: { id: event.data.userId, ...profile, ...common },
            skipDuplicates: true,
        });
    }
};
UserEventsConsumer = UserEventsConsumer_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [ConfigService,
        PrismaService])
], UserEventsConsumer);
export { UserEventsConsumer };
//# sourceMappingURL=user-events.consumer.js.map