import { Module } from '@nestjs/common';
import { IpDiscoveryService } from './services/ip-discovery.service.js';

@Module({
  providers: [IpDiscoveryService],
  exports: [IpDiscoveryService],
})
export class IpDiscoveryModule {}
