import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './token.constants.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKey = config
          .getOrThrow<string>('JWT_PRIVATE_KEY')
          .replace(/\\n/g, '\n');
        const publicKey = config
          .getOrThrow<string>('JWT_PUBLIC_KEY')
          .replace(/\\n/g, '\n');
        const signingKey = createPrivateKey(privateKey);
        if (
          signingKey.asymmetricKeyType !== 'rsa' ||
          (signingKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
          !createPublicKey(signingKey).equals(createPublicKey(publicKey))
        ) {
          throw new Error(
            'JWT keys must be a matching RSA pair of at least 2048 bits',
          );
        }
        return {
          privateKey,
          publicKey,
          signOptions: {
            algorithm: 'RS256',
            expiresIn: ACCESS_TOKEN_TTL_SECONDS,
            issuer: 'user-service',
            audience: 'ft-transcendence-api',
          },
          verifyOptions: {
            algorithms: ['RS256'],
            issuer: 'user-service',
            audience: 'ft-transcendence-api',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard],
  exports: [AccessTokenGuard, JwtModule],
})
export class AuthModule {}
