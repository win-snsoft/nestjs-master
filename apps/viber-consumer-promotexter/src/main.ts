import 'zod/compile';
import '@framework/trace/register.js';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ViberConsumerPromotexterModule } from './viber-consumer-promotexter.module.js';
import { CONSUMER_ENV_TOKEN, ConsumerEnv } from './env.js';
import { NativeLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(ViberConsumerPromotexterModule, {
    bufferLogs: true,
  });

  const env = app.get<ConsumerEnv>(CONSUMER_ENV_TOKEN);
  app.enableShutdownHooks();
  app.useLogger(app.get(NativeLogger));
  const logger = new Logger('Server');
  app.flushLogs();

  await app.listen(env.PORT);
  logger.log(`Viber Promotexter consumer is running on port ${env.PORT}`);
}
await bootstrap();
