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
  assert.match(html, /Your AI footprint/);
  assert.match(html, /Share snapshot/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /zero uploads/i);
  assert.doesNotMatch(html, new RegExp(sentinel));
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
});

test('share page states model and process-count limitations', async () => {
  const report = await runCensus({
    includeRuntimes: false,
    includeFilesystem: false,
    includeAgents: false,
    includeTools: false,
    includeMcp: false,
  });
  const html = renderCensusSharePage(report);
  assert.match(html, /one model may have more than one evidence source/i);
  assert.match(html, /supporting processes, not independent agents/i);
  assert.match(html, /not proof of ownership, safety, provenance, or passport status/i);
});
