import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateMacosFieldEvaluations } from './aggregate';

function evaluation(architecture: string, macosMajor: number, truePositive: number, falsePositive: number, falseNegative: number) {
  const metric = {
    actual_count: truePositive + falsePositive,
    expected_count: truePositive + falseNegative,
    true_positive: truePositive,
    false_positive: falsePositive,
    false_negative: falseNegative,
    precision: null,
    recall: null,
  };
  return {
    evaluation: 'macos-local-labelled-device',
    schema_version: '1.0',
    product_version: '0.2.1',
    environment: { platform: 'darwin', architecture, macos_major: macosMajor, node_major: 22 },
    metrics: { agents: metric, tools: metric, runtimes: metric, models: metric, mcp: metric },
    uploaded: false,
    field_accuracy_claim_allowed: false,
  };
}

test('macOS field aggregation combines counts, coverage, and Wilson intervals', () => {
  const result = aggregateMacosFieldEvaluations([
    evaluation('arm64', 26, 3, 0, 1),
    evaluation('x64', 15, 2, 1, 0),
  ]);
  assert.equal(result.evaluation_count, 2);
  assert.equal(result.product_version, '0.2.1');
  assert.deepEqual(result.coverage.architecture, { arm64: 1, x64: 1 });
  assert.deepEqual(result.coverage.macos_major, { '15': 1, '26': 1 });
  assert.equal(result.metrics.agents.true_positive, 5);
  assert.equal(result.metrics.agents.false_positive, 1);
  assert.equal(result.metrics.agents.false_negative, 1);
  assert.equal(result.metrics.agents.precision, 5 / 6);
  assert.ok((result.metrics.agents.precision_95_interval?.lower ?? 1) < 5 / 6);
  assert.ok((result.metrics.agents.precision_95_interval?.upper ?? 0) > 5 / 6);
  assert.equal(result.uploaded, false);
  assert.equal(result.field_accuracy_claim_allowed, false);
});

test('macOS field aggregation rejects empty or privacy-invalid input', () => {
  assert.throws(() => aggregateMacosFieldEvaluations([]), /At least one/);
  const invalid = evaluation('arm64', 26, 1, 0, 0);
  assert.throws(() => aggregateMacosFieldEvaluations([{ ...invalid, uploaded: true }]), /privacy flags/);
  assert.throws(() => aggregateMacosFieldEvaluations([
    invalid,
    { ...invalid, product_version: '0.1.9' },
  ]), /different product versions/);
});
