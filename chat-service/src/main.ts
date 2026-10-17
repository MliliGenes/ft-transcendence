import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { getPort } from './port.js';

async function bootstrap() {
  const port = getPort(process.env.PORT);
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  await app.listen(port);
}
await bootstrap();
