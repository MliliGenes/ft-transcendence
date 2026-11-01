import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const publicKey = config
          .getOrThrow<string>('JWT_PUBLIC_KEY')
          .replace(/\\n/g, '\n');

        return {
          publicKey,
          verifyOptions: {
            algorithms: ['RS256'],
            issuer: 'user-service',
            audience: 'ft-transcendence-api',
          },
        }
      }
    }),
  ],
  exports: [JwtModule],
})
        
export class AuthModule {}
