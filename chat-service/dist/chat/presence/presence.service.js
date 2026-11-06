var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
const AWAY_AFTER_MS = 5 * 60 * 1000;
const MIN_ACTIVITY_INTERVAL_MS = 5 * 1000;
let PresenceService = class PresenceService {
    socketsByUser = new Map();
    statusByUser = new Map();
    connect(userId, socketId) {
        const sockets = this.socketsByUser.get(userId) ?? new Map();
        this.socketsByUser.set(userId, sockets);
        sockets.set(socketId, Date.now());
        return this.updateStatus(userId);
    }
    recordActivity(userId, socketId) {
        const sockets = this.socketsByUser.get(userId);
        if (!sockets?.has(socketId))
            return null;
        const now = Date.now();
        if (now - sockets.get(socketId) < MIN_ACTIVITY_INTERVAL_MS)
            return null;
        sockets.set(socketId, now);
        return this.updateStatus(userId);
    }
    disconnect(userId, socketId) {
        const sockets = this.socketsByUser.get(userId);
        if (!sockets?.delete(socketId))
            return null;
        if (!sockets.size)
            this.socketsByUser.delete(userId);
        return this.updateStatus(userId);
    }
    expireIdleUsers() {
        const now = Date.now();
        const changes = [];
        for (const userId of this.socketsByUser.keys()) {
            const change = this.updateStatus(userId, now);
            if (change)
                changes.push(change);
        }
        return changes;
    }
    getStatuses(userIds) {
        return userIds.map((userId) => ({
            userId,
            status: this.statusByUser.get(userId) ?? 'OFFLINE',
        }));
    }
    updateStatus(userId, now = Date.now()) {
        const previous = this.statusByUser.get(userId) ?? 'OFFLINE';
        const sockets = this.socketsByUser.get(userId);
        const status = !sockets?.size
            ? 'OFFLINE'
            : [...sockets.values()].some((lastActivity) => now - lastActivity < AWAY_AFTER_MS)
                ? 'ONLINE'
                : 'AWAY';
        if (status === 'OFFLINE')
            this.statusByUser.delete(userId);
        else
            this.statusByUser.set(userId, status);
        return status === previous ? null : { userId, status };
    }
};
PresenceService = __decorate([
    Injectable()
], PresenceService);
export { PresenceService };
//# sourceMappingURL=presence.service.js.map