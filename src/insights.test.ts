import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalInsights } from './insights';
import type { MonitorSnapshot } from './monitor';

function snapshot(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return {
    schema_version: '1.0', observation_id: 1, lifecycle: 'stopped', started_at: '2026-08-23T10:00:00.000Z', stopped_at: '2026-08-23T10:10:00.000Z',
    observed_seconds: 600, active_seconds: 492, activity_ratio: 0.82,
    products: [{ signature: 'codex', name: 'Codex', kind: 'coding-agent', state: 'open-idle', process_count: 1, cpu_percent: 0, memory_percent: 1, memory_bytes: 10_000_000, recent_cpu_time_delta_ms: 0, active_seconds: 492, context: { chat: null, workspace: null, source: null } }],
    timeline: [{ started_at: '2026-08-23T10:00:00.000Z', ended_at: '2026-08-23T10:08:12.000Z', state: 'working-now', product_signatures: ['codex'] }],
    overhead: { current_cpu_percent: 0.1, current_memory_bytes: 1, history_bytes: 1, sample_count: 1, median_cpu_percent: 0.1, p95_cpu_percent: 0.1, max_memory_bytes: 1, measurement: 'forkit-process-tree' },
    presence: { state: 'active', idle_seconds: 0, observation_eligible: true },
    sample_interval_ms: 1000, history_limit: 900, evidence: 'repeated-process-tree-cpu-time-deltas', limitation: 'test', ...overrides,
  };
}

test('high activity produces measured, deterministic personal insights', () => {
  assert.deepEqual(buildLocalInsights(snapshot(), { model_record_count: 5, confirmed_running_model_count: 0 }), [
    { kind: 'workflow', text: 'Focused AI workflow: all observed activity came from Codex.' },
    { kind: 'longest-block', text: 'Deep work block: the longest active period was 8m 12s.' },
    { kind: 'hosted-local', text: 'Hosted-first workflow: Codex was active while local models stayed idle.' },
  ]);
});

test('light activity is described plainly without invented praise', () => {
  const result = buildLocalInsights(snapshot({ activity_ratio: 0.08, active_seconds: 48, timeline: [] }), { model_record_count: 0, confirmed_running_model_count: 0 });
  assert.deepEqual(result, [
    { kind: 'mostly-idle', text: 'Mostly idle observation: supported AI was ready but not actively working.' },
  ]);
});

test('multi-tool activity reports the measured supported-tool count', () => {
  const codex = snapshot().products[0]!;
  const result = buildLocalInsights(snapshot({
    products: [codex, { ...codex, signature: 'claude', name: 'Claude Code', active_seconds: 120 }],
  }), { model_record_count: 5, confirmed_running_model_count: 0 });
  assert.equal(result[0]?.text, 'Supported AI app activity was observed during 82% of the device observation.');
  assert.equal(result[2]?.text, 'Local AI-app activity was observed across 2 supported tools.');
});

test('local model reserve is reported when records exist but no local model ran', () => {
  const inactive = snapshot({
    activity_ratio: 0,
    active_seconds: 0,
    products: snapshot().products.map((product) => ({ ...product, active_seconds: 0 })),
    timeline: [],
  });
  const result = buildLocalInsights(inactive, { model_record_count: 5, confirmed_running_model_count: 0 });
  assert.equal(result[0]?.kind, 'mostly-idle');
  assert.deepEqual(result[1], { kind: 'local-models-unused', text: 'Local AI reserve: 5 local models are available, 0 running.' });
});

test('confirmed local runtime activity produces a distinct local-AI insight without duplication', () => {
  const localRuntime = snapshot().products.map((product) => ({
    ...product,
    signature: 'ollama',
    name: 'Ollama',
    kind: 'local-model-runtime',
  }));
  const result = buildLocalInsights(snapshot({ products: localRuntime }), { model_record_count: 5, confirmed_running_model_count: 1 });
  assert.deepEqual(result, [
    { kind: 'workflow', text: 'Focused AI workflow: all observed activity came from Ollama.' },
    { kind: 'longest-block', text: 'Deep work block: the longest active period was 8m 12s.' },
    { kind: 'hosted-local', text: 'Local AI was running during this observation.' },
  ]);
});

test('insights remain hidden until enough valid observed time exists', () => {
  assert.deepEqual(buildLocalInsights(snapshot({ observed_seconds: 59 }), { model_record_count: 5, confirmed_running_model_count: 0 }), []);
});

test('German insights use the same deterministic measurements', () => {
  const result = buildLocalInsights(snapshot(), { model_record_count: 5, confirmed_running_model_count: 0 }, 60, 'de');
  assert.deepEqual(result, [
    { kind: 'workflow', text: 'Fokussierter KI-Workflow: Alle beobachtete Aktivität kam von Codex.' },
    { kind: 'longest-block', text: 'Deep-Work-Block: Die längste aktive Phase dauerte 8 Min 12 Sek.' },
    { kind: 'hosted-local', text: 'Hosted-first-Workflow: Codex war aktiv, während lokale Modelle inaktiv blieben.' },
  ]);
});

test('longest block never crosses an explicit Stop and restart boundary', () => {
  const result = buildLocalInsights(snapshot({ timeline: [
    { started_at: '2026-08-23T10:00:00.000Z', ended_at: '2026-08-23T10:01:00.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
    { started_at: '2026-08-23T10:01:01.000Z', ended_at: '2026-08-23T10:01:41.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 2 },
  ] }), { model_record_count: 0, confirmed_running_model_count: 0 });
  assert.equal(result[1]?.text, 'Deep work block: the longest active period was 1m 0s.');
});

test('hour-long insight durations retain seconds', () => {
  const result = buildLocalInsights(snapshot({
    timeline: [{ started_at: '2026-08-23T10:00:00.000Z', ended_at: '2026-08-23T11:02:03.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 }],
  }), { model_record_count: 0, confirmed_running_model_count: 0 });
  assert.equal(result[1]?.text, 'Deep work block: the longest active period was 1h 2m 3s.');
});
