import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { saveOpenApiDocument } from '@framework/openapi/index.js';
import { ApiModule } from '../messaging-api.module.js';
import { buildOpenApiDocument } from './build-openapi.js';

async function generate() {
  const app = await NestFactory.create(ApiModule, { preview: true, logger: false });
  app.enableVersioning({ type: VersioningType.URI });

  const document = buildOpenApiDocument(app);
  saveOpenApiDocument(document, 'apps/messaging-api/src/openapi/openapi.json');

  await app.close();
}

await generate();
