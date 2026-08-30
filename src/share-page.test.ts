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
  assert.match(html, /Forkit AI Footprint/);
  assert.match(html, /class="surface command"/);
  assert.match(html, /class="surface metric-rail"/);
  assert.match(html, /Nothing uploaded without permission/);
  assert.match(html, /Private local view/);
  assert.match(html, /Start Monitoring/);
  assert.doesNotMatch(html, /Guess, then reveal/);
  assert.match(html, /AI Footprint Timeline/);
  assert.match(html, /See when supported AI tools were working, ready, or paused/);
  assert.match(html, /id="activity-explorer"/);
  assert.match(html, /id="activity-navigator"/);
  assert.match(html, /id="system-timeline"/);
  assert.match(html, /class="system-mix rail-section"/);
  assert.match(html, /class="below-timeline"/);
  assert.match(html, /id="center-apps-list"/);
  assert.match(html, /dataset\.centerView='pulse'/);
  assert.match(html, /document\.documentElement\.dataset\.explorerMode/);
  assert.match(html, /\.metric-rail\{display:none\}/);
  assert.match(html, /data-explorer-mode="resources"\] \.below-timeline\{display:grid\}/);
  assert.match(html, /Runtime Footprint/);
  assert.match(html, /Live Resources/);
  assert.match(html, /data-center-view="pulse"><h2>Local AI/);
  assert.match(html, /id="runtime-footprint-list"/);
  assert.match(html, /id="focus-system"/);
  assert.match(html, /Focus selected/);
  assert.match(html, /Selection keeps every tool visible/);
  assert.match(html, /id="selected-evidence"/);
  assert.match(html, /Hover for details/);
  assert.match(html, /Longest active block/);
  assert.match(html, /Valid observed time/);
  assert.match(html, /Apps observed/);
  assert.match(html, /AI tools active/);
  assert.match(html, /AI CPU now/);
  assert.match(html, /AI memory now/);
  assert.match(html, /Resource pulse/);
  assert.match(html, /Current reading/);
  assert.match(html, /Detailed resource history is unavailable for this earlier observation/);
  assert.match(html, /Observation date/);
  assert.match(html, /App detail/);
  assert.match(html, /Device/);
  assert.match(html, /Studio Test Mac/);
  assert.match(html, /Observation #/);
  assert.match(html, /aria-label="Observation views"/);
  assert.match(html, /data-explorer-mode="pulse"/);
  assert.match(html, /data-explorer-mode="runtime"/);
  assert.match(html, /data-explorer-mode="resources"/);
  assert.match(html, /data-explorer-mode="apps"/);
  assert.match(html, /class="focus-summary"/);
  assert.match(html, /function setExplorerMode/);
  assert.match(html, /function renderFocusSummary/);
  assert.match(html, /Selected date/);
  assert.match(html, /Selected time/);
  assert.match(html, /Current state/);
  assert.match(html, /Available runtimes/);
  assert.match(html, /Explore every measured activity block/);
  assert.match(html, /Inspect current CPU and memory measurements/);
  assert.match(html, /Inspect detected and grouped AI tools/);
  assert.match(html, /Observation summary/);
  assert.match(html, /Resources now/);
  assert.match(html, /GPU/);
  assert.match(html, /Not measured/);
  assert.match(html, /Local model storage/);
  assert.match(html, /Local AI runtimes/);
  assert.match(html, /AI tools detected/);
  assert.match(html, /id="all-apps"/);
  assert.match(html, /id="app-inspector"/);
  assert.match(html, /Monitor overhead/);
  assert.match(html, /#2A1F55/);
  assert.match(html, /#008190/);
  assert.match(html, /#F49355/);
  assert.match(html, /#F1EBDF/);
  assert.match(html, /shareObservationDate/);
  assert.match(html, /Mostly active/);
  assert.match(html, /Mixed activity/);
  assert.match(html, /Mostly idle/);
  assert.match(html, /Select an interval to inspect its measured evidence/);
  assert.match(html, /AI-active/);
  assert.match(html, /Idle/);
  assert.match(html, /What Forkit noticed/);
  assert.match(html, /Hosted vs Local AI/);
  assert.match(html, /Local models are available, but none ran during this observation/);
  assert.match(html, /Global comparison/);
  assert.match(html, /Global contribution · Preview/);
  assert.match(html, /id="global-progress"/);
  assert.match(html, /NPM download events show reach; they are not active contributors/);
  assert.match(html, /id="global-permission-button"/);
  assert.match(html, /nativeAction\('global-permission'\)/);
  assert.match(html, /id="share-button"/);
  assert.match(html, /id="share-canvas" width="1080" height="1080"/);
  assert.doesNotMatch(html, /Your personal AI rhythm/);
  assert.doesNotMatch(html, /forkit-footprints-rhythm-v1/);
  assert.match(html, /forkit-footprints-colors-v1/);
  assert.match(html, /localStorage\.getItem\(key\)/);
  assert.match(html, /localStorage\.setItem\(colorsKey/);
  assert.doesNotMatch(html, /Math\.random\(\)/);
  assert.match(html, /forkit-footprints-last-summary-v1/);
  assert.match(html, /systemPalette/);
  assert.match(html, /systemColor/);
  assert.match(html, /class ActivityExplorer/);
  assert.match(html, /ResizeObserver/);
  assert.match(html, /requestAnimationFrame/);
  assert.match(html, /pointermove/);
  assert.match(html, /dblclick/);
  assert.match(html, /wheel/);
  assert.match(html, /focusSegment/);
  assert.match(html, /focusSystem/);
  assert.match(html, /selectSystem/);
  assert.match(html, /selectedSystemSignature/);
  assert.match(html, /focusedSystemSignature/);
  assert.match(html, /function viewForSystem/);
  assert.match(html, /function renderSystemTimeline/);
  assert.match(html, /trackWidth<420\?2:trackWidth<700\?3:5/);
  assert.match(html, /timeline-tick:not\(:first-child\):not\(:last-child\)/);
  assert.match(html, /function renderRuntimeFootprint/);
  assert.match(html, /function renderBelowSummary/);
  assert.match(html, /function renderInspectorApps/);
  assert.match(html, /pointerenter/);
  assert.match(html, /activity_view/);
  assert.match(html, /renderHostedLocal/);
  assert.match(html, /Focused AI workflow/);
  assert.match(html, /Hosted-first workflow/);
  assert.match(html, /Local AI reserve/);
  assert.match(html, /Hosted-first workflow: active AI work used hosted AI while local models stayed idle/);
  assert.match(html, /AI work made visible/);
  assert.match(html, /This is how much I control my AI workflow, what about yours\?/);
  assert.match(html, /monitor\.last_observation/);
  assert.match(html, /Shared by choice\./);
  assert.match(html, /shareMeasuredDurations/);
  assert.match(html, /renderDetails\(\)/);
  assert.match(html, /Is this unusually high\?/);
  assert.match(html, /https:\/\/www\.forkit\.dev\/ai-footprint#global-vision/);
  assert.match(html, /nativeAction\('open-global'\)/);
  assert.doesNotMatch(html, /auth\(config\.contribution_preview_endpoint/);
  assert.doesNotMatch(html, /Keep everything local/);
  assert.doesNotMatch(html, /id="global-consent"/);
  assert.doesNotMatch(html, /id="payload"/);
  assert.match(html, /Advanced details/);
  assert.match(html, /How Forkit measures/);
  assert.match(html, /AI activity/);
  assert.doesNotMatch(html, />Discover</);
  assert.doesNotMatch(html, />Observe</);
  assert.doesNotMatch(html, />Evolution</);
  assert.doesNotMatch(html, /Measure one AI task/);
  assert.doesNotMatch(html, /loaded\/online state/i);
  assert.doesNotMatch(html, /NOT RUNNING|OPEN \/ IDLE|no model loaded|Detected · not running|No verified local engine|No supported model record|No supported app or tool/i);
  const mainBeforeDetails = html.slice(html.indexOf('<main'), html.indexOf('<details class="surface advanced"'));
  assert.match(mainBeforeDetails, /id="rail-cpu"/);
  assert.match(mainBeforeDetails, /id="rail-memory"/);
  assert.match(mainBeforeDetails, /id="rail-space"/);
  assert.doesNotMatch(mainBeforeDetails, /measured processes|process-count graph/i);
  const inlineScript = /<script>([\s\S]*?)<\/script>/i.exec(html)?.[1];
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
  assert.doesNotMatch(shareFunction, /local_details|\.context|chat|workspace|device_label/);
  assert.doesNotMatch(drawFunction, /local_details|\.context|chat|workspace|device_label/);
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
  assert.match(html, /Global AI Preview is forming/);
  assert.match(html, /Global contribution is off/);
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
  assert.match(html, /Footprint-Übersicht/);
  assert.match(html, /AI-Footprint-Zeitleiste/);
  assert.match(html, /aria-label="Beobachtungsansichten"/);
  assert.match(html, /Beobachtungslaufzeit/);
  assert.match(html, /Ressourcenbelege/);
  assert.match(html, /Erkannte KI-Tools/);
  assert.match(html, /Auswahl fokussieren/);
  assert.match(html, /Laufzeit-Footprint/);
  assert.match(html, /Live-Ressourcen/);
  assert.match(html, /data-center-view="pulse"><h2>Lokale KI/);
  assert.match(html, /Gewählte Zeit/);
  assert.match(html, /Aktueller Status/);
  assert.match(html, /Jeden gemessenen Aktivitätsblock erkunden/);
  assert.match(html, /Erkannte und gruppierte KI-Tools prüfen/);
  assert.match(html, /KI-CPU aktuell/);
  assert.match(html, /KI-Speicher aktuell/);
  assert.match(html, /Aktueller Messwert/);
  assert.match(html, /Lokal überwachen/);
  assert.match(html, /Nichts wird ohne Erlaubnis hochgeladen/);
  assert.match(html, /Monitoring starten/);
  assert.match(html, /KI-Aktivitäts-Puls/);
  assert.match(html, /KI-aktiver Score/);
  assert.match(html, /Was Forkit bemerkt hat/);
  assert.match(html, /Hosted vs\. lokale KI/);
  assert.match(html, /Ist das ungewöhnlich hoch\?/);
  assert.match(html, /Globale Position ansehen/);
  assert.match(html, /KI-Arbeit sichtbar gemacht/);
  assert.match(html, /So stark kontrolliere ich meinen KI-Workflow/);
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
