import 'zod/compile';
import '@framework/trace/register.js';
import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType, INestApplication } from '@nestjs/common';
import { NativeLogger } from 'nestjs-pino';
import { ApiModule } from './messaging-api.module.js';
import { API_ENV_TOKEN, ApiEnv } from './config/index.js';
import { DEFAULT_OPTIONS } from '@framework/scalar/index.js';
import { buildOpenApiDocument } from './openapi/index.js';
import { apiReference } from '@scalar/nestjs-api-reference';
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown';
import { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule, {
    bufferLogs: true,
  });
  const env = app.get<ApiEnv>(API_ENV_TOKEN);
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
  logger.log('API documentation is hosted', { url: `http://localhost:${env.PORT}/api` });
  logger.log('LLM Text is hosted', { url: `http://localhost:${env.PORT}/llms.txt` });
}

async function setupApiDocumentation(app: INestApplication) {
  const document = buildOpenApiDocument(app);
  const markdown = await createMarkdownFromOpenApi(JSON.stringify(document));

  app.use('/api', apiReference({ content: document, ...DEFAULT_OPTIONS }));

  const http = app.getHttpAdapter();
  http.get('/llms.txt', (req: Request, res: Response) => res.type('txt').send(markdown));
}

await bootstrap();
