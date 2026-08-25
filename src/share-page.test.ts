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
  assert.match(html, /AI Activity Now/);
  assert.match(html, /Your AI Scorecard/);
  assert.match(html, /Monitoring locally/);
  assert.match(html, /Nothing uploaded/);
  assert.match(html, /Ready to observe/);
  assert.match(html, /Start Monitoring/);
  assert.doesNotMatch(html, /Guess, then reveal/);
  assert.match(html, /AI Activity Timeline/);
  assert.match(html, /Working and idle blocks from this observation/);
  assert.match(html, /Longest active block/);
  assert.match(html, /timeline-selected/);
  assert.match(html, /AI-active Ratio/);
  assert.match(html, /AI-active time compared with idle observed time/);
  assert.match(html, /Mostly active/);
  assert.match(html, /Mixed activity/);
  assert.match(html, /Mostly idle/);
  assert.match(html, /Select a timeline block to inspect it/);
  assert.match(html, /timelineDetail/);
  assert.match(html, /AI-active/);
  assert.match(html, /Idle/);
  assert.match(html, /What Forkit noticed/);
  assert.match(html, /Hosted vs Local AI/);
  assert.match(html, /Supported AI app activity, local models found, and local models running/);
  assert.match(html, /Local models are available, but none ran during this observation/);
  assert.match(html, /Your AI Footprint/);
  assert.match(html, /Optional global comparison/);
  assert.doesNotMatch(html, /Your personal AI rhythm/);
  assert.doesNotMatch(html, /forkit-footprints-rhythm-v1/);
  assert.match(html, /forkit-footprints-colors-v1/);
  assert.match(html, /forkit-footprints-last-summary-v1/);
  assert.match(html, /last-observation/);
  assert.match(html, /Previous observation saved locally/);
  assert.match(html, /systemPalette/);
  assert.match(html, /systemColor/);
  assert.match(html, /saveColors/);
  assert.match(html, /setAccent/);
  assert.match(html, /fitActivityTitle/);
  assert.match(html, /multipleActiveTitle/);
  assert.match(html, /activity-chart/);
  assert.match(html, /ratio-stack/);
  assert.match(html, /hosted-grid/);
  assert.match(html, /activity-bar\.longest/);
  assert.match(html, /activity-legend/);
  assert.match(html, /renderObservationChart/);
  assert.match(html, /renderActivityLegend/);
  assert.match(html, /renderHostedLocal/);
  assert.match(html, /product_signatures/);
  assert.match(html, /personalPatternSentence/);
  assert.match(html, /Focused AI workflow/);
  assert.match(html, /Hosted-first workflow/);
  assert.match(html, /Local AI reserve/);
  assert.match(html, /You are using hosted AI while local models are available but inactive/);
  assert.match(html, /AI work made visible/);
  assert.match(html, /Measured locally\. Shared by choice/);
  assert.match(html, /shareMeasuredDurations/);
  assert.match(html, /renderDetails\(\)/);
  assert.match(html, /systemModelRuntime/);
  assert.match(html, /resourceScope/);
  assert.match(html, /How does your AI activity compare\?/);
  assert.match(html, /Explore your position among participating Forkit observations/);
  assert.match(html, /See my global position/);
  assert.match(html, /https:\/\/www\.forkit\.dev\/ai-footprint#global-vision/);
  assert.match(html, /nativeAction\('open-global'\)/);
  assert.doesNotMatch(html, /Keep everything local/);
  assert.doesNotMatch(html, /id="global-consent"/);
  assert.doesNotMatch(html, /id="payload"/);
  assert.match(html, /Advanced details/);
  assert.match(html, /How Forkit measures/);
  assert.match(html, /AI activity/);
  assert.match(html, /Studio Test Mac/);
  assert.doesNotMatch(html, />Discover</);
  assert.doesNotMatch(html, />Observe</);
  assert.doesNotMatch(html, />Evolution</);
  assert.doesNotMatch(html, /Measure one AI task/);
  assert.doesNotMatch(html, /loaded\/online state/i);
  assert.doesNotMatch(html, /NOT RUNNING|OPEN \/ IDLE|no model loaded|Detected · not running|No verified local engine|No supported model record|No supported app or tool/i);
  const mainBeforeDetails = html.slice(html.indexOf('<main'), html.indexOf('<details class="card privacy"'));
  assert.doesNotMatch(mainBeforeDetails, /CPU now|Memory now|measured processes|Live resource footprint|process-count graph/i);
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
  const shareFunction = html.slice(html.indexOf('function shareCaption'), html.indexOf('function draw'));
  const drawFunction = html.slice(html.indexOf('function draw'), html.indexOf("for(const next of ['en','de'])"));
  assert.match(shareFunction, /function shareCaption/);
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
  assert.match(html, /Global benchmark is forming/);
  const clickHandler = html.slice(html.indexOf("$('review-payload').addEventListener('click'"));
  assert.match(clickHandler, /nativeAction\('open-global'\)/);
  assert.match(clickHandler, /location\.assign\(globalUrl\)/);
  assert.doesNotMatch(clickHandler, /config\.contribution_preview_endpoint/);
  assert.doesNotMatch(clickHandler, /keep-local/);
});

test('saved aggregate page is self-contained and exposes no item names', async () => {
  const report = await emptyReport();
  const sentinel = 'PRIVATE_MODEL_DO_NOT_RENDER';
  report.models = [{ name: sentinel }] as unknown as typeof report.models;
  const html = renderCensusSharePage(report);
  assert.match(html, /Forkit AI Footprint/);
  assert.match(html, /canvas[^>]+width="1080" height="1080"/);
  assert.match(html, /1080 × 1080 PNG · 1:1 square/);
  assert.match(html, /messageHandlers\?\.forkitShare/);
  assert.match(html, /nativeAction\('save'/);
  assert.match(html, /nativeAction\('copy-image'/);
  assert.match(html, /nativeAction\('copy-caption'/);
  assert.match(html, /nativeAction\('share'/);
  assert.doesNotMatch(html, new RegExp(sentinel));
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /[a-f0-9]{48}/);
});

test('German GUI and square share export are localized from the same product copy', async () => {
  const html = renderCensusSharePage(await emptyReport(), { locale: 'de' });
  assert.match(html, /lang="de"/);
  assert.match(html, /KI-Aktivität jetzt/);
  assert.match(html, /Ihre KI-Scorecard/);
  assert.match(html, /Lokal überwachen/);
  assert.match(html, /Nichts hochgeladen/);
  assert.match(html, /Monitoring starten/);
  assert.match(html, /KI-Aktivitäts-Timeline/);
  assert.match(html, /KI-aktiver Anteil/);
  assert.match(html, /Was Forkit bemerkt hat/);
  assert.match(html, /Hosted vs\. lokale KI/);
  assert.match(html, /Wie lässt sich Ihre KI-Aktivität vergleichen\?/);
  assert.match(html, /KI-Arbeit sichtbar gemacht/);
  assert.match(html, /Lokal gemessen\. Nur freiwillig geteilt/);
  assert.match(html, /PNG speichern/);
  assert.match(html, /Bild kopieren/);
  assert.match(html, /width="1080" height="1080"/);
  assert.match(html, /1080 × 1080 PNG · quadratisch 1:1/);
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
