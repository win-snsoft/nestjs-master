import 'zod/compile';
import '@framework/trace/register.js';
import { NestFactory } from '@nestjs/core';
import { LogConsumerModule } from './log-consumer.module.js';
import { NativeLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(LogConsumerModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();
  app.useLogger(app.get(NativeLogger));
  app.flushLogs();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
