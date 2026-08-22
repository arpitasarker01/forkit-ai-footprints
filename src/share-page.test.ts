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
    tool_count: 4,
    mcp_config_count: 1,
    confirmed_running_model_count: 0,
    storage_bytes: 2_595_045_761,
    storage_bucket: '1-10 GB',
    warning_count: 2,
  };
  report.models = [{ name: sentinel }] as unknown as typeof report.models;
  report.agents = [{ confidence: 'high', executable_names: [sentinel] }] as unknown as typeof report.agents;

  const snapshot = buildCensusShareSnapshot(report);
  assert.equal(snapshot.model_record_count, 4);
  assert.equal(snapshot.online_runtime_count, 1);
  assert.equal(snapshot.architecture_label, 'Apple Silicon');
  assert.equal(snapshot.storage_bucket, '1–10 GB');

  const html = renderCensusSharePage(report);
  assert.match(html, /Forkit AI Footprints/);
  assert.match(html, /Your AI\.<br>Counted\./);
  assert.match(html, /Share my footprint/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /zero uploads/i);
  assert.match(html, /No global numbers are fabricated/i);
  assert.match(html, /npm ci &amp;&amp; npm run build/);
  assert.doesNotMatch(html, new RegExp(sentinel));
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
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
  assert.match(html, /no proof of safety, provenance, or ownership/i);
});

test('global pulse renders only when a consented aggregate is supplied', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
  });
  const html = renderCensusSharePage(report, {
    globalPulse: {
      participating_devices: 1250,
      model_records: 4020,
      active_agent_products: 610,
      updated_at: '2026-08-22T12:00:00.000Z',
      source: 'consented-aggregate',
    },
  });
  assert.match(html, /Live consented aggregate/);
  assert.match(html, /1,250/);
  assert.match(html, /4,020/);
  assert.match(html, /610/);
  assert.throws(() => renderCensusSharePage(report, {
    globalPulse: {
      participating_devices: -1,
      model_records: 4020,
      active_agent_products: 610,
      updated_at: 'not-a-date',
      source: 'consented-aggregate',
    },
  }), /INVALID_GLOBAL_AI_FOOTPRINT_PULSE/);
});
