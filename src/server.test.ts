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
  });
  try {
    const pageResponse = await fetch(service.url);
    const html = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(html, /The scan is complete\. Guess before the local facts are revealed\./);
    assert.match(html, /Scan again/);
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

    const stopped = await fetch(`${service.url}api/stop`, {
      method: 'POST',
      headers: {
        origin: service.url.slice(0, -1),
        'x-forkit-footprints-session': service.sessionToken,
      },
    });
    assert.equal(stopped.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(service.server.listening, false);
  } finally {
    await service.close();
  }
});
