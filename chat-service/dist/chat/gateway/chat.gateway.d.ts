import { OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayInit } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { Message } from '../../generated/prisma/client.js';
import { PresenceAudienceService } from '../presence/presence-audience.service.js';
import { PresenceService } from '../presence/presence.service.js';
export declare class ChatGateway implements OnGatewayInit, OnModuleDestroy {
    private readonly jwt;
    private readonly presence;
    private readonly presenceAudience;
    private readonly logger;
    namespace: Namespace;
    private idleSweep?;
    constructor(jwt: JwtService, presence: PresenceService, presenceAudience: PresenceAudienceService);
    afterInit(namespace: Namespace): void;
    handleConnection(socket: Socket): Promise<void>;
    handleDisconnect(socket: Socket): Promise<void>;
    onPresenceActivity(socket: Socket): Promise<void>;
    onModuleDestroy(): void;
    broadcastMessageCreated(userIds: string[], message: Message): void;
    private emitPresenceChange;
    private getPresenceAudience;
}
