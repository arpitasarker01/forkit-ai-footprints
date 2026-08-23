import assert from 'node:assert/strict';
import test from 'node:test';
import { runCensus } from './census';
import { buildCensusShareSnapshot, renderCensusSharePage } from './share-page';

test('share snapshot contains aggregate facts without item-level records', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
  });
  const sentinel = 'PRIVATE_MODEL_OR_COMMAND_DO_NOT_RENDER';
  report.generated_at = '2026-08-22T12:00:00.000Z';
  report.system = { platform: 'darwin', architecture: 'arm64', node_major: 24 };
  report.summary = {
    runtime_count: 4,
    available_runtime_count: 1,
    model_count: 4,
    agent_product_count: 1,
    agent_process_count: 13,
    agent_cpu_percent: 3.2,
    agent_memory_percent: 1.4,
    tool_count: 4,
    mcp_config_count: 1,
    confirmed_running_model_count: 0,
    storage_bytes: 2_595_045_761,
    storage_file_count: 4,
    storage_complete: true,
    storage_measurement: 'recognized-logical-file-bytes',
    warning_count: 2,
  };
  report.models = [{ name: sentinel }] as unknown as typeof report.models;
  report.agents = [{ confidence: 'high', executable_names: [sentinel] }] as unknown as typeof report.agents;

  const snapshot = buildCensusShareSnapshot(report);
  assert.equal(snapshot.model_record_count, 4);
  assert.equal(snapshot.online_runtime_count, 1);
  assert.equal(snapshot.architecture_label, 'Apple Silicon');
  assert.equal(snapshot.model_storage_display, '2.42 GB');
  assert.equal(snapshot.model_storage_bytes, 2_595_045_761);
  assert.equal(snapshot.model_storage_complete, true);
  assert.equal(snapshot.active_agent_process_count, 13);
  assert.equal(snapshot.agent_cpu_percent, 3.2);

  const html = renderCensusSharePage(report);
  assert.match(html, /Forkit AI Footprints/);
  assert.match(html, /Guess\.<br>Then know\./);
  assert.match(html, /Reveal my footprint/);
  assert.match(html, /How many model records are hiding on this Mac/);
  assert.match(html, /Create share card/);
  assert.match(html, />Discover</);
  assert.match(html, />Observe</);
  assert.match(html, />Evolution</);
  assert.match(html, /Save private baseline/);
  assert.match(html, /forkit-ai-footprints-private-history-v1/);
  assert.match(html, /localStorage\.setItem\(HISTORY_KEY/);
  assert.match(html, /No names, paths, guess, or task details/);
  assert.match(html, /canvas id="share-canvas" width="1200" height="630"/);
  assert.match(html, /Download PNG/);
  assert.match(html, /Share image/);
  assert.match(html, /Created entirely on this device from aggregate counts/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /stays on this device/i);
  assert.match(html, /point-in-time CPU and memory/i);
  assert.match(html, /More intelligence was hiding in plain sight/);
  assert.match(html, /model_storage_display/);
  assert.doesNotMatch(html, /npm install/i);
  assert.doesNotMatch(html, /Global AI Pulse/i);
  assert.doesNotMatch(html, new RegExp(sentinel));
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /Studio Test Mac/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<img\b/i);
});

test('interactive local page can show a device label without adding it to aggregate snapshots', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
  });
  const snapshot = buildCensusShareSnapshot(report);
  const html = renderCensusSharePage(report, { localDeviceLabel: 'Studio Test Mac' });
  assert.match(html, /Studio Test Mac/);
  assert.equal(JSON.stringify(snapshot).includes('Studio Test Mac'), false);
});

test('share page states the compact result limitations', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
  });
  const html = renderCensusSharePage(report);
  assert.match(html, /metadata evidence, not ownership/i);
  assert.match(html, /No weights, prompts, commands, config values, or account data/i);
  assert.doesNotMatch(html, /id="scan-button"/);
});

test('local rescan control requires a relative endpoint and random session token', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
  });
  const html = renderCensusSharePage(report, {
    rescan: {
      endpoint: '/api/scan',
      live_endpoint: '/api/live',
      stop_endpoint: '/api/stop',
      observe_start_endpoint: '/api/observe/start',
      observe_stop_endpoint: '/api/observe/stop',
      session_token: 'a'.repeat(48),
    },
  });
  assert.match(html, /Scan again/);
  assert.match(html, /Close local scan/);
  assert.match(html, /Measure one AI task/);
  assert.match(html, /Share task/);
  assert.match(html, /Stop & measure/);
  assert.match(html, /x-forkit-footprints-session/);
  assert.throws(() => renderCensusSharePage(report, {
    rescan: {
      endpoint: 'https://example.com/scan',
      live_endpoint: '/api/live',
      stop_endpoint: '/api/stop',
      observe_start_endpoint: '/api/observe/start',
      observe_stop_endpoint: '/api/observe/stop',
      session_token: 'weak',
    },
  }), /INVALID_LOCAL_RESCAN_OPTIONS/);
});
