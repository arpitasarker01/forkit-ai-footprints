import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalInsights } from './insights';
import type { MonitorSnapshot } from './monitor';

function snapshot(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return {
    schema_version: '1.0', lifecycle: 'stopped', started_at: '2026-08-23T10:00:00.000Z', stopped_at: '2026-08-23T10:10:00.000Z',
    observed_seconds: 600, active_seconds: 492, activity_ratio: 0.82,
    products: [{ signature: 'codex', name: 'Codex', kind: 'coding-agent', state: 'open-idle', process_count: 1, cpu_percent: 0, memory_percent: 1, memory_bytes: 10_000_000, recent_cpu_time_delta_ms: 0, active_seconds: 492, context: { chat: null, workspace: null, source: null } }],
    timeline: [{ started_at: '2026-08-23T10:00:00.000Z', ended_at: '2026-08-23T10:08:12.000Z', state: 'working-now', product_signatures: ['codex'] }],
    overhead: { current_cpu_percent: 0.1, current_memory_bytes: 1, history_bytes: 1, sample_count: 1, median_cpu_percent: 0.1, p95_cpu_percent: 0.1, max_memory_bytes: 1, measurement: 'forkit-process-tree' },
    sample_interval_ms: 1000, history_limit: 900, evidence: 'repeated-process-tree-cpu-time-deltas', limitation: 'test', ...overrides,
  };
}

test('high activity produces measured, deterministic personal insights', () => {
  assert.deepEqual(buildLocalInsights(snapshot(), { model_record_count: 5, confirmed_running_model_count: 0 }), [
    { kind: 'activity-share', text: 'Codex app activity was observed during 82% of your observation.' },
    { kind: 'longest-block', text: 'Your longest continuous AI-app activity signal lasted 8m 12s.' },
    { kind: 'local-models-unused', text: '5 local model records are stored on this device.' },
  ]);
});

test('light activity is described plainly without invented praise', () => {
  const result = buildLocalInsights(snapshot({ activity_ratio: 0.08, active_seconds: 48, timeline: [] }), { model_record_count: 0, confirmed_running_model_count: 0 });
  assert.deepEqual(result, [
    { kind: 'mostly-idle', text: 'This observation captured a light local AI-app activity pattern.' },
    { kind: 'workflow', text: 'All observed AI-app activity came from Codex.' },
  ]);
});

test('multi-tool activity reports the measured supported-tool count', () => {
  const codex = snapshot().products[0]!;
  const result = buildLocalInsights(snapshot({
    products: [codex, { ...codex, signature: 'claude', name: 'Claude Code', active_seconds: 120 }],
  }), { model_record_count: 5, confirmed_running_model_count: 0 });
  assert.equal(result[0]?.text, 'Supported AI app activity was observed during 82% of your observation.');
  assert.equal(result[2]?.text, 'Local AI-app activity was observed across 2 supported tools.');
});

test('insights remain hidden until enough valid observed time exists', () => {
  assert.deepEqual(buildLocalInsights(snapshot({ observed_seconds: 59 }), { model_record_count: 5, confirmed_running_model_count: 0 }), []);
});

test('German insights use the same deterministic measurements', () => {
  const result = buildLocalInsights(snapshot(), { model_record_count: 5, confirmed_running_model_count: 0 }, 60, 'de');
  assert.deepEqual(result, [
    { kind: 'activity-share', text: 'Codex-App-Aktivität wurde während 82 % Ihrer Beobachtung erkannt.' },
    { kind: 'longest-block', text: 'Ihr längstes durchgehendes KI-App-Aktivitätssignal dauerte 8 Min 12 Sek.' },
    { kind: 'local-models-unused', text: '5 lokale Modelldatensätze sind auf diesem Gerät gespeichert.' },
  ]);
});

test('longest block never crosses an explicit Stop and restart boundary', () => {
  const result = buildLocalInsights(snapshot({ timeline: [
    { started_at: '2026-08-23T10:00:00.000Z', ended_at: '2026-08-23T10:01:00.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
    { started_at: '2026-08-23T10:01:01.000Z', ended_at: '2026-08-23T10:01:41.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 2 },
  ] }), { model_record_count: 0, confirmed_running_model_count: 0 });
  assert.equal(result[1]?.text, 'Your longest continuous AI-app activity signal lasted 1m 0s.');
});
