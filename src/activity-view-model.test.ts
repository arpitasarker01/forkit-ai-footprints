import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateCurrentAiResources,
  availableLocalDateKeys,
  buildActivityExplorerViewModel,
  buildResourceHistoryView,
  calculateSystemContributions,
  formatObservationDateRange,
  insightEvidenceTarget,
  normalizeActivitySegments,
  resolveSelectedSystemSignature,
  selectedTimeRange,
} from './activity-view-model';
import type { AiActivityProduct, MonitorSnapshot } from './monitor';

const context = { chat: null, workspace: null, source: null } as const;
function product(signature: string, name: string, activeSeconds: number): AiActivityProduct {
  return {
    signature, name, kind: 'coding-agent', state: 'open-idle', process_count: 1,
    cpu_percent: null, memory_percent: null, memory_bytes: null, recent_cpu_time_delta_ms: null,
    active_seconds: activeSeconds, context,
  };
}

function snapshot(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return {
    schema_version: '1.0', observation_id: 1, lifecycle: 'monitoring', started_at: '2026-08-26T08:00:00.000Z', stopped_at: null,
    observed_seconds: 30, active_seconds: 20, activity_ratio: 0.667, products: [product('codex', 'Codex', 20)],
    timeline: [
      { started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:00:10.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
      { started_at: '2026-08-26T08:00:10.000Z', ended_at: '2026-08-26T08:00:20.000Z', state: 'open-idle', product_signatures: ['codex'], observation_id: 1 },
      { started_at: '2026-08-26T08:00:20.000Z', ended_at: '2026-08-26T08:00:30.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
    ],
    overhead: { current_cpu_percent: null, current_memory_bytes: 0, history_bytes: 0, sample_count: 0, median_cpu_percent: null, p95_cpu_percent: null, max_memory_bytes: 0, measurement: 'forkit-process-tree' },
    sample_interval_ms: 1000, history_limit: 900, evidence: 'repeated-process-tree-cpu-time-deltas',
    presence: { state: 'active', idle_seconds: 0, observation_eligible: true }, limitation: 'Measured process-tree activity.',
    ...overrides,
  };
}

test('adjacent visualization segments merge only when state, system and observation match', () => {
  const segments = normalizeActivitySegments([
    { started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:00:05.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
    { started_at: '2026-08-26T08:00:05.500Z', ended_at: '2026-08-26T08:00:10.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
    { started_at: '2026-08-26T08:00:10.000Z', ended_at: '2026-08-26T08:00:12.000Z', state: 'working-now', product_signatures: ['claude'], observation_id: 1 },
  ], 1000);
  assert.equal(segments.length, 2);
  assert.equal(segments[0]?.duration_seconds, 10);
  assert.deepEqual(segments[1]?.system_signatures, ['claude']);
});

test('long gaps become excluded periods and never normal idle time', () => {
  const segments = normalizeActivitySegments([
    { started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:00:05.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
    { started_at: '2026-08-26T08:01:05.000Z', ended_at: '2026-08-26T08:01:10.000Z', state: 'open-idle', product_signatures: ['codex'], observation_id: 2 },
  ], 1000);
  assert.deepEqual(segments.map((segment) => segment.state), ['active', 'excluded', 'idle']);
  assert.equal(segments[1]?.duration_seconds, 60);
  assert.equal(segments[1]?.valid, false);
  assert.equal(segments[1]?.excluded_reason, null);
});

test('headline calculations preserve measured totals and locate the longest active block', () => {
  const view = buildActivityExplorerViewModel(snapshot(), [{ kind: 'longest-block', text: 'Longest evidence' }]);
  assert.equal(view.idle_seconds, 10);
  assert.equal(view.active_block_count, 2);
  assert.equal(view.longest_active_seconds, 10);
  assert.equal(view.insights[0]?.evidence.type, 'range');
  assert.equal(view.segments.filter((segment) => segment.is_longest_active).length, 1);
});

test('overall longest block remains continuous across measured system-signature changes', () => {
  const view = buildActivityExplorerViewModel(snapshot({
    observed_seconds: 20, active_seconds: 20, activity_ratio: 1,
    timeline: [
      { started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:00:08.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
      { started_at: '2026-08-26T08:00:08.000Z', ended_at: '2026-08-26T08:00:20.000Z', state: 'working-now', product_signatures: ['claude'], observation_id: 1 },
    ],
  }), [{ kind: 'longest-block', text: 'Continuous block' }]);
  assert.equal(view.longest_active_seconds, 20);
  assert.equal(view.active_block_count, 1);
  assert.deepEqual(view.longest_active_range, { start_ms: Date.parse('2026-08-26T08:00:00.000Z'), end_ms: Date.parse('2026-08-26T08:00:20.000Z') });
  assert.equal(view.segments.filter((segment) => segment.is_longest_active).length, 2);
  assert.equal(view.segments[0]?.active_block_id, view.segments[1]?.active_block_id);
  assert.equal(view.insights[0]?.evidence.type, 'range');
});

test('continuity breaks split active periods without changing the observation identity', () => {
  const view = buildActivityExplorerViewModel(snapshot({
    observed_seconds: 20, active_seconds: 20, activity_ratio: 1,
    timeline: [
      { started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:00:10.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 7, continuity_id: 11 },
      { started_at: '2026-08-26T08:01:00.000Z', ended_at: '2026-08-26T08:01:10.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 7, continuity_id: 12 },
    ],
  }));
  assert.deepEqual(view.observation_ids, [7]);
  assert.deepEqual(view.continuity_ids, [11, 12]);
  assert.equal(view.active_block_count, 2);
});

test('system contribution shares use measured per-product active seconds', () => {
  const contributions = calculateSystemContributions([product('codex', 'Codex', 30), product('claude', 'Claude Code', 10), product('idle', 'Idle app', 0)]);
  assert.equal(contributions.length, 2);
  assert.equal(contributions[0]?.share, 0.75);
  assert.equal(contributions[1]?.share, 0.25);
});

test('selected range and system insight targeting stay tied to real evidence', () => {
  const view = buildActivityExplorerViewModel(snapshot({ products: [product('codex', 'Codex', 20), product('claude', 'Claude Code', 5)] }));
  const range = selectedTimeRange(view.segments[0]!);
  assert.deepEqual(range, { start_ms: Date.parse('2026-08-26T08:00:00.000Z'), end_ms: Date.parse('2026-08-26T08:00:10.000Z'), duration_seconds: 10 });
  assert.deepEqual(insightEvidenceTarget('workflow', view.segments, view.contributions), { type: 'system', signature: 'codex' });
  assert.deepEqual(insightEvidenceTarget('mostly-idle', view.segments, view.contributions), { type: 'observation' });
});

test('thousands of fragmented production-schema segments remain derivable', () => {
  const start = Date.parse('2026-08-26T08:00:00.000Z');
  const timeline = Array.from({ length: 4_000 }, (_, index) => ({
    started_at: new Date(start + index * 1000).toISOString(),
    ended_at: new Date(start + (index + 1) * 1000).toISOString(),
    state: index % 2 ? 'working-now' as const : 'open-idle' as const,
    product_signatures: ['codex'], observation_id: 1,
  }));
  const before = performance.now();
  const view = buildActivityExplorerViewModel(snapshot({ observed_seconds: 4_000, active_seconds: 2_000, activity_ratio: 0.5, timeline }));
  const elapsed = performance.now() - before;
  assert.equal(view.segments.length, 4_000);
  assert.equal(view.active_block_count, 2_000);
  assert.ok(elapsed < 250, `view-model derivation took ${elapsed.toFixed(1)}ms`);
});

test('a 30-minute mixed observation keeps exact active, idle and longest totals', () => {
  const view = buildActivityExplorerViewModel(snapshot({
    observed_seconds: 1_800, active_seconds: 1_200, activity_ratio: 2 / 3,
    timeline: [
      { started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:10:00.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
      { started_at: '2026-08-26T08:10:00.000Z', ended_at: '2026-08-26T08:20:00.000Z', state: 'open-idle', product_signatures: ['codex'], observation_id: 1 },
      { started_at: '2026-08-26T08:20:00.000Z', ended_at: '2026-08-26T08:30:00.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
    ],
  }));
  assert.equal(view.idle_seconds, 600);
  assert.equal(view.longest_active_seconds, 600);
  assert.equal(view.excluded_seconds, 0);
});

test('an eight-hour continuous observation remains one exact active range', () => {
  const view = buildActivityExplorerViewModel(snapshot({
    observed_seconds: 28_800, active_seconds: 28_800, activity_ratio: 1,
    timeline: [{ started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T16:00:00.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 }],
  }));
  assert.equal(view.longest_active_seconds, 28_800);
  assert.equal(view.idle_seconds, 0);
  assert.equal(view.segments[0]?.is_longest_active, true);
});

test('no-AI and fully-active observations remain honest boundary cases', () => {
  const noAi = buildActivityExplorerViewModel(snapshot({
    observed_seconds: 60, active_seconds: 0, activity_ratio: 0, products: [],
    timeline: [{ started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:01:00.000Z', state: 'open-idle', product_signatures: [], observation_id: 1 }],
  }));
  assert.equal(noAi.longest_active_seconds, 0);
  assert.equal(noAi.idle_seconds, 60);
  assert.deepEqual(noAi.contributions, []);

  const fullyActive = buildActivityExplorerViewModel(snapshot({
    observed_seconds: 60, active_seconds: 60, activity_ratio: 1,
    timeline: [{ started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:01:00.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 }],
  }));
  assert.equal(fullyActive.longest_active_seconds, 60);
  assert.equal(fullyActive.idle_seconds, 0);
});

test('simultaneous hosted and local-runtime activity is represented without inventing exclusivity', () => {
  const localRuntime = { ...product('ollama', 'Ollama', 20), kind: 'local-model-runtime' };
  const view = buildActivityExplorerViewModel(snapshot({
    observed_seconds: 20, active_seconds: 20, activity_ratio: 1,
    products: [product('codex', 'Codex', 20), localRuntime],
    timeline: [{ started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:00:20.000Z', state: 'working-now', product_signatures: ['codex', 'ollama'], observation_id: 1 }],
  }));
  assert.equal(view.simultaneous_systems_max, 2);
  assert.equal(view.contributions.length, 2);
  assert.equal(view.contributions.reduce((sum, item) => sum + item.share, 0), 1);
  assert.deepEqual(view.segments[0]?.system_signatures, ['codex', 'ollama']);
});

test('user-facing active tools exclude an embedded ChatGPT parent record', () => {
  const view = buildActivityExplorerViewModel(snapshot({
    products: [product('chatgpt', 'ChatGPT', 0), product('chatgpt-codex', 'ChatGPT · Codex', 20), product('claude', 'Claude Code', 5)],
    timeline: [
      { started_at: '2026-08-26T08:00:00.000Z', ended_at: '2026-08-26T08:00:20.000Z', state: 'working-now', product_signatures: ['chatgpt', 'chatgpt-codex', 'claude'], observation_id: 1 },
    ],
  }));
  assert.equal(view.active_tool_count, 2);
  assert.deepEqual(view.systems.map((system) => system.signature), ['chatgpt-codex', 'claude']);
  assert.equal(view.contributions.some((item) => item.signature === 'chatgpt'), false);
});

test('current resource aggregation sums only present live measurements', () => {
  const codex = { ...product('codex', 'Codex', 20), cpu_percent: 4.8, memory_bytes: 46_700_000, process_count: 3 };
  const claude = { ...product('claude', 'Claude Code', 5), cpu_percent: 1.2, memory_bytes: 10_000_000, process_count: 2 };
  const resources = aggregateCurrentAiResources([codex, claude]);
  assert.equal(resources.cpu_percent, 6);
  assert.equal(resources.memory_bytes, 56_700_000);
  assert.equal(resources.process_count, 5);
  assert.equal(resources.measurement, 'current-detected-process-trees');

  const missing = aggregateCurrentAiResources([product('idle', 'Idle', 0)]);
  assert.equal(missing.cpu_percent, null);
  assert.equal(missing.memory_bytes, null);
  assert.equal(missing.process_count, 1);
});

test('resource history is live-only while monitoring and honestly unavailable after stop', () => {
  assert.equal(buildActivityExplorerViewModel(snapshot()).resource_history_state, 'collecting');
  assert.equal(buildActivityExplorerViewModel(snapshot({ lifecycle: 'stopped', stopped_at: '2026-08-26T08:00:30.000Z' })).resource_history_state, 'not-retained');
});

test('resource history summarizes bounded local buckets per app without raw process data', () => {
  const history = buildResourceHistoryView([
    {
      started_at: '2026-08-26T08:00:00.000Z',
      ended_at: '2026-08-26T08:01:00.000Z',
      system_signature: 'codex',
      system_name: 'Codex',
      kind: 'coding-agent',
      observed_seconds: 60,
      active_seconds: 30,
      avg_cpu_percent: 4,
      peak_cpu_percent: 8,
      avg_memory_bytes: 100,
      peak_memory_bytes: 120,
      peak_process_count: 2,
      sample_count: 6,
      measurement: 'bounded-local-process-tree-resource-bucket',
    },
    {
      started_at: '2026-08-26T08:01:00.000Z',
      ended_at: '2026-08-26T08:02:00.000Z',
      system_signature: 'codex',
      system_name: 'Codex',
      kind: 'coding-agent',
      observed_seconds: 30,
      active_seconds: 30,
      avg_cpu_percent: 10,
      peak_cpu_percent: 12,
      avg_memory_bytes: 200,
      peak_memory_bytes: 220,
      peak_process_count: 3,
      sample_count: 3,
      measurement: 'bounded-local-process-tree-resource-bucket',
    },
  ]);
  assert.equal(history.systems[0]?.observed_seconds, 90);
  assert.equal(history.systems[0]?.active_seconds, 60);
  assert.equal(history.systems[0]?.avg_cpu_percent, 6);
  assert.equal(history.systems[0]?.peak_cpu_percent, 12);
  assert.equal(history.systems[0]?.avg_memory_bytes, 133);
  assert.equal(history.systems[0]?.peak_memory_bytes, 220);
  assert.equal(history.systems[0]?.peak_process_count, 3);
  assert.equal(history.systems[0]?.sample_count, 9);
});

test('system summaries include retained resource history when present', () => {
  const view = buildActivityExplorerViewModel(snapshot({
    resource_history: [{
      started_at: '2026-08-26T08:00:00.000Z',
      ended_at: '2026-08-26T08:01:00.000Z',
      system_signature: 'codex',
      system_name: 'Codex',
      kind: 'coding-agent',
      observed_seconds: 60,
      active_seconds: 20,
      avg_cpu_percent: 5,
      peak_cpu_percent: 9,
      avg_memory_bytes: 64_000_000,
      peak_memory_bytes: 80_000_000,
      peak_process_count: 3,
      sample_count: 6,
      measurement: 'bounded-local-process-tree-resource-bucket',
    }],
  }));
  assert.equal(view.resource_history_state, 'retained-local-buckets');
  assert.equal(view.systems[0]?.avg_cpu_percent, 5);
  assert.equal(view.systems[0]?.peak_cpu_percent, 9);
  assert.equal(view.systems[0]?.avg_memory_bytes, 64_000_000);
  assert.equal(view.systems[0]?.peak_process_count, 3);
});

test('same-day and midnight-crossing labels use the requested local timezone', () => {
  const sameDay = { start_ms: Date.parse('2026-08-26T08:00:00.000Z'), end_ms: Date.parse('2026-08-26T09:00:00.000Z') };
  assert.match(formatObservationDateRange(sameDay, 'en', 'Europe/Berlin') ?? '', /Aug 26, 2026/);
  assert.match(formatObservationDateRange(sameDay, 'de', 'Europe/Berlin') ?? '', /26\. Aug\. 2026/);

  const crossing = normalizeActivitySegments([
    { started_at: '2026-08-26T21:50:00.000Z', ended_at: '2026-08-26T22:10:00.000Z', state: 'working-now', product_signatures: ['codex'], observation_id: 1 },
  ], 1000);
  assert.deepEqual(availableLocalDateKeys(crossing, 'Europe/Berlin'), ['2026-08-26', '2026-08-27']);
  assert.match(formatObservationDateRange({ start_ms: crossing[0]!.start_ms, end_ms: crossing[0]!.end_ms }, 'en', 'Europe/Berlin') ?? '', /Aug 26, 2026.*Aug 27, 2026/);
});

test('history exposes no invented date and clears a system absent from the selected evidence', () => {
  assert.deepEqual(availableLocalDateKeys([], 'Europe/Berlin'), []);
  assert.equal(formatObservationDateRange(null, 'en', 'Europe/Berlin'), null);
  const codexView = buildActivityExplorerViewModel(snapshot());
  assert.equal(resolveSelectedSystemSignature(codexView, 'codex'), 'codex');
  assert.equal(resolveSelectedSystemSignature(codexView, 'claude'), null);
  assert.equal(resolveSelectedSystemSignature(codexView, null), null);
});

test('system summaries expose real activity periods and current resource evidence only', () => {
  const codex = { ...product('codex', 'Codex', 20), state: 'working-now' as const, cpu_percent: 3.5, memory_bytes: 20_000_000, process_count: 2 };
  const view = buildActivityExplorerViewModel(snapshot({ products: [codex] }));
  assert.equal(view.systems[0]?.period_count, 2);
  assert.equal(view.systems[0]?.longest_active_seconds, 10);
  assert.equal(view.systems[0]?.current_cpu_percent, 3.5);
  assert.equal(view.systems[0]?.current_memory_bytes, 20_000_000);
  assert.equal(view.systems[0]?.first_observed_ms, Date.parse('2026-08-26T08:00:00.000Z'));
  assert.equal(view.systems[0]?.last_observed_ms, Date.parse('2026-08-26T08:00:30.000Z'));
});

test('ready AI apps remain available for honest per-app filtering', () => {
  const ready = product('ready-app', 'Ready App', 0);
  const view = buildActivityExplorerViewModel(snapshot({ products: [product('codex', 'Codex', 20), ready] }));
  assert.deepEqual(view.systems.map((system) => system.signature), ['codex', 'ready-app']);
  assert.equal(view.systems[1]?.active_seconds, 0);
  assert.equal(view.systems[1]?.state, 'open-idle');
  assert.equal(view.active_tool_count, 1);
});
