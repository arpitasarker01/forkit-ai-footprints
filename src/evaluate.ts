import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCensus } from './census';
import type { CensusReport } from './types';

export interface MacosFieldTruth {
  schema_version: '1.0';
  expected: {
    agent_signatures: string[];
    tool_names: string[];
    online_runtime_names: string[];
    model_keys: string[];
    mcp_clients: string[];
  };
}

export interface SurfaceMetrics {
  actual_count: number;
  expected_count: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  precision: number | null;
  recall: number | null;
}

export interface MacosFieldEvaluation {
  evaluation: 'macos-local-labelled-device';
  schema_version: '1.0';
  product_version: string;
  environment: {
    platform: 'darwin';
    architecture: string;
    macos_major: number | null;
    node_major: number;
  };
  metrics: {
    agents: SurfaceMetrics;
    tools: SurfaceMetrics;
    runtimes: SurfaceMetrics;
    models: SurfaceMetrics;
    mcp: SurfaceMetrics;
  };
  uploaded: false;
  field_accuracy_claim_allowed: false;
}

export function detectMacosMajorVersion(): number | null {
  if (process.platform !== 'darwin') return null;
  const result = spawnSync('/usr/bin/sw_vers', ['-productVersion'], {
    encoding: 'utf8',
    shell: false,
    timeout: 2_000,
  });
  if (result.status !== 0) return null;
  const major = Number.parseInt(result.stdout.trim().split('.')[0] ?? '', 10);
  return Number.isInteger(major) && major > 0 ? major : null;
}

function stringSet(value: unknown, label: string): Set<string> {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    throw new Error(`${label} must contain non-empty strings.`);
  }
  return new Set(value);
}

function score(actualInput: Iterable<string>, expectedInput: Iterable<string>): SurfaceMetrics {
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

function parseTruth(value: unknown): MacosFieldTruth {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Truth file must contain an object.');
  const record = value as Record<string, unknown>;
  if (record.schema_version !== '1.0') throw new Error('Unsupported truth schema version.');
  const expectedValue = record.expected;
  if (!expectedValue || typeof expectedValue !== 'object' || Array.isArray(expectedValue)) {
    throw new Error('Truth file must contain an expected object.');
  }
  const expected = expectedValue as Record<string, unknown>;
  return {
    schema_version: '1.0',
    expected: {
      agent_signatures: [...stringSet(expected.agent_signatures, 'expected.agent_signatures')],
      tool_names: [...stringSet(expected.tool_names, 'expected.tool_names')],
      online_runtime_names: [...stringSet(expected.online_runtime_names, 'expected.online_runtime_names')],
      model_keys: [...stringSet(expected.model_keys, 'expected.model_keys')],
      mcp_clients: [...stringSet(expected.mcp_clients, 'expected.mcp_clients')],
    },
  };
}

export function evaluateMacosFieldTruth(
  truthInput: unknown,
  report: CensusReport,
  macosMajor = detectMacosMajorVersion(),
): MacosFieldEvaluation {
  if (report.system.platform !== 'darwin') throw new Error('macOS field evaluation requires a macOS Census Report.');
  const truth = parseTruth(truthInput);
  return {
    evaluation: 'macos-local-labelled-device',
    schema_version: truth.schema_version,
    product_version: report.product_version,
    environment: {
      platform: 'darwin',
      architecture: report.system.architecture,
      macos_major: macosMajor,
      node_major: report.system.node_major,
    },
    metrics: {
      agents: score(report.agents.map((item) => item.signature), truth.expected.agent_signatures),
      tools: score(report.tools.map((item) => item.name), truth.expected.tool_names),
      runtimes: score(
        report.runtimes.filter((item) => item.evidence_status === 'online').map((item) => item.name),
        truth.expected.online_runtime_names,
      ),
      models: score(report.models.map((item) => `${item.runtime}:${item.name}`), truth.expected.model_keys),
      mcp: score(report.mcp_configs.map((item) => item.client), truth.expected.mcp_clients),
    },
    uploaded: false,
    field_accuracy_claim_allowed: false,
  };
}

export async function evaluateMacosFieldTruthFile(filePath: string): Promise<MacosFieldEvaluation> {
  if (process.platform !== 'darwin') throw new Error('macOS field evaluation must run on macOS.');
  const content = await fs.readFile(path.resolve(filePath), 'utf8');
  const truth = JSON.parse(content) as unknown;
  return evaluateMacosFieldTruth(truth, await runCensus());
}
