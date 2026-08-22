import { stableId } from './hash';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface SafeEndpoint {
  url: string;
  display: string;
  id: string;
}

export function parseLoopbackEndpoint(input: string): SafeEndpoint | null {
  try {
    const parsed = new URL(String(input || '').trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!LOOPBACK_HOSTS.has(parsed.hostname)) return null;
    parsed.hash = '';
    parsed.search = '';
    const displayPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    parsed.pathname = displayPath;
    const url = parsed.toString().replace(/\/$/, '');
    const displayHost = parsed.hostname === '::1' ? '[::1]' : parsed.hostname;
    const display = `${parsed.protocol}//${displayHost}${parsed.port ? `:${parsed.port}` : ''}${displayPath}`;
    return {
      url,
      display,
      id: stableId('endpoint', display),
    };
  } catch {
    return null;
  }
}

export function parseLoopbackEndpointList(input: string): SafeEndpoint[] {
  const seen = new Set<string>();
  const endpoints: SafeEndpoint[] = [];
  for (const candidate of String(input || '').split(/[\n,]/)) {
    const endpoint = parseLoopbackEndpoint(candidate);
    if (!endpoint || seen.has(endpoint.url)) continue;
    seen.add(endpoint.url);
    endpoints.push(endpoint);
  }
  return endpoints;
}
