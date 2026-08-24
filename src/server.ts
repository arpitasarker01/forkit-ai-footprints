import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { runCensus } from './census';
import { classifyAgentProcessTrees } from './agents';
import { buildLocalScanView, renderCensusSharePage } from './share-page';
import { recordLocalScan, type LocalDeviceJournal } from './local-device';
import { ActivityMonitor, type MonitorSnapshot } from './monitor';
import { createDefaultProviders } from './providers';
import { classifyLoadedRuntimeProcesses, loadedRuntimeSignatures } from './runtime-activity';
import { buildAnonymousAiFootprintPreview } from './sharing';
import { buildLocalInsights } from './insights';
import type { CensusReport } from './types';
import { normalizeLocale, uiText, type UiLocale } from './localization';
import { createLocalWorkflowContextProvider } from './workflow-context';

export interface AiFootprintsServerOptions {
  hostname?: '127.0.0.1';
  port?: number;
  scan?: () => Promise<CensusReport>;
  recordScan?: (generatedAt: string) => Promise<LocalDeviceJournal>;
  monitor?: ActivityMonitor;
  nativeToken?: string | null;
  globalPermission?: 'granted' | 'declined' | 'unset';
  deferInitialScan?: boolean;
}

export interface AiFootprintsServer {
  server: http.Server;
  url: string;
  sessionToken: string;
  monitor: ActivityMonitor;
  close: () => Promise<void>;
}

interface MonitorStream {
  timer: NodeJS.Timeout;
  response: http.ServerResponse;
}

function securityHeaders(contentType: string): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    'content-type': contentType,
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
  };
}

function sendText(response: http.ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, securityHeaders(contentType));
  response.end(body);
}

function sendJson(response: http.ServerResponse, status: number, value: unknown): void {
  sendText(response, status, 'application/json; charset=utf-8', JSON.stringify(value));
}

