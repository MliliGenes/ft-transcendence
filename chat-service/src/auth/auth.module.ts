import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard.js';
import { getVerificationKey } from './verification-key.js';
import { SessionController } from './session.controller.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        publicKey: getVerificationKey(
          config.getOrThrow<string>('JWT_PUBLIC_KEY'),
        ),
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: 'user-service',
          audience: 'ft-transcendence-api',
        },
      }),
    }),
  ],
  controllers: [SessionController],
  providers: [{ provide: APP_GUARD, useClass: AccessTokenGuard }],
})
export class AuthModule {}
