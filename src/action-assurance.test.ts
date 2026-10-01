import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalActionAssurance } from './action-assurance';
import type { MonitorSnapshot } from './monitor';

function snapshot(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return {
    schema_version: '1.0',
    observation_id: 12,
    lifecycle: 'monitoring',
    started_at: '2026-10-01T10:00:00.000Z',
    stopped_at: null,
    observed_seconds: 120,
    active_seconds: 90,
    activity_ratio: 0.75,
    products: [{
      signature: 'codex',
      name: 'Codex',
      kind: 'coding-agent',
      state: 'working-now',
      process_count: 2,
      cpu_percent: 8.2,
      memory_percent: null,
      memory_bytes: 12345678,
      recent_cpu_time_delta_ms: 650,
      active_seconds: 90,
      context: {
        chat: null,
        workspace: '/Users/example/projects/forkit-core',
        branch: 'main',
        changes_added: null,
        changes_removed: null,
        checks: null,
        source: 'codex-local-metadata',
      },
    }],
    timeline: [],
    overhead: {
      current_cpu_percent: 0.3,
      current_memory_bytes: 1024,
      history_bytes: 0,
      sample_count: 1,
      median_cpu_percent: 0.3,
      p95_cpu_percent: 0.3,
      max_memory_bytes: 1024,
      measurement: 'forkit-process-tree',
    },
    sample_interval_ms: 1000,
    history_limit: 900,
    evidence: 'repeated-process-tree-cpu-time-deltas',
    presence: { state: 'active', idle_seconds: 0, observation_eligible: true },
    limitation: 'Measured process-tree activity.',
    ...overrides,
  };
}

test('builds a local metadata-only action record without exposing full paths or process ids', () => {
  const view = buildLocalActionAssurance(snapshot());
  assert.equal(view.actions.length, 1);
  assert.equal(view.actions[0]?.agent, 'Codex');
  assert.equal(view.actions[0]?.project, 'forkit-core');
  assert.equal(view.actions[0]?.business_object, 'forkit-core');
  assert.equal(view.actions[0]?.model, null);
  assert.equal(view.actions[0]?.assurance, 'PARTIAL');
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('/Users/example/projects'), false);
  assert.equal(serialized.includes('process_ids":true'), false);
});

test('marks active evidence missing when a supported tool is only open and idle', () => {
  const view = buildLocalActionAssurance(snapshot({
    active_seconds: 0,
    activity_ratio: 0,
    products: [{
      ...snapshot().products[0]!,
      state: 'open-idle',
      active_seconds: 0,
      context: { chat: null, workspace: null, source: null },
    }],
  }));
  const activity = view.actions[0]?.evidence.find((item) => item.id === 'activity');
  assert.equal(activity?.state, 'MISSING');
  assert.equal(view.actions[0]?.project, null);
  assert.equal(view.actions[0]?.confidence, 'partial');
});

test('does not claim exact model or downstream effect evidence', () => {
  const action = buildLocalActionAssurance(snapshot()).actions[0]!;
  assert.equal(action.evidence.find((item) => item.id === 'model')?.state, 'MISSING');
  assert.equal(action.evidence.find((item) => item.id === 'downstream-effect')?.state, 'MISSING');
});
