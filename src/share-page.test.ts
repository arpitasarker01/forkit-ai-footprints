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
      locale_endpoint: '/api/ui/locale',
      session_token: 'a'.repeat(48),
    },
  });
  assert.match(html, /AI activity now/);
  assert.match(html, /Ready to observe/);
  assert.match(html, /Start Monitoring/);
  assert.match(html, /Your Footprint is taking shape/);
  assert.match(html, /Every observed minute adds more detail to your AI Footprint/);
  assert.doesNotMatch(html, /Guess, then reveal/);
  assert.match(html, /Your AI Footprint/);
  assert.match(html, /Optional global comparison/);
  assert.match(html, /How does your AI activity compare\?/);
  assert.match(html, /Explore your position among participating Forkit observations/);
  assert.match(html, /See my global position/);
  assert.match(html, /Share aggregates &amp; compare/);
  assert.match(html, /Keep everything local/);
  assert.match(html, /Technical details/);
  assert.match(html, /How Forkit measures/);
  assert.match(html, /AI activity/);
  assert.match(html, /Studio Test Mac/);
  assert.doesNotMatch(html, />Discover</);
  assert.doesNotMatch(html, />Observe</);
  assert.doesNotMatch(html, />Evolution</);
  assert.doesNotMatch(html, /Measure one AI task/);
  assert.doesNotMatch(html, /loaded\/online state/i);
  assert.doesNotMatch(html, /NOT RUNNING|OPEN \/ IDLE|no model loaded|Detected · not running|No verified local engine|No supported model record|No supported app or tool/i);
  const inlineScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(inlineScript);
  assert.doesNotThrow(() => new Function(inlineScript));
});

test('share output excludes private context even when supported tool names are allowed', async () => {
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
      monitor_stream_endpoint: '/api/monitor/stream', monitor_clear_endpoint: '/api/monitor/clear', contribution_preview_endpoint: '/api/contribution/preview', locale_endpoint: '/api/ui/locale', session_token: 'b'.repeat(48),
    },
  });
  assert.match(html, new RegExp(sentinel));
  const shareFunction = html.slice(html.indexOf('function shareWords'), html.indexOf('function draw'));
  const drawFunction = html.slice(html.indexOf('function draw'), html.indexOf("for(const next of ['en','de'])"));
  assert.doesNotMatch(shareFunction, /local_details|context|chat|workspace|device_label/);
  assert.doesNotMatch(drawFunction, /local_details|context|chat|workspace|device_label/);
  assert.doesNotMatch(shareFunction, new RegExp(sentinel));
});

test('comparison never renders a fabricated percentile or worldwide-user claim', async () => {
  const html = renderCensusSharePage(await emptyReport(), {
    rescan: {
      endpoint: '/api/scan', monitor_start_endpoint: '/api/monitor/start', monitor_stop_endpoint: '/api/monitor/stop',
      monitor_stream_endpoint: '/api/monitor/stream', monitor_clear_endpoint: '/api/monitor/clear', contribution_preview_endpoint: '/api/contribution/preview', locale_endpoint: '/api/ui/locale', session_token: 'c'.repeat(48),
    },
  });
  assert.doesNotMatch(html, /Top \d+%/i);
  assert.doesNotMatch(html, /AI users worldwide/i);
  assert.match(html, /Global contribution is not available in this version/);
  const clickHandler = html.slice(html.indexOf("$('review-payload').addEventListener('click'"));
  assert.match(clickHandler, /config\.contribution_preview_endpoint/);
});

test('saved aggregate page is self-contained and exposes no item names', async () => {
  const report = await emptyReport();
  const sentinel = 'PRIVATE_MODEL_DO_NOT_RENDER';
  report.models = [{ name: sentinel }] as unknown as typeof report.models;
  const html = renderCensusSharePage(report);
  assert.match(html, /Forkit AI Footprint/);
  assert.match(html, /canvas[^>]+width="1080" height="1080"/);
  assert.doesNotMatch(html, new RegExp(sentinel));
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /[a-f0-9]{48}/);
});

test('German GUI and square share export are localized from the same product copy', async () => {
  const html = renderCensusSharePage(await emptyReport(), { locale: 'de' });
  assert.match(html, /lang="de"/);
  assert.match(html, /KI-Aktivität jetzt/);
  assert.match(html, /Monitoring starten/);
  assert.match(html, /Wie lässt sich Ihre KI-Aktivität vergleichen\?/);
  assert.match(html, /Ihr Footprint nimmt Gestalt an/);
  assert.match(html, /PNG speichern/);
  assert.match(html, /Bild kopieren/);
  assert.match(html, /width="1080" height="1080"/);
});

test('local controls reject external endpoints and weak tokens', async () => {
  const report = await emptyReport();
  assert.throws(() => renderCensusSharePage(report, {
    rescan: {
      endpoint: 'https://example.com/scan', monitor_start_endpoint: '/api/monitor/start', monitor_stop_endpoint: '/api/monitor/stop',
      monitor_stream_endpoint: '/api/monitor/stream', monitor_clear_endpoint: '/api/monitor/clear', contribution_preview_endpoint: '/api/contribution/preview', locale_endpoint: '/api/ui/locale', session_token: 'weak',
    },
  }), /INVALID_LOCAL_RESCAN_OPTIONS/);
});