function renderOpeningPage(sessionToken: string, locale: UiLocale): string {
  const title = uiText(locale, 'openingTitle');
  const detail = uiText(locale, 'openingCopy');
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Forkit AI Footprint</title><style>:root{color-scheme:light dark;--bg:#f3eee5;--card:#fffdf8;--ink:#282624;--muted:#716c64;--teal:#007f82}@media(prefers-color-scheme:dark){:root{--bg:#171817;--card:#232422;--ink:#f2ecdf;--muted:#aaa49a;--teal:#67beb8}}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 0 0,rgba(223,140,39,.15),transparent 32rem),radial-gradient(circle at 100% 0,rgba(0,128,128,.14),transparent 34rem),var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(680px,100%);padding:42px;border:1px solid color-mix(in srgb,var(--ink) 12%,transparent);border-radius:28px;background:var(--card);box-shadow:0 24px 70px rgba(36,32,28,.1)}.mark{display:grid;width:48px;height:48px;place-items:center;border-radius:15px;color:white;background:linear-gradient(145deg,var(--teal),#df8c27);font-size:20px;font-weight:900}.eyebrow{margin:28px 0 10px;color:var(--teal);font-size:11px;font-weight:850;letter-spacing:.16em;text-transform:uppercase}h1{margin:0;font-size:clamp(32px,6vw,52px);line-height:1;letter-spacing:-.05em}p{margin:18px 0 0;color:var(--muted);font-size:15px;line-height:1.6}.progress{height:7px;margin-top:28px;overflow:hidden;border-radius:999px;background:color-mix(in srgb,var(--ink) 10%,transparent)}.progress i{display:block;width:38%;height:100%;border-radius:inherit;background:var(--teal);animation:move 1.15s ease-in-out infinite alternate}@keyframes move{to{transform:translateX(165%)}}@media(max-width:520px){.card{padding:28px}}</style></head><body><main class="card"><div class="mark">F</div><p class="eyebrow">Forkit AI Footprint</p><h1>${title}</h1><p>${detail}</p><div class="progress" aria-label="${title}"><i></i></div></main><script>const token=${JSON.stringify(sessionToken)};async function ready(){try{const response=await fetch('/api/ready',{method:'POST',headers:{'x-forkit-footprints-session':token}});if(response.ok&&(await response.json()).ready){location.reload();return}}catch{}setTimeout(ready,250)}ready();</script></body></html>`;
}

export async function startAiFootprintsServer(options: AiFootprintsServerOptions = {}): Promise<AiFootprintsServer> {
  const hostname = options.hostname ?? '127.0.0.1';
  const requestedPort = options.port ?? 47811;
  const scan = options.scan ?? (() => runCensus());
  const recordScan = options.recordScan ?? ((generatedAt: string) => recordLocalScan({ now: () => new Date(generatedAt) }));
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const nativeToken = options.nativeToken ?? process.env.FORKIT_AI_FOOTPRINTS_NATIVE_TOKEN ?? null;
  const globalPermission = options.globalPermission
    ?? (process.env.FORKIT_AI_FOOTPRINTS_GLOBAL_PERMISSION === 'granted' ? 'granted'
      : process.env.FORKIT_AI_FOOTPRINTS_GLOBAL_PERMISSION === 'declined' ? 'declined' : 'unset');
  const deferInitialScan = options.deferInitialScan ?? process.env.FORKIT_AI_FOOTPRINTS_APP_BUNDLE === '1';
  const runtimeProviders = createDefaultProviders();
  let loadedRuntimeCache = new Set<string>();
  let loadedRuntimeCacheAt = 0;
  const monitor = options.monitor ?? new ActivityMonitor({
    context: createLocalWorkflowContextProvider(),
    classifyProcesses: async (entries) => {
      const now = Date.now();
      if (now - loadedRuntimeCacheAt >= 3000) {
        loadedRuntimeCache = await loadedRuntimeSignatures(runtimeProviders, new Date(now).toISOString());
        loadedRuntimeCacheAt = now;
      }
      return [
        ...classifyAgentProcessTrees(entries, process.pid),
        ...classifyLoadedRuntimeProcesses(entries, loadedRuntimeCache, process.pid),
      ];
    },
  });
  let currentReport: CensusReport | null = null;
  let localDevice: LocalDeviceJournal | null = null;
  let initialScanFailed = false;
  let scanning = deferInitialScan;
  const refreshReport = async () => {
    const nextReport = await scan();
    const nextDevice = await recordScan(nextReport.generated_at);
    nextReport.privacy.local_state_written = true;
    nextReport.privacy.local_state_scope = 'device-journal-only';
    currentReport = nextReport;
    localDevice = nextDevice;
  };
  if (!deferInitialScan) await refreshReport();
  const streams = new Set<MonitorStream>();
  let origin = '';
  let closing: Promise<void> | null = null;
  let currentLocale: UiLocale = 'en';

  function browserAuthorized(request: http.IncomingMessage): boolean {
    return request.headers.origin === origin
      && request.headers['x-forkit-footprints-session'] === sessionToken;
  }

  function nativeAuthorized(request: http.IncomingMessage): boolean {
    return typeof nativeToken === 'string' && nativeToken.length >= 32
      && request.headers['x-forkit-footprints-native'] === nativeToken;
  }

  function stopStreams(): void {
    for (const stream of streams) {
      clearInterval(stream.timer);
      stream.response.end();
    }
    streams.clear();
  }

  function browserSnapshot(snapshot: MonitorSnapshot = monitor.snapshot()): MonitorSnapshot & { insights: string[] } {
    return {
      ...snapshot,
      insights: buildLocalInsights(snapshot, {
        model_record_count: currentReport?.summary.model_count ?? 0,
        confirmed_running_model_count: currentReport?.summary.confirmed_running_model_count ?? 0,
      }, 60, currentLocale).map((insight) => insight.text),
    };
  }

  const server = http.createServer(async (request, response) => {
    const host = request.headers.host ?? '';
    if (!origin || host !== new URL(origin).host) {
      sendText(response, 421, 'text/plain; charset=utf-8', 'Invalid local host.');
      return;
    }

    const requestUrl = new URL(request.url ?? '/', origin);
    const pathname = requestUrl.pathname;
    if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const requestedLocale = requestUrl.searchParams.get('lang');
      currentLocale = requestedLocale === 'en' || requestedLocale === 'de'
        ? requestedLocale
        : normalizeLocale(request.headers['accept-language']);
      if (!currentReport || !localDevice) {
        sendText(response, 200, 'text/html; charset=utf-8', renderOpeningPage(sessionToken, currentLocale));
        return;
      }
      sendText(response, 200, 'text/html; charset=utf-8', renderCensusSharePage(currentReport, {
        localDeviceLabel: localDevice.device_label,
        locale: currentLocale,
        rescan: {
          endpoint: '/api/scan',
          monitor_start_endpoint: '/api/monitor/start',
          monitor_stop_endpoint: '/api/monitor/stop',
          monitor_stream_endpoint: '/api/monitor/stream',
          monitor_clear_endpoint: '/api/monitor/clear',
          contribution_preview_endpoint: '/api/contribution/preview',
          locale_endpoint: '/api/ui/locale',
          session_token: sessionToken,
          global_permission: globalPermission,
        },
      }));
      return;
    }

    const browserControl = pathname.startsWith('/api/') && browserAuthorized(request);
    const nativeControl = pathname.startsWith('/api/native/') && nativeAuthorized(request);

    if (request.method === 'POST' && pathname === '/api/ready') {
      if (!browserControl) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      sendJson(response, 200, { ready: Boolean(currentReport && localDevice), failed: initialScanFailed });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/monitor/stream') {
      if (!browserControl) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      response.writeHead(200, {
        ...securityHeaders('application/x-ndjson; charset=utf-8'),
        'content-security-policy': "default-src 'none'",
      });
      const send = () => response.write(`${JSON.stringify(browserSnapshot())}\n`);
      send();
      const timer = setInterval(send, 750);
      timer.unref();
      const stream = { timer, response };
      streams.add(stream);
      request.on('close', () => {
        clearInterval(timer);
        streams.delete(stream);
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/scan') {
      if (!browserControl) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      if (scanning) { sendJson(response, 409, { error: 'SCAN_IN_PROGRESS' }); return; }
      scanning = true;
      try {
        await refreshReport();
        initialScanFailed = false;
        if (!currentReport) throw new Error('LOCAL_SCAN_FAILED');
        sendJson(response, 200, buildLocalScanView(currentReport));
      } catch {
        sendJson(response, 500, { error: 'LOCAL_SCAN_FAILED' });
      } finally {
        scanning = false;
      }
      return;
    }

    const startPath = pathname === '/api/monitor/start' || pathname === '/api/native/start';
    if (request.method === 'POST' && startPath) {
      if (!(browserControl || nativeControl)) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      try {
        const snapshot = await monitor.start();
        sendJson(response, 200, nativeControl ? snapshot : browserSnapshot(snapshot));
      }
      catch { sendJson(response, 500, { error: 'MONITOR_START_FAILED' }); }
      return;
    }

    const stopPath = pathname === '/api/monitor/stop' || pathname === '/api/native/stop';
    if (request.method === 'POST' && stopPath) {
      if (!(browserControl || nativeControl)) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      const snapshot = monitor.stop();
      sendJson(response, 200, nativeControl ? snapshot : browserSnapshot(snapshot));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/monitor/clear') {
      if (!browserControl) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      sendJson(response, 200, browserSnapshot(monitor.clearHistory()));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/ui/locale') {
      if (!browserControl) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      let raw = '';
      for await (const chunk of request) {
        raw += String(chunk);
        if (raw.length > 128) { sendJson(response, 413, { error: 'INVALID_LOCALE' }); return; }
      }
      try {
        const value = JSON.parse(raw) as { locale?: unknown };
        if (value.locale !== 'en' && value.locale !== 'de') throw new Error('INVALID_LOCALE');
        currentLocale = value.locale;
        sendJson(response, 200, { locale: currentLocale });
      } catch { sendJson(response, 400, { error: 'INVALID_LOCALE' }); }
      return;
    }

    if (request.method === 'POST' && pathname === '/api/contribution/preview') {
      if (!browserControl) { sendJson(response, 403, { error: 'LOCAL_SESSION_REQUIRED' }); return; }
      if (!currentReport) { sendJson(response, 409, { error: 'LOCAL_SCAN_IN_PROGRESS' }); return; }
      try { sendJson(response, 200, buildAnonymousAiFootprintPreview(currentReport, monitor.snapshot())); }
      catch (error) {
        sendJson(response, 409, { error: error instanceof Error ? error.message : 'CONTRIBUTION_PREVIEW_UNAVAILABLE' });
      }
      return;
    }

    if (request.method === 'POST' && pathname === '/api/native/status') {
      if (!nativeControl) { sendJson(response, 403, { error: 'NATIVE_CONTROL_REQUIRED' }); return; }
      sendJson(response, 200, { ...monitor.snapshot(), ui_locale: currentLocale });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/native/quit') {
      if (!nativeControl) { sendJson(response, 403, { error: 'NATIVE_CONTROL_REQUIRED' }); return; }
      const summary: MonitorSnapshot = monitor.stop();
      sendJson(response, 200, summary);
      setImmediate(() => { void closeService(); });
      return;
    }

    sendText(response, 404, 'text/plain; charset=utf-8', 'Not found.');
  });

  async function listen(port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, hostname);
    });
  }

  try {
    await listen(requestedPort);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || requestedPort === 0) throw error;
    await listen(0);
  }
  const address = server.address() as AddressInfo;
  origin = `http://${hostname}:${address.port}`;

  if (deferInitialScan) {
    void refreshReport().catch(() => { initialScanFailed = true; }).finally(() => { scanning = false; });
  }

  function closeService(): Promise<void> {
    if (closing) return closing;
    closing = new Promise<void>((resolve, reject) => {
      monitor.stop();
      stopStreams();
      if (!server.listening) { resolve(); return; }
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections();
    });
    return closing;
  }

  return {
    server,
    url: `${origin}/`,
    sessionToken,
    monitor,
    close: closeService,
  };
}
