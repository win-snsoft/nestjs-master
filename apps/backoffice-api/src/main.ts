import 'zod/compile';
import '@framework/trace/register.js';
import { NestFactory } from '@nestjs/core';
import { INestApplication, Logger, VersioningType } from '@nestjs/common';
import { BackofficeApiModule } from './backoffice-api.module.js';
import { NativeLogger } from 'nestjs-pino';
import { ENV_TOKEN, Env } from './env.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DEFAULT_OPTIONS } from '@framework/scalar/index.js';
import PackageInfo from '@package' with { type: 'json' };
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { apiReference } from '@scalar/nestjs-api-reference';
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown';
import { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(BackofficeApiModule, {
    bufferLogs: true,
  });
  const env = app.get<Env>(ENV_TOKEN);
  app.enableShutdownHooks();

  // Logging
  app.useLogger(app.get(NativeLogger));
  const logger = new Logger('Server');
  app.flushLogs();

  // API documentation
  app.enableVersioning({ type: VersioningType.URI });
  await setupApiDocumentation(app);

  await app.listen(env.PORT);
  logger.log(`Server is running`, { url: `http://localhost:${env.PORT}` });
  logger.log(`APIs documentation is hosted`, { url: `http://localhost:${env.PORT}/reference` });
  logger.log('LLM Text is hosted', { url: `http://localhost:${env.PORT}/llms.txt` });
}

async function setupApiDocumentation(app: INestApplication) {
  const openApiDoc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Backoffice API')
      .setDescription('Documentation for APIs for backoffice')
      .setVersion(PackageInfo.version)
      .build(),
  );
  const content = cleanupOpenApiDoc(openApiDoc);
  const markdown = await createMarkdownFromOpenApi(JSON.stringify(content));

  app.use(
    '/reference',
    apiReference({
      content,
      ...DEFAULT_OPTIONS,
    }),
  );

  const http = app.getHttpAdapter();
  http.get('/llms.txt', (req: Request, res: Response) => res.type('txt').send(markdown));
}

await bootstrap();
