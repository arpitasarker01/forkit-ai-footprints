import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMacosFieldTruth } from './evaluate';
import type { CensusReport } from './types';

const report = {
  product_version: '0.2.0',
  system: { platform: 'darwin', architecture: 'arm64', node_major: 22 },
  agents: [{ signature: 'codex' }],
  tools: [{ name: 'Codex' }, { name: 'Cursor' }],
  runtimes: [{ name: 'ollama', evidence_status: 'online' }],
  models: [{ runtime: 'ollama', name: 'example:latest' }],
  mcp_configs: [{ client: 'Codex' }],
} as CensusReport;

test('macOS field evaluation emits only aggregate metrics and never authorizes an accuracy claim', () => {
  const result = evaluateMacosFieldTruth({
    schema_version: '1.0',
    expected: {
      agent_signatures: ['codex'],
      tool_names: ['Codex'],
      online_runtime_names: ['ollama'],
      model_keys: ['ollama:example:latest'],
      mcp_clients: ['Codex'],
    },
  }, report, 26);
  assert.deepEqual(result.environment, {
    platform: 'darwin',
    architecture: 'arm64',
    macos_major: 26,
    node_major: 22,
  });
  assert.equal(result.metrics.agents.precision, 1);
  assert.equal(result.metrics.tools.false_positive, 1);
  assert.equal(result.metrics.tools.precision, 0.5);
  assert.equal(result.uploaded, false);
  assert.equal(result.field_accuracy_claim_allowed, false);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /example:latest|Codex|Cursor|ollama/);
});

test('macOS field evaluation rejects malformed truth files', () => {
  assert.throws(() => evaluateMacosFieldTruth({ schema_version: '1.0', expected: {} }, report, 26), /must contain non-empty strings/);
});
