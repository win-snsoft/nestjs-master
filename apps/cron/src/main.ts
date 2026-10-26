import 'zod/compile';
import '@framework/trace/register.js';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { CronModule } from './cron.module.js';
import { NativeLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(CronModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();

  app.useLogger(app.get(NativeLogger));
  const logger = new Logger('Server');
  app.flushLogs();

  await app.listen(3000);
  logger.log('Cron service is running');
}
await bootstrap();
