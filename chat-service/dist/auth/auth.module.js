var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
let AuthModule = class AuthModule {
};
AuthModule = __decorate([
    Module({
        imports: [
            JwtModule.registerAsync({
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config) => {
                    const publicKey = config
                        .getOrThrow('JWT_PUBLIC_KEY')
                        .replace(/\\n/g, '\n');
                    return {
                        publicKey,
                        verifyOptions: {
                            algorithms: ['RS256'],
                            issuer: 'user-service',
                            audience: 'ft-transcendence-api',
                        },
                    };
                }
            }),
        ],
        exports: [JwtModule],
    })
], AuthModule);
export { AuthModule };
//# sourceMappingURL=auth.module.js.map