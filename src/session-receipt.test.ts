import test from 'node:test';
import assert from 'node:assert/strict';
import type { MonitorSnapshot } from './monitor';
import { buildSessionReceiptPreview } from './session-receipt';

function snapshot(): MonitorSnapshot {
  return {
    schema_version: '1.0',
    observation_id: 7,
    lifecycle: 'stopped',
    started_at: '2026-10-01T18:23:19.000Z',
    stopped_at: '2026-10-01T20:40:19.000Z',
    observed_seconds: 8_220,
    active_seconds: 8_040,
    activity_ratio: 0.978,
    products: [
      {
        signature: 'claude-code',
        name: 'Claude Code',
        kind: 'hosted-ai-tool',
        state: 'working-now',
        process_count: 3,
        cpu_percent: 14.2,
        memory_percent: 2.1,
        memory_bytes: 123_456_789,
        recent_cpu_time_delta_ms: 925,
        active_seconds: 4_200,
        context: {
          chat: 'do not share this message',
          workspace: '/Users/private/Forkit-core',
          branch: 'secret-branch',
          changes_added: 42,
          changes_removed: 7,
          checks: 'private check output',
          source: 'cooperating-app-metadata',
        },
      },
      {
        signature: 'codex',
        name: 'Codex',
        kind: 'hosted-ai-tool',
        state: 'open-idle',
        process_count: 2,
        cpu_percent: 1.1,
        memory_percent: 1,
        memory_bytes: 82_000_000,
        recent_cpu_time_delta_ms: 0,
        active_seconds: 1_800,
        context: {
          chat: null,
          workspace: '/Users/private/another-repo',
          source: 'codex-local-metadata',
        },
      },
    ],
    timeline: [
      {
        started_at: '2026-10-01T18:23:19.000Z',
        ended_at: '2026-10-01T18:43:19.000Z',
        state: 'working-now',
        product_signatures: ['claude-code'],
        observation_id: 7,
      },
      {
        started_at: '2026-10-01T19:03:19.000Z',
        ended_at: '2026-10-01T19:33:19.000Z',
        state: 'working-now',
        product_signatures: ['codex'],
        observation_id: 7,
      },
    ],
    overhead: {
      current_cpu_percent: 0.1,
      current_memory_bytes: 1_000_000,
      history_bytes: 2_000,
      sample_count: 2,
      median_cpu_percent: 0.1,
      p95_cpu_percent: 0.2,
      max_memory_bytes: 1_100_000,
      measurement: 'forkit-process-tree',
    },
    sample_interval_ms: 1_000,
    history_limit: 900,
    evidence: 'repeated-process-tree-cpu-time-deltas',
    presence: { state: 'active', idle_seconds: 0, observation_eligible: true },
    limitation: 'test fixture',
  };
}

test('receipt contains only the explicit aggregate contract', () => {
  const preview = buildSessionReceiptPreview(snapshot(), 'fr_test_12345678');
  assert.deepEqual(Object.keys(preview.receipt).sort(), [
    'action_categories',
    'action_count',
    'ai_tools',
    'conflict_count',
    'duration_bucket',
    'evidence_coverage',
    'evidence_sources_count',
    'missing_evidence_count',
    'provider_categories',
    'receipt_id',
    'started_at',
    'tool_categories',
  ]);
});

test('private local context cannot appear in exact shared JSON', () => {
  const preview = buildSessionReceiptPreview(snapshot(), 'fr_test_12345678');
  const shared = preview.exact_json;

  for (const prohibited of [
    '/Users/private/Forkit-core',
    '/Users/private/another-repo',
    'Forkit-core',
    'another-repo',
    'do not share this message',
    'secret-branch',
    'private check output',
    'process_count',
    'memory_bytes',
    'recent_cpu_time_delta_ms',
  ]) {
    assert.equal(shared.includes(prohibited), false, prohibited);
  }
});

test('preview is explicit and performs no upload itself', () => {
  const preview = buildSessionReceiptPreview(snapshot(), 'fr_test_12345678');
  assert.equal(preview.share_ready, true);
  assert.match(preview.note, /no network request/i);
  assert.equal(preview.receipt.duration_bucket, '2–3h');
  assert.deepEqual(preview.receipt.ai_tools, ['Claude Code', 'Codex']);
  assert.deepEqual(preview.receipt.provider_categories, ['Anthropic', 'OpenAI']);
});

test('invalid receipt ids are rejected locally', () => {
  assert.throws(() => buildSessionReceiptPreview(snapshot(), '../private'), /Invalid receipt id/);
});
