/**
 * A public service that answers with the IP the request came from
 *
 * @example { name: 'Cloudflare 1.1.1.1', url: 'https://1.1.1.1/cdn-cgi/trace', parse: (body) => /^ip=(.+)$/m.exec(body)?.[1] }
 */
export interface IpDiscoverySource {
  name: string;
  url: string;
  parse: (body: string) => string | undefined;
}
