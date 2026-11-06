var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { isUUID } from 'class-validator';
import { Injectable, UnauthorizedException, } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators.js';
import { WsException } from '@nestjs/websockets';
let AuthGuard = class AuthGuard {
    jwtService;
    reflector;
    constructor(jwtService, reflector) {
        this.jwtService = jwtService;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const isWs = context.getType() == 'ws';
        const unauthorized = (message) => isWs ? new WsException(message) : new UnauthorizedException(message);
        const target = isWs
            ? context.switchToWs().getClient()
            : context
                .switchToHttp()
                .getRequest();
        const token = isWs
            ? this.fromSocket(target)
            : this.fromHeader(target.headers['authorization']);
        if (!token) {
            throw unauthorized('A Bearer access token is required');
        }
        try {
            const payload = await this.jwtService.verifyAsync(token);
            if (typeof payload.sub !== 'string' ||
                !isUUID(payload.sub) ||
                typeof payload.exp !== 'number') {
                throw unauthorized('Invalid access-token claims');
            }
            const user = { sub: payload.sub };
            if (isWs) {
                target.data.user = user;
            }
            else {
                target.user = user;
            }
            return true;
        }
        catch {
            throw unauthorized('Access token is invalid or expired');
        }
    }
    fromHeader(header) {
        const [type, token] = header?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
    fromSocket(client) {
        return (client.handshake?.auth?.token ??
            this.fromHeader(client.handshake?.headers?.authorization));
    }
};
AuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [JwtService,
        Reflector])
], AuthGuard);
export { AuthGuard };
//# sourceMappingURL=auth.guard.js.map