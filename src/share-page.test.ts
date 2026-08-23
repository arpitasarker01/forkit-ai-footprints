import assert from 'node:assert/strict';
import test from 'node:test';
import { runCensus } from './census';
import { buildCensusShareSnapshot, buildLocalScanView, renderCensusSharePage } from './share-page';

async function emptyReport() {
  return runCensus({ includeRuntimes: false, includeFilesystem: false, includeAgents: false, includeTools: false, includeMcp: false });
}

test('storage uses correct decimal and binary unit labels', async () => {
  const report = await emptyReport();
  report.system = { platform: 'darwin', architecture: 'arm64', node_major: 24 };
  report.summary.storage_bytes = 2_600_071_742;
  report.summary.storage_file_count = 12;
  const snapshot = buildCensusShareSnapshot(report);
  assert.equal(snapshot.model_storage_decimal_display, '2.60 GB');
  assert.equal(snapshot.model_storage_binary_display, '2.42 GiB');
  assert.equal(snapshot.model_storage_display, '2.60 GB · 2.42 GiB');
});

test('one-page app puts truthful activity before footprint and comparison', async () => {
  const report = await emptyReport();
  const html = renderCensusSharePage(report, {
    localDeviceLabel: 'Studio Test Mac',
    rescan: {
      endpoint: '/api/scan',
      monitor_start_endpoint: '/api/monitor/start',
      monitor_stop_endpoint: '/api/monitor/stop',
      monitor_stream_endpoint: '/api/monitor/stream',
      monitor_clear_endpoint: '/api/monitor/clear',
      contribution_preview_endpoint: '/api/contribution/preview',
      session_token: 'a'.repeat(48),
    },
  });
  assert.match(html, /AI activity now/);
  assert.match(html, /Monitoring is off/);
  assert.match(html, /Start Monitoring/);
  assert.match(html, /OPEN \/ IDLE/);
  assert.match(html, /NOT RUNNING/);
  assert.match(html, /Guess, then reveal/);
  assert.match(html, /Optional global comparison/);
  assert.match(html, /Share aggregates &amp; see my rank/);
  assert.match(html, /Keep everything local/);
  assert.match(html, /Technical details/);
  assert.match(html, /Studio Test Mac/);
  assert.doesNotMatch(html, />Discover</);
  assert.doesNotMatch(html, />Observe</);
  assert.doesNotMatch(html, />Evolution</);
  assert.doesNotMatch(html, /Measure one AI task/);
  assert.doesNotMatch(html, /loaded\/online state/i);
  const inlineScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(inlineScript);
  assert.doesNotThrow(() => new Function(inlineScript));
});

test('interactive detail names never enter share words or share canvas data', async () => {
  const report = await emptyReport();
  const sentinel = 'PRIVATE_APP_AND_CHAT_DO_NOT_SHARE';
  report.agents = [{
    agent_id: 'agent_test', name: sentinel, signature: 'private', kind: 'coding-agent', confidence: 'high',
    instance_count: 1, executable_names: ['private'], evidence_hashes: ['hash'], detection_reason: 'exact_executable_match',
    evidence_status: 'online', resource_snapshot: { cpu_percent: 1, memory_percent: 1, measurement: 'point-in-time-process-metadata' },
  }];
  const local = buildLocalScanView(report);
  assert.equal(local.local_details.agents[0]?.name, sentinel);
  const html = renderCensusSharePage(report, {
    rescan: {
      endpoint: '/api/scan', monitor_start_endpoint: '/api/monitor/start', monitor_stop_endpoint: '/api/monitor/stop',
      monitor_stream_endpoint: '/api/monitor/stream', monitor_clear_endpoint: '/api/monitor/clear', contribution_preview_endpoint: '/api/contribution/preview', session_token: 'b'.repeat(48),
    },
  });
  assert.match(html, new RegExp(sentinel));
  const shareFunction = html.slice(html.indexOf('function shareWords'), html.indexOf('function draw'));
  const drawFunction = html.slice(html.indexOf('function draw'), html.indexOf("$('guess-form')"));
  assert.doesNotMatch(shareFunction, /local_details|products|context|\.name/);
  assert.doesNotMatch(drawFunction, /local_details|products|context|\.name/);
  assert.doesNotMatch(shareFunction, new RegExp(sentinel));
});

test('saved aggregate page is self-contained and exposes no item names', async () => {
  const report = await emptyReport();
  const sentinel = 'PRIVATE_MODEL_DO_NOT_RENDER';
  report.models = [{ name: sentinel }] as unknown as typeof report.models;
  const html = renderCensusSharePage(report);
  assert.match(html, /Forkit AI Footprints/);
  assert.match(html, /canvas[^>]+width="1200" height="630"/);
  assert.doesNotMatch(html, new RegExp(sentinel));
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /[a-f0-9]{48}/);
});

test('local controls reject external endpoints and weak tokens', async () => {
  const report = await emptyReport();
  assert.throws(() => renderCensusSharePage(report, {
    rescan: {
      endpoint: 'https://example.com/scan', monitor_start_endpoint: '/api/monitor/start', monitor_stop_endpoint: '/api/monitor/stop',
      monitor_stream_endpoint: '/api/monitor/stream', monitor_clear_endpoint: '/api/monitor/clear', contribution_preview_endpoint: '/api/contribution/preview', session_token: 'weak',
    },
  }), /INVALID_LOCAL_RESCAN_OPTIONS/);
});
