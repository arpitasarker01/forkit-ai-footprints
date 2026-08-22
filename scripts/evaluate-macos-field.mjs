import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runCensus } from '../dist/census.js';

assert.equal(process.platform, 'darwin', 'macOS field evaluation must run on macOS.');
const truthPath = process.argv[2];
assert.ok(truthPath, 'Usage: npm run evaluate:macos -- /absolute/path/to/local-truth.json');
const absoluteTruthPath = path.resolve(truthPath);
const truth = JSON.parse(await fs.readFile(absoluteTruthPath, 'utf8'));
assert.equal(truth.schema_version, '1.0');

function stringSet(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array.`);
  assert.ok(value.every((entry) => typeof entry === 'string' && entry.length > 0), `${label} must contain non-empty strings.`);
  return new Set(value);
}

function score(actualInput, expectedInput) {
  const actual = new Set(actualInput);
  const expected = new Set(expectedInput);
  const truePositive = [...actual].filter((value) => expected.has(value)).length;
  const falsePositive = [...actual].filter((value) => !expected.has(value)).length;
  const falseNegative = [...expected].filter((value) => !actual.has(value)).length;
  return {
    actual_count: actual.size,
    expected_count: expected.size,
    true_positive: truePositive,
    false_positive: falsePositive,
    false_negative: falseNegative,
    precision: actual.size === 0 ? null : truePositive / actual.size,
    recall: expected.size === 0 ? null : truePositive / expected.size,
  };
}

const expected = {
  agents: stringSet(truth.expected?.agent_signatures, 'expected.agent_signatures'),
  tools: stringSet(truth.expected?.tool_names, 'expected.tool_names'),
  runtimes: stringSet(truth.expected?.online_runtime_names, 'expected.online_runtime_names'),
  models: stringSet(truth.expected?.model_keys, 'expected.model_keys'),
  mcp: stringSet(truth.expected?.mcp_clients, 'expected.mcp_clients'),
};
const report = await runCensus();
const metrics = {
  agents: score(report.agents.map((item) => item.signature), expected.agents),
  tools: score(report.tools.map((item) => item.name), expected.tools),
  runtimes: score(
    report.runtimes.filter((item) => item.evidence_status === 'online').map((item) => item.name),
    expected.runtimes,
  ),
  models: score(report.models.map((item) => `${item.runtime}:${item.name}`), expected.models),
  mcp: score(report.mcp_configs.map((item) => item.client), expected.mcp),
};

process.stdout.write(`${JSON.stringify({
  evaluation: 'macos-local-labelled-device',
  schema_version: truth.schema_version,
  product_version: report.product_version,
  metrics,
  uploaded: false,
  field_accuracy_claim_allowed: false,
}, null, 2)}\n`);

