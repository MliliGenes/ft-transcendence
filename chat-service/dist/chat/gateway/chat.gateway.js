var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, SubscribeMessage, WebSocketGateway, WebSocketServer, } from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import { PresenceAudienceService } from '../presence/presence-audience.service.js';
import { PresenceService } from '../presence/presence.service.js';
let ChatGateway = ChatGateway_1 = class ChatGateway {
    jwt;
    presence;
    presenceAudience;
    logger = new Logger(ChatGateway_1.name);
    namespace;
    idleSweep;
    constructor(jwt, presence, presenceAudience) {
        this.jwt = jwt;
        this.presence = presence;
        this.presenceAudience = presenceAudience;
    }
    afterInit(namespace) {
        this.idleSweep = setInterval(() => {
            this.presence.expireIdleUsers().forEach((change) => {
                void this.emitPresenceChange(change);
            });
        }, 15_000);
        this.idleSweep.unref?.();
        namespace.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token;
                if (!token || typeof token !== 'string') {
                    return next(new Error('Unauthorized'));
                }
                const payload = await this.jwt.verifyAsync(token);
                if (typeof payload.sub !== 'string' ||
                    !isUUID(payload.sub) ||
                    typeof payload.exp !== 'number') {
                    return next(new Error('Unauthorized'));
                }
                socket.data.userId = payload.sub;
                next();
            }
            catch {
                next(new Error('Unauthorized'));
            }
        });
    }
    async handleConnection(socket) {
        const userId = socket.data.userId;
        await socket.join(`user:${userId}`);
        const change = this.presence.connect(userId, socket.id);
        const audience = await this.getPresenceAudience(userId);
        this.namespace.to(`user:${userId}`).emit('presence:snapshot', {
            users: this.presence.getStatuses([userId, ...audience]),
        });
        if (change)
            await this.emitPresenceChange(change, audience);
    }
    async handleDisconnect(socket) {
        const userId = socket.data.userId;
        const change = this.presence.disconnect(userId, socket.id);
        if (change)
            await this.emitPresenceChange(change);
        socket.leave(`user:${userId}`);
    }
    async onPresenceActivity(socket) {
        const userId = socket.data.userId;
        const change = this.presence.recordActivity(userId, socket.id);
        if (change)
            await this.emitPresenceChange(change);
    }
    onModuleDestroy() {
        if (this.idleSweep)
            clearInterval(this.idleSweep);
    }
    broadcastMessageCreated(userIds, message) {
        const rooms = userIds.map((userId) => `user:${userId}`);
        this.namespace.to(rooms).emit('message:created', message);
    }
    async emitPresenceChange(change, knownAudience) {
        this.namespace.to(`user:${change.userId}`).emit('presence:changed', change);
        const audience = knownAudience ?? await this.getPresenceAudience(change.userId);
        const rooms = audience
            .filter((userId) => userId !== change.userId)
            .map((userId) => `user:${userId}`);
        if (!rooms.length)
            return;
        this.namespace.to(rooms).emit('presence:changed', change);
    }
    async getPresenceAudience(userId) {
        try {
            return await this.presenceAudience.getUserIds(userId);
        }
        catch (error) {
            this.logger.warn(`Could not resolve presence audience for ${userId}`, error);
            return [];
        }
    }
};
__decorate([
    WebSocketServer(),
    __metadata("design:type", Function)
], ChatGateway.prototype, "namespace", void 0);
__decorate([
    SubscribeMessage('presence:activity'),
    __param(0, ConnectedSocket()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "onPresenceActivity", null);
ChatGateway = ChatGateway_1 = __decorate([
    WebSocketGateway({ namespace: '/chat' }),
    __metadata("design:paramtypes", [JwtService,
        PresenceService,
        PresenceAudienceService])
], ChatGateway);
export { ChatGateway };
//# sourceMappingURL=chat.gateway.js.map