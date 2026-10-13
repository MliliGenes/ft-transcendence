import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { CustomOrigin } from '@nestjs/common/internal';
import { AppModule } from './app/app.module.js';
import { trustedBrowserOrigins } from './auth/browser-origin.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const allowedOrigins = trustedBrowserOrigins(config);
  const corsOrigin: CustomOrigin = (origin, callback) =>
    callback(null, !origin || allowedOrigins.has(origin));
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
