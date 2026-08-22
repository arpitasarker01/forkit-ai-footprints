import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { runCensus } from './census';
import { buildCensusShareSnapshot, renderCensusSharePage } from './share-page';
import type { CensusReport } from './types';

export interface AiFootprintsServerOptions {
  hostname?: '127.0.0.1';
  port?: number;
  scan?: () => Promise<CensusReport>;
}

export interface AiFootprintsServer {
  server: http.Server;
  url: string;
  sessionToken: string;
  close: () => Promise<void>;
}

function sendText(response: http.ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'content-type': contentType,
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  response.end(body);
}

export async function startAiFootprintsServer(options: AiFootprintsServerOptions = {}): Promise<AiFootprintsServer> {
  const hostname = options.hostname ?? '127.0.0.1';
  const port = options.port ?? 47811;
  const scan = options.scan ?? (() => runCensus());
  const sessionToken = crypto.randomBytes(24).toString('hex');
  let currentReport = await scan();
  let scanning = false;
  let origin = '';

  const server = http.createServer(async (request, response) => {
    const host = request.headers.host ?? '';
    if (host !== new URL(origin).host) {
      sendText(response, 421, 'text/plain; charset=utf-8', 'Invalid local host.');
      return;
    }

    const pathname = new URL(request.url ?? '/', origin).pathname;
    if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      sendText(response, 200, 'text/html; charset=utf-8', renderCensusSharePage(currentReport, {
        rescan: { endpoint: '/api/scan', stop_endpoint: '/api/stop', session_token: sessionToken },
      }));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/scan') {
      const requestOrigin = request.headers.origin;
      if (requestOrigin !== origin || request.headers['x-forkit-footprints-session'] !== sessionToken) {
        sendText(response, 403, 'application/json; charset=utf-8', JSON.stringify({ error: 'LOCAL_SESSION_REQUIRED' }));
        return;
      }
      if (scanning) {
        sendText(response, 409, 'application/json; charset=utf-8', JSON.stringify({ error: 'SCAN_IN_PROGRESS' }));
        return;
      }
      scanning = true;
      try {
        currentReport = await scan();
        sendText(response, 200, 'application/json; charset=utf-8', JSON.stringify(buildCensusShareSnapshot(currentReport)));
      } catch {
        sendText(response, 500, 'application/json; charset=utf-8', JSON.stringify({ error: 'LOCAL_SCAN_FAILED' }));
      } finally {
        scanning = false;
      }
      return;
    }

    if (request.method === 'POST' && pathname === '/api/stop') {
      const requestOrigin = request.headers.origin;
      if (requestOrigin !== origin || request.headers['x-forkit-footprints-session'] !== sessionToken) {
        sendText(response, 403, 'application/json; charset=utf-8', JSON.stringify({ error: 'LOCAL_SESSION_REQUIRED' }));
        return;
      }
      sendText(response, 200, 'application/json; charset=utf-8', JSON.stringify({ stopped: true }));
      setImmediate(() => server.close());
      return;
    }

    sendText(response, 404, 'text/plain; charset=utf-8', 'Not found.');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, hostname, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  origin = `http://${hostname}:${address.port}`;

  return {
    server,
    url: `${origin}/`,
    sessionToken,
    close: () => new Promise<void>((resolve, reject) => {
      if (!server.listening) { resolve(); return; }
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
