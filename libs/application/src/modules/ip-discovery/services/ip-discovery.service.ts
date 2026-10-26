import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { isIPv4 } from 'node:net';
import {
  IP_DISCOVERY_LOOKUP_TIMEOUT_MS,
  IP_DISCOVERY_SOURCES,
  IP_DISCOVERY_TTL_MS,
} from '../constants/ip-discovery.constant.js';

/**
 * Public IP this pod's traffic leaves with, as seen by the first IP_DISCOVERY_SOURCES entry that answers.
 * Looked up on use and remembered for IP_DISCOVERY_TTL_MS, then looked up again by the next caller
 *
 * @example
 * const ip = await ipDiscoveryService.getEgressIp(); // '123.45.67.890', or 'unknown' when the lookup failed
 */
@Injectable()
export class IpDiscoveryService {
  private logger = new Logger(IpDiscoveryService.name);
  private egressIp: Promise<string> | null = null;
  private expiresAt = 0;

  getEgressIp(): Promise<string> {
    if (!this.egressIp || Date.now() >= this.expiresAt) {
      this.egressIp = this.lookup();
      this.expiresAt = Date.now() + IP_DISCOVERY_TTL_MS;
    }
    return this.egressIp;
  }

  private async lookup(): Promise<string> {
    for (const source of IP_DISCOVERY_SOURCES) {
      try {
        const { data } = await axios.get<string>(source.url, {
          timeout: IP_DISCOVERY_LOOKUP_TIMEOUT_MS,
          responseType: 'text',
        });

        const ip = source.parse(data);
        if (!ip || !isIPv4(ip)) throw new Error('Source answer is not an IPv4 address');

        this.logger.log('Egress IP resolved', { ip, source: source.name });
        return ip;
      } catch (error: unknown) {
        this.logger.warn('Egress IP lookup failed', { source: source.name }, error);
      }
    }

    this.logger.warn('Egress IP lookup failed on every source, using unknown until next lookup');
    return 'unknown';
  }
}
