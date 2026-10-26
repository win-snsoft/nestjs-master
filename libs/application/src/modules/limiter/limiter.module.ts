import { Module } from '@nestjs/common';
import { IpDiscoveryModule } from '@application/modules/ip-discovery/index.js';
import { MongoSchemaModule } from './schemas/index.js';
import { LimiterPoolRepository } from './repositories/limiter-pool.repository.js';
import { LimiterPoolCache } from './caches/limiter-pool.cache.js';
import { LimiterPoolService } from './services/limiter-pool.service.js';
import { LimiterService } from './services/limiter.service.js';
import { LimiterSignalBroadcaster } from './signals/limiter-signal.broadcaster.js';

const Repositories = [LimiterPoolRepository];
const Services = [LimiterService, LimiterPoolService];
const Providers = [LimiterPoolCache, LimiterSignalBroadcaster];

@Module({
  imports: [MongoSchemaModule, IpDiscoveryModule],
  exports: [...Services],
  providers: [...Repositories, ...Services, ...Providers],
})
export class LimiterModule {}
