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
  observeSample?: () => Promise<CensusReport>;
}

export interface AiFootprintsServer {
  server: http.Server;
  url: string;
  sessionToken: string;
  close: () => Promise<void>;
}

interface ObservationSample {
  cpuPercent: number | null;
  memoryPercent: number | null;
  agentProducts: number;
  agentProcesses: number;
  loadedModels: number;
}

interface ObservationState {
  startedAt: number;
  samples: ObservationSample[];
  timer: NodeJS.Timeout | null;
  sampling: boolean;
}

function average(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null);
  if (measured.length === 0) return null;
  return Math.round((measured.reduce((total, value) => total + value, 0) / measured.length) * 10) / 10;
}

function peak(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null);
  return measured.length === 0 ? null : Math.round(Math.max(...measured) * 10) / 10;
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
  const observeSample = options.observeSample ?? (() => runCensus({
    includeFilesystem: false,
    includeTools: false,
    includeMcp: false,
  }));
  const sessionToken = crypto.randomBytes(24).toString('hex');
  let currentReport = await scan();
  let scanning = false;
  let observation: ObservationState | null = null;
  let origin = '';

  async function takeObservationSample(state: ObservationState): Promise<void> {
    if (state.sampling) return;
    state.sampling = true;
    try {
      const report = await observeSample();
      state.samples.push({
        cpuPercent: report.summary.agent_cpu_percent,
        memoryPercent: report.summary.agent_memory_percent,
        agentProducts: report.summary.agent_product_count,
        agentProcesses: report.summary.agent_process_count,
        loadedModels: report.summary.confirmed_running_model_count,
      });
    } finally {
      state.sampling = false;
    }
  }

  function authorized(request: http.IncomingMessage): boolean {
    return request.headers.origin === origin
      && request.headers['x-forkit-footprints-session'] === sessionToken;
  }

  const server = http.createServer(async (request, response) => {
    const host = request.headers.host ?? '';
    if (host !== new URL(origin).host) {
      sendText(response, 421, 'text/plain; charset=utf-8', 'Invalid local host.');
      return;
    }

    const pathname = new URL(request.url ?? '/', origin).pathname;
    if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      sendText(response, 200, 'text/html; charset=utf-8', renderCensusSharePage(currentReport, {
        rescan: {
          endpoint: '/api/scan',
          stop_endpoint: '/api/stop',
          observe_start_endpoint: '/api/observe/start',
          observe_stop_endpoint: '/api/observe/stop',
          session_token: sessionToken,
        },
      }));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/scan') {
      if (!authorized(request)) {
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

    if (request.method === 'POST' && pathname === '/api/observe/start') {
      if (!authorized(request)) {
        sendText(response, 403, 'application/json; charset=utf-8', JSON.stringify({ error: 'LOCAL_SESSION_REQUIRED' }));
        return;
      }
      if (observation) {
        sendText(response, 409, 'application/json; charset=utf-8', JSON.stringify({ error: 'OBSERVATION_IN_PROGRESS' }));
        return;
      }
      const state: ObservationState = { startedAt: Date.now(), samples: [], timer: null, sampling: false };
      observation = state;
      try {
        await takeObservationSample(state);
        state.timer = setInterval(() => { void takeObservationSample(state); }, 1000);
        sendText(response, 202, 'application/json; charset=utf-8', JSON.stringify({ started: true }));
      } catch {
        observation = null;
        sendText(response, 500, 'application/json; charset=utf-8', JSON.stringify({ error: 'OBSERVATION_START_FAILED' }));
      }
      return;
    }

    if (request.method === 'POST' && pathname === '/api/observe/stop') {
      if (!authorized(request)) {
        sendText(response, 403, 'application/json; charset=utf-8', JSON.stringify({ error: 'LOCAL_SESSION_REQUIRED' }));
        return;
      }
      const state = observation;
      if (!state) {
        sendText(response, 409, 'application/json; charset=utf-8', JSON.stringify({ error: 'NO_OBSERVATION_IN_PROGRESS' }));
        return;
      }
      if (state.timer) clearInterval(state.timer);
      try { await takeObservationSample(state); } catch { /* keep completed samples */ }
      observation = null;
      const durationSeconds = Math.max(0.1, Math.round(((Date.now() - state.startedAt) / 1000) * 10) / 10);
      sendText(response, 200, 'application/json; charset=utf-8', JSON.stringify({
        measurement: 'user-timed-detected-agent-window',
        duration_seconds: durationSeconds,
        sample_count: state.samples.length,
        average_cpu_percent: average(state.samples.map((sample) => sample.cpuPercent)),
        peak_cpu_percent: peak(state.samples.map((sample) => sample.cpuPercent)),
        average_memory_percent: average(state.samples.map((sample) => sample.memoryPercent)),
        peak_memory_percent: peak(state.samples.map((sample) => sample.memoryPercent)),
        max_agent_products: Math.max(0, ...state.samples.map((sample) => sample.agentProducts)),
        max_agent_processes: Math.max(0, ...state.samples.map((sample) => sample.agentProcesses)),
        max_loaded_models: Math.max(0, ...state.samples.map((sample) => sample.loadedModels)),
        external_requests_made: 0,
        limitation: 'Measures detected agent processes during this window; shared-process background activity can be included.',
      }));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/stop') {
      if (!authorized(request)) {
        sendText(response, 403, 'application/json; charset=utf-8', JSON.stringify({ error: 'LOCAL_SESSION_REQUIRED' }));
        return;
      }
      if (observation?.timer) clearInterval(observation.timer);
      observation = null;
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
      if (observation?.timer) clearInterval(observation.timer);
      observation = null;
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
