import { IpDiscoverySource } from '../models/ip-discovery.model.js';

const parseCloudflareTrace = (body: string) => /^ip=(.+)$/m.exec(body)?.[1];
const parsePlainText = (body: string) => body.trim();

export const IP_DISCOVERY_SOURCES: IpDiscoverySource[] = [
  { name: 'Cloudflare', url: 'https://1.1.1.1/cdn-cgi/trace', parse: parseCloudflareTrace },
  { name: 'ipify', url: 'https://api.ipify.org', parse: parsePlainText },
  { name: 'AWS checkip', url: 'https://checkip.amazonaws.com', parse: parsePlainText },
];
export const IP_DISCOVERY_LOOKUP_TIMEOUT_MS = 1_500;
export const IP_DISCOVERY_TTL_MS = 5 * 60_000;
