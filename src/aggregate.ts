import fs from 'node:fs/promises';
import path from 'node:path';
import type { MacosFieldEvaluation, SurfaceMetrics } from './evaluate';

const SURFACES = ['agents', 'tools', 'runtimes', 'models', 'mcp'] as const;

export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

export interface AggregatedSurfaceMetrics extends SurfaceMetrics {
  precision_95_interval: ConfidenceInterval | null;
  recall_95_interval: ConfidenceInterval | null;
}

export interface MacosFieldAggregate {
  aggregation: 'macos-independent-labelled-devices';
  schema_version: '1.0';
  product_version: string;
  evaluation_count: number;
  coverage: {
    architecture: Record<string, number>;
    macos_major: Record<string, number>;
    node_major: Record<string, number>;
  };
  metrics: Record<(typeof SURFACES)[number], AggregatedSurfaceMetrics>;
  uploaded: false;
  field_accuracy_claim_allowed: false;
}

function finiteNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`${label} must be a non-negative integer.`);
  return Number(value);
}

function finitePositiveInteger(value: unknown, label: string): number {
  const parsed = finiteNonNegativeInteger(value, label);
  if (parsed === 0) throw new Error(`${label} must be positive.`);
  return parsed;
}

function parseMetric(value: unknown, label: string): SurfaceMetrics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const record = value as Record<string, unknown>;
  const truePositive = finiteNonNegativeInteger(record.true_positive, `${label}.true_positive`);
  const falsePositive = finiteNonNegativeInteger(record.false_positive, `${label}.false_positive`);
  const falseNegative = finiteNonNegativeInteger(record.false_negative, `${label}.false_negative`);
  const actualCount = truePositive + falsePositive;
  const expectedCount = truePositive + falseNegative;
  return {
    actual_count: actualCount,
    expected_count: expectedCount,
    true_positive: truePositive,
    false_positive: falsePositive,
    false_negative: falseNegative,
    precision: actualCount === 0 ? null : truePositive / actualCount,
    recall: expectedCount === 0 ? null : truePositive / expectedCount,
  };
}

function parseEvaluation(value: unknown): MacosFieldEvaluation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Evaluation must be an object.');
  const record = value as Record<string, unknown>;
  if (record.evaluation !== 'macos-local-labelled-device' || record.schema_version !== '1.0') {
    throw new Error('Unsupported macOS field evaluation.');
  }
  if (record.uploaded !== false || record.field_accuracy_claim_allowed !== false) {
    throw new Error('Evaluation privacy flags are invalid.');
  }
  const environment = record.environment as Record<string, unknown> | undefined;
  if (!environment || environment.platform !== 'darwin' || typeof environment.architecture !== 'string' || !environment.architecture) {
    throw new Error('Evaluation environment is invalid.');
  }
  const macosMajor = environment.macos_major === null
    ? null
    : finitePositiveInteger(environment.macos_major, 'environment.macos_major');
  const nodeMajor = finitePositiveInteger(environment.node_major, 'environment.node_major');
  const metricsRecord = record.metrics as Record<string, unknown> | undefined;
  if (!metricsRecord) throw new Error('Evaluation metrics are missing.');
  const productVersion = record.product_version;
  if (typeof productVersion !== 'string' || !productVersion) throw new Error('Evaluation product version is invalid.');
  const metrics = Object.fromEntries(SURFACES.map((surface) => [surface, parseMetric(metricsRecord[surface], `metrics.${surface}`)]));
  return {
    evaluation: 'macos-local-labelled-device',
    schema_version: '1.0',
    product_version: productVersion,
    environment: {
      platform: 'darwin',
      architecture: environment.architecture,
      macos_major: macosMajor,
      node_major: nodeMajor,
    },
    metrics: metrics as MacosFieldEvaluation['metrics'],
    uploaded: false,
    field_accuracy_claim_allowed: false,
  };
}

function wilson(successes: number, total: number): ConfidenceInterval | null {
  if (total === 0) return null;
  const z = 1.959963984540054;
  const proportion = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (proportion + (z * z) / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((proportion * (1 - proportion)) / total + (z * z) / (4 * total * total));
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

function countValues(values: Array<string | number | null>): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value === null ? 'unknown' : String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function aggregateMacosFieldEvaluations(inputs: unknown[]): MacosFieldAggregate {
  if (inputs.length === 0) throw new Error('At least one macOS field evaluation is required.');
  const evaluations = inputs.map(parseEvaluation);
  const productVersions = new Set(evaluations.map((evaluation) => evaluation.product_version));
  if (productVersions.size !== 1) throw new Error('Cannot aggregate evaluations from different product versions.');
  const metrics = Object.fromEntries(SURFACES.map((surface) => {
    const sums = evaluations.reduce((total, evaluation) => {
      const metric = evaluation.metrics[surface];
      total.truePositive += metric.true_positive;
      total.falsePositive += metric.false_positive;
      total.falseNegative += metric.false_negative;
      return total;
    }, { truePositive: 0, falsePositive: 0, falseNegative: 0 });
    const actualCount = sums.truePositive + sums.falsePositive;
    const expectedCount = sums.truePositive + sums.falseNegative;
    return [surface, {
      actual_count: actualCount,
      expected_count: expectedCount,
      true_positive: sums.truePositive,
      false_positive: sums.falsePositive,
      false_negative: sums.falseNegative,
      precision: actualCount === 0 ? null : sums.truePositive / actualCount,
      recall: expectedCount === 0 ? null : sums.truePositive / expectedCount,
      precision_95_interval: wilson(sums.truePositive, actualCount),
      recall_95_interval: wilson(sums.truePositive, expectedCount),
    }];
  }));
  return {
    aggregation: 'macos-independent-labelled-devices',
    schema_version: '1.0',
    product_version: evaluations[0]!.product_version,
    evaluation_count: evaluations.length,
    coverage: {
      architecture: countValues(evaluations.map((evaluation) => evaluation.environment.architecture)),
      macos_major: countValues(evaluations.map((evaluation) => evaluation.environment.macos_major)),
      node_major: countValues(evaluations.map((evaluation) => evaluation.environment.node_major)),
    },
    metrics: metrics as MacosFieldAggregate['metrics'],
    uploaded: false,
    field_accuracy_claim_allowed: false,
  };
}

export async function aggregateMacosFieldEvaluationDirectory(directoryPath: string): Promise<MacosFieldAggregate> {
  const directory = path.resolve(directoryPath);
  const entries = (await fs.readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));
  const inputs = await Promise.all(entries.map(async (entry) => JSON.parse(await fs.readFile(path.join(directory, entry.name), 'utf8')) as unknown));
  return aggregateMacosFieldEvaluations(inputs);
}
