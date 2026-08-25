import assert from 'node:assert/strict';
import test from 'node:test';
import { runCensus } from './census';
import type { MonitorSnapshot } from './monitor';
import { authorizeAnonymousAiFootprintContribution, buildAnonymousAiFootprintPreview } from './sharing';

async function report() {
  return runCensus({ includeRuntimes: false, includeFilesystem: false, includeAgents: false, includeTools: false, includeMcp: false, platform: 'darwin', architecture: 'arm64' });
}

function monitor(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return {
    schema_version: '1.0', observation_id: 1, lifecycle: 'stopped', started_at: null, stopped_at: null,
    observed_seconds: 600, active_seconds: 120, activity_ratio: 0.2,
    products: [{
      signature: 'private-signature', name: 'Private App Name', kind: 'coding-agent',
      state: 'open-idle', process_count: 4, cpu_percent: 0, memory_percent: 1, memory_bytes: 10_000_000,
      recent_cpu_time_delta_ms: 0, active_seconds: 120,
      context: { chat: 'Private chat', workspace: 'Private workspace', source: 'cooperating-app-metadata' },
    }],
    timeline: [], sample_interval_ms: 1000, history_limit: 900,
    presence: { state: 'active', idle_seconds: 0, observation_eligible: true },
    evidence: 'repeated-process-tree-cpu-time-deltas', limitation: 'local only',
    overhead: { current_cpu_percent: 1, current_memory_bytes: 10, history_bytes: 20, sample_count: 3, median_cpu_percent: 1, p95_cpu_percent: 2, max_memory_bytes: 12, measurement: 'forkit-process-tree' },
    ...overrides,
  };
}

test('anonymous preview contains only the activity-ratio allowlist', async () => {
  const payload = buildAnonymousAiFootprintPreview(await report(), monitor(), { osMajor: 26 });
  assert.deepEqual(Object.keys(payload).sort(), ['counts', 'model_storage_bytes', 'observation', 'schema_version', 'system', 'versions']);
  assert.equal(payload.observation.activity_ratio, 0.2);
  assert.equal(payload.counts.supported_apps_observed_working, 1);
  assert.deepEqual(payload.counts.supported_app_categories, ['coding-agent']);
  const serialized = JSON.stringify(payload);
  for (const forbidden of ['Private App Name', 'Private chat', 'Private workspace', 'signature', 'process_count', 'cpu_percent', 'census_id', 'generated_at', 'guess']) {
    assert.equal(serialized.includes(forbidden), false, `unexpected ${forbidden}`);
  }
});

test('preview requires ten valid minutes and consistent activity duration', async () => {
  const value = await report();
  assert.throws(() => buildAnonymousAiFootprintPreview(value, monitor({ observed_seconds: 599 })), /MINIMUM_OBSERVATION/);
  assert.throws(() => buildAnonymousAiFootprintPreview(value, monitor({ active_seconds: 601 })), /INVALID_ACTIVITY_DURATION/);
});

test('preview emits whole-second durations accepted by the global schema', async () => {
  const payload = buildAnonymousAiFootprintPreview(await report(), monitor({ observed_seconds: 613.4, active_seconds: 612.2 }), { osMajor: 26 });
  assert.deepEqual(payload.observation, { valid_seconds: 613, ai_active_seconds: 612, activity_ratio: 0.998 });
});

test('consent is separate from preview construction and never changes the payload', async () => {
  const payload = buildAnonymousAiFootprintPreview(await report(), monitor());
  assert.throws(() => authorizeAnonymousAiFootprintContribution(payload, false), /CONSENT_REQUIRED/);
  assert.deepEqual(authorizeAnonymousAiFootprintContribution(payload, true), payload);
});
