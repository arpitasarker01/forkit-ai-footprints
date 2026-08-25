import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCensus } from './census';
import { ActivityMonitor } from './monitor';
import { startAiFootprintsServer } from './server';

test('local server owns one monitor independently of browser streams', async () => {
  let scanCount = 0;
  let now = 0;
  const localStateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'forkit-footprints-server-test-'));
  const monitor = new ActivityMonitor({ now: () => now, excludedRootPid: null, sampleProcesses: async () => [], intervalMs: 1000 });
  const nativeToken = 'n'.repeat(48);
  const service = await startAiFootprintsServer({
    port: 0,
    nativeToken,
    globalPermission: 'granted',
    monitor,
    localStateDirectory,
    scan: async () => {
      scanCount += 1;
      return runCensus({ includeRuntimes: false, includeFilesystem: false, includeAgents: false, includeTools: false, includeMcp: false, platform: 'darwin' });
    },
    recordScan: async (generatedAt) => ({ schema_version: '1.0', device_label: 'Local Test Mac', device_label_source: 'generic-mac', first_scan_at: generatedAt, last_scan_at: generatedAt, scan_count: scanCount }),
  });
  const origin = service.url.slice(0, -1);
  const headers = { origin, 'x-forkit-footprints-session': service.sessionToken };
  try {
    const page = await fetch(service.url);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /img-src data:/);
    assert.match(html, /Start Monitoring/);
    assert.match(html, /AI Activity Now/);
    assert.match(html, /Global AI mirror/);
    assert.match(html, /"global_permission":"granted"/);
    assert.doesNotMatch(html, />Discover</);
    assert.doesNotMatch(html, />Observe</);
    assert.doesNotMatch(html, />Evolution</);

    assert.equal((await fetch(`${service.url}api/monitor/start`, { method: 'POST' })).status, 403);
    assert.equal(service.monitor.snapshot().lifecycle, 'monitoring');
    const started = await fetch(`${service.url}api/monitor/start`, { method: 'POST', headers });
    assert.equal(started.status, 200);
    assert.equal((await started.json() as { lifecycle: string }).lifecycle, 'monitoring');

    const controller = new AbortController();
    const stream = await fetch(`${service.url}api/monitor/stream`, { method: 'POST', headers, signal: controller.signal });
    const reader = stream.body!.getReader();
    const first = await reader.read();
    const streamed = JSON.parse(new TextDecoder().decode(first.value).trim()) as { lifecycle: string; insights: string[] };
    assert.equal(streamed.lifecycle, 'monitoring');
    assert.deepEqual(streamed.insights, []);
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(service.monitor.snapshot().lifecycle, 'monitoring');
    assert.equal(service.server.listening, true);

    const preview = await fetch(`${service.url}api/contribution/preview`, { method: 'POST', headers });
    assert.equal(preview.status, 409);
    assert.match(JSON.stringify(await preview.json()), /MINIMUM_OBSERVATION/);

    const stopped = await fetch(`${service.url}api/monitor/stop`, { method: 'POST', headers });
    assert.equal((await stopped.json() as { lifecycle: string }).lifecycle, 'stopped');
    assert.equal(service.server.listening, true);

    const rescanned = await fetch(`${service.url}api/scan`, { method: 'POST', headers });
    assert.equal(rescanned.status, 200);
    assert.equal(scanCount, 2);

    const nativeStatus = await fetch(`${service.url}api/native/status`, {
      method: 'POST', headers: { 'x-forkit-footprints-native': nativeToken },
    });
    assert.equal(nativeStatus.status, 200);
    assert.equal((await nativeStatus.json() as { lifecycle: string }).lifecycle, 'stopped');
  } finally {
    await service.close();
    assert.equal(service.server.listening, false);
  }
});

test('native app opens a local loading view before the first full scan completes', async () => {
  let releaseScan!: () => void;
  const localStateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'forkit-footprints-opening-test-'));
  const scanGate = new Promise<void>((resolve) => { releaseScan = resolve; });
  const service = await startAiFootprintsServer({
    port: 0,
    deferInitialScan: true,
    localStateDirectory,
    scan: async () => {
      await scanGate;
      return runCensus({ includeRuntimes: false, includeFilesystem: false, includeAgents: false, includeTools: false, includeMcp: false, platform: 'darwin' });
    },
    recordScan: async (generatedAt) => ({ schema_version: '1.0', device_label: 'Local Test Mac', device_label_source: 'generic-mac', first_scan_at: generatedAt, last_scan_at: generatedAt, scan_count: 1 }),
  });
  const origin = service.url.slice(0, -1);
  const headers = { origin, 'x-forkit-footprints-session': service.sessionToken };
  try {
    const opening = await fetch(service.url);
    assert.equal(opening.status, 200);
    assert.match(await opening.text(), /Opening your AI Footprint/);
    const pending = await fetch(`${service.url}api/ready`, { method: 'POST', headers });
    assert.deepEqual(await pending.json(), { ready: false, failed: false });

    releaseScan();
    let ready = false;
    for (let attempt = 0; attempt < 20 && !ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const response = await fetch(`${service.url}api/ready`, { method: 'POST', headers });
      ready = Boolean((await response.json() as { ready: boolean }).ready);
    }
    assert.equal(ready, true);
    assert.match(await (await fetch(service.url)).text(), /Start Monitoring/);
    assert.equal(service.monitor.snapshot().lifecycle, 'monitoring');
  } finally {
    releaseScan();
    await service.close();
  }
});
