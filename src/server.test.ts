import assert from 'node:assert/strict';
import test from 'node:test';
import { runCensus } from './census';
import { startAiFootprintsServer } from './server';

test('local server exposes aggregate HTML and token-gated metadata-only rescans', async () => {
  let scanCount = 0;
  const service = await startAiFootprintsServer({
    port: 0,
    scan: async () => {
      scanCount += 1;
      return runCensus({
        includeRuntimes: false,
        includeFilesystem: false,
        includeAgents: false,
        includeTools: false,
        includeMcp: false,
      });
    },
    observeSample: async () => runCensus({
      includeRuntimes: false,
      includeFilesystem: false,
      includeAgents: false,
      includeTools: false,
      includeMcp: false,
    }),
    recordScan: async (generatedAt) => ({
      schema_version: '1.0',
      device_label: 'Local Test Mac',
      device_label_source: 'generic-mac',
      first_scan_at: generatedAt,
      last_scan_at: generatedAt,
      scan_count: scanCount,
    }),
  });
  try {
    const pageResponse = await fetch(service.url);
    const html = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(html, /The scan is complete\. Guess before the local facts are revealed\./);
    assert.match(html, /Scan again/);
    assert.match(html, /Measure one AI task/);
    assert.match(html, /Local Test Mac/);
    assert.doesNotMatch(html, /https:\/\//i);

    const rejected = await fetch(`${service.url}api/scan`, { method: 'POST' });
    assert.equal(rejected.status, 403);

    const accepted = await fetch(`${service.url}api/scan`, {
      method: 'POST',
      headers: {
        origin: service.url.slice(0, -1),
        'x-forkit-footprints-session': service.sessionToken,
      },
    });
    const snapshot = await accepted.json() as Record<string, unknown>;
    assert.equal(accepted.status, 200);
    assert.equal(snapshot.external_request_count, 0);
    assert.equal(scanCount, 2);

    const observationHeaders = {
      origin: service.url.slice(0, -1),
      'x-forkit-footprints-session': service.sessionToken,
    };
    const liveAbort = new AbortController();
    const liveResponse = await fetch(`${service.url}api/live`, {
      method: 'POST', headers: observationHeaders, signal: liveAbort.signal,
    });
    assert.equal(liveResponse.status, 200);
    const liveReader = liveResponse.body!.getReader();
    const liveChunk = await liveReader.read();
    const live = JSON.parse(new TextDecoder().decode(liveChunk.value).trim()) as Record<string, unknown>;
    assert.equal(live.measurement, 'bounded-near-real-time-loopback');
    assert.equal(live.external_requests_made, 0);
    const observationStarted = await fetch(`${service.url}api/observe/start`, {
      method: 'POST', headers: observationHeaders,
    });
    assert.equal(observationStarted.status, 202);
    const observationStopped = await fetch(`${service.url}api/observe/stop`, {
      method: 'POST', headers: observationHeaders,
    });
    const observation = await observationStopped.json() as Record<string, unknown>;
    assert.equal(observationStopped.status, 200);
    assert.equal(observation.measurement, 'user-timed-detected-agent-window');
    assert.equal(observation.external_requests_made, 0);
    const evidence = observation.evidence_manifest as { capabilities: Array<{ metric: string; exclusive_task_proof: boolean }> };
    assert.equal(evidence.capabilities.every((entry) => entry.exclusive_task_proof === false), true);
    assert.equal(evidence.capabilities.some((entry) => entry.metric === 'gpu'), true);
    assert.ok(Number(observation.sample_count) >= 1);

    const stopped = await fetch(`${service.url}api/stop`, {
      method: 'POST',
      headers: {
        origin: service.url.slice(0, -1),
        'x-forkit-footprints-session': service.sessionToken,
      },
    });
    assert.equal(stopped.status, 200);
    let liveClosed = false;
    for (let attempt = 0; attempt < 3 && !liveClosed; attempt += 1) {
      liveClosed = (await liveReader.read()).done;
    }
    assert.equal(liveClosed, true);
    liveAbort.abort();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(service.server.listening, false);
  } finally {
    await service.close();
  }
});
