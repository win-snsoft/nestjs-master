import { Logger } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import { NativeLogger } from 'nestjs-pino';
import { CliModule } from './cli.module.js';

async function bootstrap() {
  const app = await CommandFactory.createWithoutRunning(CliModule, {
    bufferLogs: true,
    serviceErrorHandler: (err) => {
      process.exitCode = 1;
      new Logger('Cli').error('Command failed', err);
    },
  });

  // Logging
  app.useLogger(app.get(NativeLogger));
  app.flushLogs();

  try {
    await CommandFactory.runApplication(app);
  } finally {
    await app.close();
  }
}

await bootstrap();
